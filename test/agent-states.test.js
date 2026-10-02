"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { STATES, stateForClaudeHook, stateForClaudeLogLine } = require("../shared/agent-states");

test("hook events map to cat states", () => {
  assert.equal(stateForClaudeHook("UserPromptSubmit"), STATES.THINKING);
  assert.equal(stateForClaudeHook("PreToolUse"), STATES.WORKING);
  assert.equal(stateForClaudeHook("PermissionRequest"), STATES.ATTENTION);
  assert.equal(stateForClaudeHook("Stop"), STATES.COMPLETE);
  assert.equal(stateForClaudeHook("StopFailure"), STATES.ERROR);
  assert.equal(stateForClaudeHook("SomethingNew"), null);
});

test("the 'waiting for your input' reminder is ignored", () => {
  assert.equal(stateForClaudeHook("Notification", { message: "Claude is waiting for your input" }), null);
  assert.equal(stateForClaudeHook("Notification", { message: "Claude needs your permission to use Bash" }), STATES.ATTENTION);
});

const line = (obj) => JSON.stringify(obj);

test("transcript lines map to cat states", () => {
  assert.equal(stateForClaudeLogLine(line({ type: "user", message: { role: "user", content: "hi" } })), STATES.THINKING);
  assert.equal(
    stateForClaudeLogLine(line({ type: "user", message: { role: "user", content: [{ type: "tool_result" }] } })),
    STATES.WORKING,
  );
  assert.equal(
    stateForClaudeLogLine(line({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Bash" }] } })),
    STATES.WORKING,
  );
  assert.equal(
    stateForClaudeLogLine(line({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "AskUserQuestion" }] } })),
    STATES.ATTENTION,
  );
  assert.equal(
    stateForClaudeLogLine(line({ type: "assistant", message: { role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "done" }] } })),
    STATES.COMPLETE,
  );
  assert.equal(
    stateForClaudeLogLine(line({ type: "user", message: { role: "user", content: [{ type: "text", text: "[Request interrupted by user]" }] } })),
    STATES.IDLE,
  );
});

test("junk, sidechains and other entry types are ignored", () => {
  assert.equal(stateForClaudeLogLine("not json"), null);
  assert.equal(stateForClaudeLogLine(line({ type: "summary" })), null);
  assert.equal(stateForClaudeLogLine(line({ type: "user", isSidechain: true, message: { role: "user", content: "x" } })), null);
});
