"use strict";
const http = require("http");

// Args: <node-id> <port>
const NODE_ID = process.argv[2] || "0";
const PORT = parseInt(process.argv[3] || "3000", 10);

const server = http.createServer((req, res) => {
  const t0 = Date.now();
  // Reply with the same id every time so the client can tell nodes apart.
  const body = JSON.stringify({
    node: NODE_ID,
    pid: process.pid,
    path: req.url,
    served_at: new Date().toISOString(),
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(body);
  console.log(
    `[node-${NODE_ID} pid=${process.pid}] ${req.method} ${req.url} in ${Date.now() - t0}ms`,
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[node-${NODE_ID} pid=${process.pid}] listening on 0.0.0.0:${PORT}`);
});
