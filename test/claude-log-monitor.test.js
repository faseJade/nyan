"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClaudeLogMonitor } = require("../main/claude-log-monitor");

const line = (obj) => `${JSON.stringify(obj)}\n`;

test("reports only lines written after it started watching", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nyan-projects-"));
  const dir = path.join(root, "-home-me-code");
  fs.mkdirSync(dir);
  const file = path.join(dir, "sess-1.jsonl");
  fs.writeFileSync(file, line({ type: "user", message: { role: "user", content: "old prompt" } }));

  const reports = [];
  const monitor = createClaudeLogMonitor({ projectDirs: [root, "/does/not/exist"], onReport: (r) => reports.push(r) });
  monitor.poll();
  assert.deepEqual(reports, [], "history is not news");

  fs.appendFileSync(file, line({ type: "user", message: { role: "user", content: "new prompt" } }));
  // A line split across two writes is held until it's complete.
  const done = line({ type: "assistant", message: { role: "assistant", stop_reason: "end_turn", content: [] } });
  fs.appendFileSync(file, done.slice(0, 20));
  monitor.poll();
  fs.appendFileSync(file, done.slice(20));
  monitor.poll();

  assert.deepEqual(
    reports.map((r) => [r.sessionId, r.state, r.source]),
    [
      ["sess-1", "thinking", "log"],
      ["sess-1", "complete", "log"],
    ],
  );
  fs.rmSync(root, { recursive: true });
});
