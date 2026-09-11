/**
 * index.d.ts <-> bundle guard.
 *
 * Loads the built core.js + full.js in jsdom, reads the real public static
 * method surface of window.Yaplet, and asserts that index.d.ts — the type
 * definitions shipped to npm consumers — describes EXACTLY that surface:
 *
 *   - no phantom declaration (a method typed here that no longer exists in the
 *     bundle: TypeScript users compile green and then crash at runtime);
 *   - no undeclared method (shipped but invisible to TypeScript users).
 *
 * There is no baseline file: this compares two live artifacts, so it never
 * needs recapturing. Add or remove a public static method, change index.d.ts in
 * the same commit, and this stays green.
 *
 *   node test/api-surface.js   # exit 1 on mismatch
 */
const fs = require("fs");
const path = require("path");
const { loadYaplet } = require("./lib/harness");

const BUNDLES = ["core.js", "full.js"];

function surfaceOf(bundleFile) {
  const p = path.resolve(__dirname, "..", "build", "cjs", bundleFile);
  const { Yaplet } = loadYaplet(p);
  if (!Yaplet) throw new Error(`${bundleFile}: window.Yaplet is undefined after load`);
  return Object.getOwnPropertyNames(Yaplet)
    .filter((n) => typeof Yaplet[n] === "function")
    .sort();
}

/** Union of the shipped bundles' surfaces — what index.d.ts must describe. */
function capture() {
  const out = {};
  for (const b of BUNDLES) out[b] = surfaceOf(b);
  return out;
}

function run() {
  const surfaces = capture();
  let ok = true;

  // The two bundles are built from the same public class; a divergence is a
  // build bug in its own right, so surface it rather than silently unioning.
  const [a, b] = BUNDLES;
  const onlyA = surfaces[a].filter((m) => !surfaces[b].includes(m));
  const onlyB = surfaces[b].filter((m) => !surfaces[a].includes(m));
  if (onlyA.length || onlyB.length) {
    ok = false;
    console.log(
      `api-surface FAIL — bundles diverge: only in ${a}: [${onlyA.join(", ")}], only in ${b}: [${onlyB.join(", ")}]`
    );
  }

  const bundle = new Set([...surfaces[a], ...surfaces[b]]);

  const dtsPath = path.resolve(__dirname, "..", "index.d.ts");
  if (!fs.existsSync(dtsPath)) {
    console.log("api-surface FAIL — index.d.ts not found");
    return false;
  }
  const dts = fs.readFileSync(dtsPath, "utf8");
  const declared = new Set(
    [...dts.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1])
  );

  const phantom = [...declared].filter((m) => !bundle.has(m)).sort();
  const undeclared = [...bundle].filter((m) => !declared.has(m)).sort();

  if (phantom.length) {
    ok = false;
    console.log(`api-surface FAIL — declared in index.d.ts but not in the bundle (phantom): ${phantom.join(", ")}`);
  }
  if (undeclared.length) {
    ok = false;
    console.log(`api-surface FAIL — in the bundle but undeclared in index.d.ts: ${undeclared.join(", ")}`);
  }
  if (ok) {
    console.log(`api-surface OK — index.d.ts matches the bundle surface (${bundle.size} methods)`);
  }
  return ok;
}

if (require.main === module) {
  process.exit(run() ? 0 : 1);
}
module.exports = { run, capture };
