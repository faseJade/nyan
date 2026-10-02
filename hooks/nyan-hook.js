#!/usr/bin/env node
"use strict";

// Claude Code runs this on each hook event, with the event JSON on stdin.
// It forwards the event to Nyan and exits. It must never slow Claude down or
// show an error: short timeouts, and every failure exits 0 quietly.
//
// Self-contained on purpose (no requires outside Node) because it gets copied
// into WSL, away from the rest of the app.
//
//   NYAN_HOST  where Nyan listens (default 127.0.0.1)
//   NYAN_PORT  default 23457

const http = require("http");

const HOST = process.env.NYAN_HOST || "127.0.0.1";
const PORT = Number(process.env.NYAN_PORT) || 23457;
const STDIN_WAIT_MS = 100;
const POST_TIMEOUT_MS = 150;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    const done = () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    };
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", done);
    setTimeout(done, STDIN_WAIT_MS).unref();
  });
}

function post(body) {
  return new Promise((resolve) => {
    const json = JSON.stringify(body);
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: "/agent-state",
        method: "POST",
        timeout: POST_TIMEOUT_MS,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) },
      },
      (res) => {
        res.resume();
        res.on("end", resolve);
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", resolve);
    req.on("close", resolve);
    req.end(json);
  });
}

async function main() {
  const payload = await readStdin();
  const event = process.argv[2] || payload.hook_event_name;
  if (!event) return;
  await post({
    agentId: "claude-code",
    event,
    sessionId: payload.session_id || "default",
    message: typeof payload.message === "string" ? payload.message.slice(0, 200) : "",
  });
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
