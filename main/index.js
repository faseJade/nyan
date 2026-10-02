"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } = require("electron");
const { createAgentTracker } = require("../shared/agent-tracker");
const { toPetEvent } = require("../shared/input-events");
const { createAgentServer } = require("./agent-server");
const { createClaudeLogMonitor } = require("./claude-log-monitor");
const { startAutoUpdates } = require("./updater");

const PET_SIZE = 200;
const ON_TOP_EVERY_MS = 2500; // Windows quietly drops on-top windows; keep reclaiming
const MOVE_EVENT_MIN_MS = 33;

let petWindow = null;
let tray = null;

// ── settings ────────────────────────────────────────────────────────────────

const settingsPath = () => path.join(app.getPath("userData"), "settings.json");

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}

// ── pet window ──────────────────────────────────────────────────────────────

function startPosition() {
  const saved = loadSettings().position;
  const area = screen.getDisplayNearestPoint(saved || screen.getCursorScreenPoint()).workArea;
  const fallback = { x: area.x + area.width - PET_SIZE - 40, y: area.y + area.height - PET_SIZE };
  if (!saved) return fallback;
  const onScreen =
    saved.x >= area.x && saved.y >= area.y && saved.x + PET_SIZE <= area.x + area.width && saved.y + PET_SIZE <= area.y + area.height;
  return onScreen ? saved : fallback;
}

function createPetWindow() {
  const { x, y } = startPosition();
  petWindow = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    focusable: false,
    webPreferences: { preload: path.join(__dirname, "..", "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  petWindow.setAlwaysOnTop(true, "pop-up-menu");
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  petWindow.on("moved", () => {
    const [px, py] = petWindow.getPosition();
    saveSettings({ position: { x: px, y: py } });
  });
  petWindow.on("closed", () => (petWindow = null));

  const onTop = setInterval(() => {
    if (!petWindow) return clearInterval(onTop);
    petWindow.setAlwaysOnTop(true, "pop-up-menu");
    petWindow.moveTop();
  }, ON_TOP_EVERY_MS);
}

function sendToPet(channel, payload) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send(channel, payload);
}

// The window is a square, the cat isn't: the renderer says when the cursor is
// over the cat, and only then does the window take clicks.
ipcMain.on("set-clickable", (_e, clickable) => {
  if (!petWindow) return;
  if (clickable) petWindow.setIgnoreMouseEvents(false);
  else petWindow.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on("move-by", (_e, dx, dy) => {
  if (!petWindow) return;
  const [px, py] = petWindow.getPosition();
  petWindow.setPosition(Math.round(px + dx), Math.round(py + dy));
});

// ── tray ────────────────────────────────────────────────────────────────────

// 16×16 cat face drawn in code, so the repo needs no icon file yet.
const TRAY_PIXELS = [
  "................",
  "..#.........#...",
  "..##.......##...",
  "..###.....###...",
  "..###########...",
  ".#############..",
  ".#############..",
  ".###..###..###..",
  ".###..###..###..",
  ".#############..",
  ".######.######..",
  ".#############..",
  "..###########...",
  "...#########....",
  "................",
  "................",
];

function trayIcon() {
  const buf = Buffer.alloc(16 * 16 * 4);
  TRAY_PIXELS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "#") buf.writeUInt32LE(0xff2a2a2a, (y * 16 + x) * 4); // BGRA
    }),
  );
  return nativeImage.createFromBitmap(buf, { width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip("Nyan");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Move to centre",
        click: () => {
          const area = screen.getPrimaryDisplay().workArea;
          petWindow && petWindow.setPosition(area.x + (area.width - PET_SIZE) / 2, area.y + (area.height - PET_SIZE) / 2);
        },
      },
      { label: "Test: done hop", click: () => sendToPet("agent-complete", { sessionId: "test" }) },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: "separator" },
      { label: "Quit Nyan", click: () => app.quit() },
    ]),
  );
}

// ── global input (see shared/input-events.js for what is and isn't passed on) ─

function startInputHook() {
  let uIOhook;
  try {
    ({ uIOhook } = require("uiohook-napi"));
  } catch (err) {
    console.warn("[nyan] keyboard/mouse hook unavailable:", err.message);
    return;
  }
  let lastMove = 0;
  for (const type of ["keydown", "wheel", "mousedown", "mousemove"]) {
    uIOhook.on(type, (raw) => {
      if (type === "mousemove") {
        const t = Date.now();
        if (t - lastMove < MOVE_EVENT_MIN_MS) return;
        lastMove = t;
      }
      const event = toPetEvent(type, raw);
      if (event) sendToPet("pet-input", event);
    });
  }
  uIOhook.start();
  app.on("will-quit", () => uIOhook.stop());
}

// ── AI agents ───────────────────────────────────────────────────────────────

function startAgentWatching() {
  const tracker = createAgentTracker({
    onChange: (state) => sendToPet("agent-state", state),
    onComplete: (info) => sendToPet("agent-complete", info),
  });

  const server = createAgentServer({ onReport: tracker.report, log: console.log });
  server.start().catch((err) => console.warn("[nyan] agent server not started:", err.message));

  // Extra transcript folders, e.g. WSL's: "\\\\wsl.localhost\\Ubuntu\\home\\cp\\.claude\\projects"
  const extra = loadSettings().claudeProjectDirs || [];
  const monitor = createClaudeLogMonitor({
    projectDirs: [path.join(os.homedir(), ".claude", "projects"), ...extra],
    onReport: tracker.report,
  });
  monitor.start();
  app.on("will-quit", () => {
    monitor.stop();
    server.stop();
  });
}

// ── app ─────────────────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createPetWindow();
    createTray();
    startInputHook();
    startAgentWatching();
    startAutoUpdates({ app, log: console.log });
  });
  app.on("window-all-closed", (e) => e.preventDefault()); // live in the tray
}
