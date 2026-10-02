"use strict";

// Privacy boundary for the global keyboard/mouse hook.
//
// The hook sees every key pressed in every app. Nothing past this function
// ever learns WHICH key: a keypress becomes { kind: "key" } and nothing else.
// Keep it that way; it's the promise in the README.

function toPetEvent(type, raw = {}) {
  switch (type) {
    case "keydown":
      return { kind: "key" };
    case "wheel":
      return { kind: "scroll" };
    case "mousedown":
      return { kind: "click" };
    case "mousemove":
      return { kind: "move", x: Math.round(Number(raw.x) || 0), y: Math.round(Number(raw.y) || 0) };
    default:
      return null;
  }
}

module.exports = { toPetEvent };
