"use strict";

// Updates come from this repo's GitHub Releases (electron-builder writes
// latest.yml there). Only runs in the installed app, never in `npm start`.

const CHECK_EVERY_MS = 6 * 60 * 60_000;

function startAutoUpdates({ app, log = () => {} }) {
  if (!app.isPackaged) return () => {};
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (err) {
    log("[nyan] updater unavailable:", err.message);
    return () => {};
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", (err) => log("[nyan] update check failed:", err && err.message));
  autoUpdater.on("update-downloaded", (info) => log(`[nyan] update ${info.version} ready, installs on quit`));

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  const timer = setInterval(check, CHECK_EVERY_MS);
  return () => clearInterval(timer);
}

module.exports = { startAutoUpdates };
