#!/usr/bin/env node
"use strict";

// Adds (or removes) Nyan's hook entries in Claude Code's settings.json.
// Run it on the machine where Claude Code runs — for me that's inside WSL:
//
//   node hooks/install-hooks.js            install
//   node hooks/install-hooks.js --remove   uninstall
//
// Only touches entries whose command mentions nyan-hook.js. Everything else in
// settings.json is left exactly as it was, and a backup is written first.

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionRequest",
  "Notification",
  "Stop",
  "StopFailure",
];
const MARKER = "nyan-hook.js";

function isOurs(hook) {
  return hook && typeof hook.command === "string" && hook.command.includes(MARKER);
}

function withoutOurs(groups) {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => ({ ...group, hooks: (group.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((group) => group.hooks.length > 0);
}

// Pure: returns new settings with our hooks added (install) or removed.
function applyHooks(settings, { hookPath, remove = false }) {
  const next = { ...settings, hooks: { ...(settings.hooks || {}) } };
  for (const event of HOOK_EVENTS) {
    const kept = withoutOurs(next.hooks[event]);
    if (!remove) {
      kept.push({ matcher: "", hooks: [{ type: "command", command: `node "${hookPath}" ${event}`, timeout: 5 }] });
    }
    if (kept.length > 0) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

function run({ remove = false, home = os.homedir(), sourceHook = path.join(__dirname, "nyan-hook.js") } = {}) {
  const settingsPath = path.join(home, ".claude", "settings.json");
  const hookPath = path.join(home, ".nyan", "nyan-hook.js");

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    fs.copyFileSync(settingsPath, `${settingsPath}.nyan-backup`);
  }

  if (remove) {
    fs.rmSync(hookPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(hookPath), { recursive: true });
    fs.copyFileSync(sourceHook, hookPath);
  }

  const next = applyHooks(settings, { hookPath, remove });
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  return { settingsPath, hookPath };
}

if (require.main === module) {
  const remove = process.argv.includes("--remove");
  const { settingsPath } = run({ remove });
  console.log(`${remove ? "Removed Nyan hooks from" : "Installed Nyan hooks in"} ${settingsPath}`);
  console.log("Restart any running Claude Code sessions to pick it up.");
}

module.exports = { applyHooks, run, HOOK_EVENTS };
