"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { toPetEvent } = require("../shared/input-events");

test("a keypress never says which key", () => {
  const event = toPetEvent("keydown", { keycode: 30, rawcode: 65, altKey: false, shiftKey: true });
  assert.deepEqual(event, { kind: "key" });
});

test("mouse and scroll events carry only what the cat needs", () => {
  assert.deepEqual(toPetEvent("mousemove", { x: 10.6, y: 20.2, button: 0 }), { kind: "move", x: 11, y: 20 });
  assert.deepEqual(toPetEvent("wheel", { rotation: 3, direction: 3 }), { kind: "scroll" });
  assert.deepEqual(toPetEvent("mousedown", { button: 1, x: 5, y: 5 }), { kind: "click" });
  assert.equal(toPetEvent("keyup", { keycode: 30 }), null);
});
