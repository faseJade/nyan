"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAgentTracker, HOOK_PRIORITY_MS, SESSION_STALE_MS } = require("../shared/agent-tracker");

function setup() {
  let t = 0;
  const changes = [];
  const hops = [];
  const tracker = createAgentTracker({
    onChange: (s) => changes.push(s),
    onComplete: (e) => hops.push(e.sessionId),
    now: () => t,
  });
  return { tracker, changes, hops, advance: (ms) => (t += ms) };
}

test("a normal turn: thinking, working, then one hop and back to idle", () => {
  const { tracker, changes, hops } = setup();
  tracker.report({ sessionId: "a", state: "thinking" });
  tracker.report({ sessionId: "a", state: "working" });
  tracker.report({ sessionId: "a", state: "complete" });
  assert.deepEqual(changes, ["thinking", "working", "idle"]);
  assert.deepEqual(hops, ["a"]);
});

test("a stray 'complete' from an unknown session does not hop", () => {
  const { tracker, hops } = setup();
  tracker.report({ sessionId: "ghost", state: "complete" });
  assert.deepEqual(hops, []);
});

test("the log channel is ignored while hooks are reporting", () => {
  const { tracker, hops, advance } = setup();
  tracker.report({ sessionId: "a", state: "working", source: "hook" });
  tracker.report({ sessionId: "a", state: "complete", source: "hook" });
  tracker.report({ sessionId: "a", state: "complete", source: "log" });
  assert.deepEqual(hops, ["a"], "no double hop");
  advance(HOOK_PRIORITY_MS + 1);
  tracker.report({ sessionId: "a", state: "thinking", source: "log" });
  assert.equal(tracker.getState(), "thinking", "log works again once hooks go quiet");
});

test("needing attention outranks working in another session", () => {
  const { tracker } = setup();
  tracker.report({ sessionId: "a", state: "working" });
  tracker.report({ sessionId: "b", state: "attention" });
  assert.equal(tracker.getState(), "attention");
});

test("sessions that go silent are dropped", () => {
  const { tracker, advance } = setup();
  tracker.report({ sessionId: "a", state: "working" });
  advance(SESSION_STALE_MS + 1);
  tracker.report({ sessionId: "b", state: "idle" });
  assert.equal(tracker.getState(), "idle");
});

test("unknown states are rejected", () => {
  const { tracker, changes } = setup();
  tracker.report({ sessionId: "a", state: "dancing" });
  assert.deepEqual(changes, []);
});
