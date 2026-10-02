"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { applyHooks, run, HOOK_EVENTS } = require("../hooks/install-hooks");

const hookPath = "/home/me/.nyan/nyan-hook.js";
const someoneElses = { matcher: "Bash", hooks: [{ type: "command", command: "my-linter" }] };

test("install adds one entry per event and keeps other hooks and settings", () => {
  const before = { model: "opus", hooks: { PreToolUse: [someoneElses] } };
  const after = applyHooks(before, { hookPath });
  assert.equal(after.model, "opus");
  assert.deepEqual(after.hooks.PreToolUse[0], someoneElses);
  for (const event of HOOK_EVENTS) {
    const ours = after.hooks[event].flatMap((g) => g.hooks).filter((h) => h.command.includes("nyan-hook.js"));
    assert.equal(ours.length, 1, event);
    assert.ok(ours[0].command.endsWith(` ${event}`));
  }
});

test("installing twice doesn't duplicate", () => {
  const once = applyHooks({}, { hookPath });
  const twice = applyHooks(once, { hookPath });
  assert.deepEqual(twice, once);
});

test("remove takes out only ours", () => {
  const installed = applyHooks({ model: "opus", hooks: { PreToolUse: [someoneElses] } }, { hookPath });
  const removed = applyHooks(installed, { hookPath, remove: true });
  assert.deepEqual(removed, { model: "opus", hooks: { PreToolUse: [someoneElses] } });
  assert.deepEqual(applyHooks(applyHooks({}, { hookPath }), { hookPath, remove: true }), {});
});

test("run writes the hook file, the settings, and a backup", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nyan-home-"));
  fs.mkdirSync(path.join(home, ".claude"));
  fs.writeFileSync(path.join(home, ".claude", "settings.json"), JSON.stringify({ model: "opus" }));

  run({ home });
  assert.ok(fs.existsSync(path.join(home, ".nyan", "nyan-hook.js")));
  assert.ok(fs.existsSync(path.join(home, ".claude", "settings.json.nyan-backup")));
  const settings = JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8"));
  assert.equal(settings.model, "opus");
  assert.ok(settings.hooks.Stop);

  run({ home, remove: true });
  assert.ok(!fs.existsSync(path.join(home, ".nyan", "nyan-hook.js")));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")), { model: "opus" });
  fs.rmSync(home, { recursive: true });
});
