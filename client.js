"use strict";
const http = require("http");

// One round of calls = one call per node.
// Runs N rounds so we get enough samples to see failure patterns.
const ROUNDS = parseInt(process.env.ROUNDS || "20", 10);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || "1500", 10);
const TARGETS = [
  { name: "node-1", host: "toxiproxy", port: 30001 },
  { name: "node-2", host: "toxiproxy", port: 30002 },
  { name: "node-3", host: "toxiproxy", port: 30003 },
];

const stats = {};
for (const t of TARGETS) stats[t.name] = { ok: 0, fail: 0, ok_rtts: [], fail_rtts: [] };

function callOne(target) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = http.request(
      {
        host: target.host,
        port: target.port,
        path: "/ping",
        method: "GET",
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const rtt = Date.now() - t0;
          stats[target.name].ok++;
          stats[target.name].ok_rtts.push(rtt);
          resolve({ ok: true, rtt, body: data });
        });
      },
    );
    req.on("timeout", () => {
      const rtt = Date.now() - t0;
      stats[target.name].fail++;
      stats[target.name].fail_rtts.push(rtt);
      req.destroy();
      resolve({ ok: false, rtt, error: "timeout" });
    });
    req.on("error", (err) => {
      const rtt = Date.now() - t0;
      stats[target.name].fail++;
      stats[target.name].fail_rtts.push(rtt);
      resolve({ ok: false, rtt, error: err.code || err.message });
    });
    req.end();
  });
}

function summarize(arr) {
  if (!arr.length) return { avg: "-", max: "-" };
  const avg = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  const max = Math.max(...arr);
  return { avg, max };
}

(async () => {
  console.log(
    `[client] starting ${ROUNDS} rounds, ${TIMEOUT_MS}ms timeout per call`,
  );

  for (let r = 0; r < ROUNDS; r++) {
    const results = await Promise.all(TARGETS.map(callOne));
    for (let i = 0; i < TARGETS.length; i++) {
      const t = TARGETS[i];
      const res = results[i];
      if (res.ok) {
        console.log(
          `round ${r + 1} ${t.name} OK rtt=${res.rtt}ms body=${res.body.slice(0, 60)}`,
        );
      } else {
        console.log(
          `round ${r + 1} ${t.name} FAIL rtt=${res.rtt}ms err=${res.error}`,
        );
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("\n=== summary ===");
  for (const t of TARGETS) {
    const s = stats[t.name];
    const total = s.ok + s.fail;
    const rate = total === 0 ? 0 : ((s.ok / total) * 100).toFixed(1);
    const ok = summarize(s.ok_rtts);
    const fail = summarize(s.fail_rtts);
    console.log(
      `${t.name}: ${s.ok}/${total} ok (${rate}%) ` +
        `ok_avg_rtt=${ok.avg}ms ok_max_rtt=${ok.max}ms ` +
        `fail_avg_rtt=${fail.avg}ms fail_max_rtt=${fail.max}ms`,
    );
  }
})();
