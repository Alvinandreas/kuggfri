// Belastningstest med bara läsningar: simulerar att många studenter öppnar decket samtidigt
// direkt efter en föreläsning. Mäter svarstider och fel per sida.
//
//   node scripts/load-test.cjs                       mot https://kuggfri.com, 60 samtidiga, 20 s
//   node scripts/load-test.cjs http://localhost:3001 100 30
//
// Inga skrivningar, inga konton: bara GET på startsidan, decksidan och studieläget (gäst).

const base = (process.argv[2] || "https://kuggfri.com").replace(/\/$/, "");
const concurrency = Number(process.argv[3] || 60);
const seconds = Number(process.argv[4] || 20);

const PAGES = ["/", "/d/materialteknik", "/d/materialteknik/plugga?mode=free&urval=all", "/om"];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function worker(id, stopAt, results) {
  let i = id;
  while (Date.now() < stopAt) {
    const path = PAGES[i % PAGES.length];
    i += 1;
    const t0 = performance.now();
    try {
      const res = await fetch(base + path, { headers: { "user-agent": "kuggfri-load-test" }, cache: "no-store" });
      await res.arrayBuffer();
      results.push({ path, ms: performance.now() - t0, status: res.status });
    } catch (e) {
      results.push({ path, ms: performance.now() - t0, status: 0, error: String(e.message || e) });
    }
  }
}

(async () => {
  console.log(`Belastningstest mot ${base}: ${concurrency} samtidiga klienter i ${seconds} s (bara GET)`);
  const results = [];
  const stopAt = Date.now() + seconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i, stopAt, results)));

  const byPath = new Map();
  for (const r of results) {
    const b = byPath.get(r.path) ?? { n: 0, errors: 0, times: [] };
    b.n += 1;
    if (r.status !== 200) b.errors += 1;
    b.times.push(r.ms);
    byPath.set(r.path, b);
  }
  const rows = [];
  for (const [path, b] of byPath) {
    b.times.sort((a, c) => a - c);
    rows.push({ sida: path, anrop: b.n, fel: b.errors, "p50 ms": Math.round(percentile(b.times, 50)), "p95 ms": Math.round(percentile(b.times, 95)), "max ms": Math.round(b.times[b.times.length - 1]) });
  }
  console.table(rows);
  const total = results.length;
  const errors = results.filter((r) => r.status !== 200).length;
  console.log(`Totalt ${total} anrop, ${(total / seconds).toFixed(1)} per sekund, ${errors} fel (${((errors / Math.max(1, total)) * 100).toFixed(1)} %).`);
  if (errors > 0) {
    const sample = results.filter((r) => r.status !== 200).slice(0, 5);
    console.log("Exempel på fel:", sample.map((r) => `${r.path} -> ${r.status}${r.error ? " " + r.error : ""}`).join(" | "));
  }
})();
