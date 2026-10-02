"use strict";

// Placeholder pet: proves the plumbing (click-through, drag, input, agent
// states, sounds). The real cat and its animations replace the box later.

const cat = document.getElementById("cat");
const bubble = document.getElementById("bubble");
let audio = null;
const sound = (name) => {
  audio = audio || new AudioContext();
  window.NyanSounds[name](audio);
};

// ── click-through: only the cat takes clicks ───────────────────────────────
let clickable = false;
let dragging = null;
document.addEventListener("mousemove", (e) => {
  if (dragging) {
    window.nyan.moveBy(e.screenX - dragging.x, e.screenY - dragging.y);
    dragging = { x: e.screenX, y: e.screenY };
    return;
  }
  const over = cat.contains(document.elementFromPoint(e.clientX, e.clientY));
  if (over !== clickable) {
    clickable = over;
    window.nyan.setClickable(over);
  }
});
cat.addEventListener("mousedown", (e) => (dragging = { x: e.screenX, y: e.screenY }));
document.addEventListener("mouseup", () => (dragging = null));

// ── keyboard: a little press on every key ──────────────────────────────────
let keyTimer = null;
window.nyan.onInput((event) => {
  if (event.kind !== "key") return;
  document.body.classList.add("key");
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => document.body.classList.remove("key"), 120);
});

// ── AI agent ───────────────────────────────────────────────────────────────
window.nyan.onAgentState((state) => {
  document.body.dataset.agent = state;
  bubble.textContent = state === "attention" ? "!" : "…";
});
window.nyan.onAgentComplete(() => {
  document.body.classList.add("hop");
  sound("chirp");
  setTimeout(() => document.body.classList.remove("hop"), 400);
});
