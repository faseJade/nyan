"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// The only bridge between the cat page and the rest of the app.
contextBridge.exposeInMainWorld("nyan", {
  setClickable: (clickable) => ipcRenderer.send("set-clickable", !!clickable),
  moveBy: (dx, dy) => ipcRenderer.send("move-by", dx, dy),
  onInput: (fn) => ipcRenderer.on("pet-input", (_e, event) => fn(event)),
  onAgentState: (fn) => ipcRenderer.on("agent-state", (_e, state) => fn(state)),
  onAgentComplete: (fn) => ipcRenderer.on("agent-complete", (_e, info) => fn(info)),
});
