"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { spawn } = require("child_process");
const { createAgentServer } = require("../main/agent-server");

const HOOK = path.join(__dirname, "..", "hooks", "nyan-hook.js");

function runHook(event, payload, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [HOOK, event], { env: { ...process.env, NYAN_PORT: String(port) } });
    child.on("exit", (code) => resolve({ code, ms: Date.now() - started }));
    child.stdin.end(JSON.stringify(payload));
  });
}

test("hook → server → state report, end to end", async () => {
  const reports = [];
  const server = createAgentServer({ port: 0, onReport: (r) => reports.push(r) });
  const port = await server.start();
  try {
    const { code } = await runHook("UserPromptSubmit", { session_id: "s1" }, port);
    assert.equal(code, 0);
    await runHook("Stop", { session_id: "s1" }, port);
    assert.deepEqual(
      reports.map((r) => [r.sessionId, r.state, r.source]),
      [
        ["s1", "thinking", "hook"],
        ["s1", "complete", "hook"],
      ],
    );
  } finally {
    await server.stop();
  }
});

test("hook exits 0 quickly when Nyan isn't running", async () => {
  const { code, ms } = await runHook("Stop", { session_id: "s1" }, 1); // nothing listens on port 1
  assert.equal(code, 0);
  assert.ok(ms < 2000, `took ${ms} ms`);
});

test("server rejects other paths and oversized bodies", async () => {
  const server = createAgentServer({ port: 0, onReport: () => assert.fail("should not report") });
  const port = await server.start();
  try {
    const other = await fetch(`http://127.0.0.1:${port}/nope`, { method: "POST", body: "{}" });
    assert.equal(other.status, 404);
    const big = await fetch(`http://127.0.0.1:${port}/agent-state`, { method: "POST", body: "x".repeat(20_000) });
    assert.equal(big.status, 413);
  } finally {
    await server.stop();
  }
});
