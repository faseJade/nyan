"use strict";

const http = require("http");
const { stateForClaudeHook } = require("../shared/agent-states");

// Receives POST /agent-state from hooks/nyan-hook.js.
// Listens on loopback only. WSL reaches it through mirrored networking.

const DEFAULT_PORT = 23457;
const MAX_BODY_BYTES = 16 * 1024;

function createAgentServer({ onReport, port = DEFAULT_PORT, host = "127.0.0.1", log = () => {} }) {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/agent-state") {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) body += chunk;
    });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413).end();
        return;
      }
      res.writeHead(204).end();
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return;
      }
      const state = stateForClaudeHook(payload.event, payload);
      if (state) {
        onReport({ agentId: payload.agentId, sessionId: payload.sessionId, state, source: "hook" });
      }
    });
  });

  return {
    start() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          log(`[nyan] agent server on ${host}:${server.address().port}`);
          resolve(server.address().port);
        });
      });
    },
    stop() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

module.exports = { createAgentServer, DEFAULT_PORT };
