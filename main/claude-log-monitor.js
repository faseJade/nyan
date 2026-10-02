"use strict";

const fs = require("fs");
const path = require("path");
const { stateForClaudeLogLine } = require("../shared/agent-states");

// Backup detection channel: tails Claude Code transcripts
// (<projects dir>/<project>/<session>.jsonl) and reports state changes.
// Catches sessions started before the hooks were installed, and keeps the cat
// working if a Claude Code update changes the hook format.

const POLL_MS = 1500;
const RECENT_MS = 10 * 60_000; // only watch transcripts touched recently
const MAX_READ_BYTES = 256 * 1024;

function createClaudeLogMonitor({ projectDirs, onReport, pollMs = POLL_MS, now = () => Date.now() }) {
  const tracked = new Map(); // file -> { offset, partial }
  let timer = null;

  function recentTranscripts() {
    const files = [];
    for (const root of projectDirs) {
      let projects;
      try {
        projects = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const project of projects) {
        if (!project.isDirectory()) continue;
        const dir = path.join(root, project.name);
        let entries;
        try {
          entries = fs.readdirSync(dir);
        } catch {
          continue;
        }
        for (const name of entries) {
          if (!name.endsWith(".jsonl")) continue;
          const file = path.join(dir, name);
          try {
            if (now() - fs.statSync(file).mtimeMs <= RECENT_MS) files.push(file);
          } catch {}
        }
      }
    }
    return files;
  }

  function readNew(file) {
    let size;
    try {
      size = fs.statSync(file).size;
    } catch {
      tracked.delete(file);
      return;
    }
    let t = tracked.get(file);
    if (!t) {
      // First sight: start at the end. Old history isn't news.
      tracked.set(file, { offset: size, partial: "" });
      return;
    }
    if (size < t.offset) t = { offset: 0, partial: "" };
    if (size === t.offset) return;

    const start = Math.max(t.offset, size - MAX_READ_BYTES);
    const buf = Buffer.alloc(size - start);
    const fd = fs.openSync(file, "r");
    try {
      fs.readSync(fd, buf, 0, buf.length, start);
    } finally {
      fs.closeSync(fd);
    }
    const lines = (t.partial + buf.toString("utf8")).split("\n");
    const partial = lines.pop();
    tracked.set(file, { offset: size, partial });

    const sessionId = path.basename(file, ".jsonl");
    for (const line of lines) {
      const state = line.trim() && stateForClaudeLogLine(line);
      if (state) onReport({ agentId: "claude-code", sessionId, state, source: "log" });
    }
  }

  function poll() {
    for (const file of recentTranscripts()) readNew(file);
  }

  return {
    poll,
    start() {
      if (timer) return;
      poll();
      timer = setInterval(poll, pollMs);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { createClaudeLogMonitor };
