/**
 * Golden outbound-effects harness — the behavioral-equivalence keystone.
 *
 * Boots the SDK against canned XHR responses, completes the iframe ping
 * handshake so sendMessage() fires for real, runs the scripted LIVE scenario
 * (test/lib/scenario.js), and records the outbound effects: SDK→iframe
 * postMessages, XHR calls, and injected host-page DOM surfaces.
 *
 * Because the scenario only calls methods that survive the cleanup, its
 * transcript must be IDENTICAL before and after every deletion wave. Any diff
 * is a red flag.
 *
 *   node test/golden-effects.js            # check against baseline (exit 1 on fail)
 *   node test/golden-effects.js --update   # (re)capture the baseline
 */
const fs = require("fs");
const path = require("path");
const { runEffectsScenario } = require("./lib/harness");
const liveScenario = require("./lib/scenario");

const BUNDLES = ["core.js", "full.js"];
const BASELINE = path.resolve(__dirname, "__baseline__", "effects.json");

async function capture() {
  const out = {};
  for (const b of BUNDLES) {
    const p = path.resolve(__dirname, "..", "build", "cjs", b);
    const records = await runEffectsScenario(p, liveScenario);
    if (records.jsdomErrors && records.jsdomErrors.length) {
      console.log(`  [warn] ${b}: jsdomErrors: ${records.jsdomErrors.map((e) => String(e).split("\n")[0]).join(" | ")}`);
    }
    out[b] = {
      postMessages: records.postMessages,
      // Body is volatile (session/metadata) — keep method+url only.
      xhr: records.xhr.map((r) => ({ method: r.method, url: r.url })),
      domSurfaces: records.domSurfaces,
    };
  }
  return out;
}

function firstDiff(a, b, pathStr = "") {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const d = firstDiff(a[i], b[i], `${pathStr}[${i}]`);
      if (d) return d;
    }
    return { path: pathStr, baseline: a, current: b };
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[k], b[k], `${pathStr}.${k}`);
      if (d) return d;
    }
  }
  return { path: pathStr, baseline: a, current: b };
}

async function run() {
  const update = process.argv.includes("--update");
  const current = await capture();

  if (update) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    console.log("golden-effects: baseline updated");
    for (const b of BUNDLES)
      console.log(`  ${b}: ${current[b].postMessages.length} postMessages, ${current[b].xhr.length} xhr, ${current[b].domSurfaces.length} DOM surfaces`);
    return true;
  }

  if (!fs.existsSync(BASELINE)) {
    console.log("golden-effects: NO BASELINE — run with --update first");
    return false;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));

  let ok = true;
  for (const b of BUNDLES) {
    const d = firstDiff(baseline[b], current[b]);
    if (d) {
      ok = false;
      console.log(`golden-effects[${b}] FAIL — transcript changed at ${d.path}`);
      console.log(`   baseline: ${JSON.stringify(d.baseline)}`);
      console.log(`   current:  ${JSON.stringify(d.current)}`);
    } else {
      console.log(`golden-effects[${b}] OK — ${current[b].postMessages.length} postMessages match`);
    }
  }
  return ok;
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1));
}
module.exports = { run, capture };
