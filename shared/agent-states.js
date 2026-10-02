"use strict";

// Turns what an AI agent reports into one of a few cat states.
// Both detection channels (hooks and transcript logs) end up here, so the cat
// behaves the same whichever one fired.

const STATES = Object.freeze({
  IDLE: "idle",
  THINKING: "thinking",
  WORKING: "working",
  ATTENTION: "attention", // waiting on the human: permission prompt, question
  COMPLETE: "complete", // one-shot: the cat hops
  ERROR: "error",
});

const CLAUDE_HOOK_STATES = {
  SessionStart: STATES.IDLE,
  SessionEnd: STATES.IDLE,
  UserPromptSubmit: STATES.THINKING,
  PreToolUse: STATES.WORKING,
  PostToolUse: STATES.WORKING,
  PostToolUseFailure: STATES.WORKING,
  PermissionRequest: STATES.ATTENTION,
  Notification: STATES.ATTENTION,
  Elicitation: STATES.ATTENTION,
  Stop: STATES.COMPLETE,
  StopFailure: STATES.ERROR,
};

// Tools that stop and ask the human something.
const CLAUDE_ASKING_TOOLS = new Set(["AskUserQuestion", "ExitPlanMode"]);

function stateForClaudeHook(event, payload = {}) {
  const state = CLAUDE_HOOK_STATES[event];
  if (!state) return null;
  // Claude sends an idle reminder ("waiting for your input") a minute after it
  // finishes. The hop already covered that, so don't nag again.
  if (event === "Notification" && /waiting for (your )?input/i.test(String(payload.message || ""))) {
    return null;
  }
  return state;
}

function isInterrupt(content) {
  return content.some((part) => {
    const text = typeof part === "string" ? part : part && part.type === "text" ? part.text : "";
    return typeof text === "string" && text.startsWith("[Request interrupted by user");
  });
}

// One line of a Claude Code transcript (~/.claude/projects/**/*.jsonl).
function stateForClaudeLogLine(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  if (!entry || !entry.message || entry.isSidechain) return null;
  const content = Array.isArray(entry.message.content) ? entry.message.content : [];

  if (entry.type === "user" && entry.message.role === "user") {
    if (isInterrupt(content)) return STATES.IDLE;
    if (content.some((part) => part && part.type === "tool_result")) return STATES.WORKING;
    return STATES.THINKING;
  }

  if (entry.type === "assistant" && entry.message.role === "assistant") {
    const toolUse = content.find((part) => part && part.type === "tool_use");
    if (toolUse) return CLAUDE_ASKING_TOOLS.has(toolUse.name) ? STATES.ATTENTION : STATES.WORKING;
    if (entry.message.stop_reason === "end_turn") return STATES.COMPLETE;
    return STATES.THINKING;
  }

  return null;
}

module.exports = {
  STATES,
  stateForClaudeHook,
  stateForClaudeLogLine,
};
