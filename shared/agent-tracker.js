"use strict";

const { STATES } = require("./agent-states");

// Several Claude sessions can run at once, and each can be reported twice
// (hook + log). The tracker keeps one state per session and works out the one
// state the cat should show.

// While hooks are arriving for a session, the slower log channel for that
// session is ignored so the cat doesn't hop twice.
const HOOK_PRIORITY_MS = 30_000;
// A session that says nothing for this long is treated as gone.
const SESSION_STALE_MS = 10 * 60_000;

const DISPLAY_PRIORITY = [STATES.ATTENTION, STATES.ERROR, STATES.WORKING, STATES.THINKING];

function createAgentTracker({ onChange, onComplete, now = () => Date.now() }) {
  const sessions = new Map();
  let shown = STATES.IDLE;

  function overallState() {
    const t = now();
    const active = new Set();
    for (const [id, s] of sessions) {
      if (t - s.updatedAt > SESSION_STALE_MS) sessions.delete(id);
      else active.add(s.state);
    }
    return DISPLAY_PRIORITY.find((state) => active.has(state)) || STATES.IDLE;
  }

  function report({ agentId = "claude-code", sessionId = "default", state, source = "hook" }) {
    if (!Object.values(STATES).includes(state)) return;
    const key = `${agentId}:${sessionId}`;
    const t = now();
    const prev = sessions.get(key);

    if (source === "log" && prev && prev.lastHookAt && t - prev.lastHookAt < HOOK_PRIORITY_MS) return;
    // A "done" for a session we never saw working is a leftover; ignore it.
    if (state === STATES.COMPLETE && (!prev || prev.state === STATES.IDLE)) return;

    const lastHookAt = source === "hook" ? t : prev && prev.lastHookAt;
    if (state === STATES.COMPLETE) {
      sessions.set(key, { state: STATES.IDLE, updatedAt: t, lastHookAt });
      onComplete && onComplete({ agentId, sessionId });
    } else {
      sessions.set(key, { state, updatedAt: t, lastHookAt });
    }

    const next = overallState();
    if (next !== shown) {
      shown = next;
      onChange && onChange(shown);
    }
  }

  return { report, getState: () => shown };
}

module.exports = { createAgentTracker, HOOK_PRIORITY_MS, SESSION_STALE_MS };
