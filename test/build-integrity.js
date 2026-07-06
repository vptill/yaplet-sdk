/**
 * Build-integrity + bundle-composition guard.
 *
 * Compiles the real webpack config (ESM + CJS) to an isolated temp dir — never
 * touching build/ or published/ — and asserts:
 *   - both configs compile with no errors;
 *   - the expected assets emit (core.js, full.js, index.js, tours.chunk.js);
 *   - the set of ./src/*.js modules in the CJS bundle matches the baseline,
 *     except for intentional removals (KNOWN_DEAD_MODULES) — this is what
 *     proves a deleted module actually left the shipped bundle;
 *   - no asset grew more than a small tolerance vs the baseline.
 *
 *   node test/build-integrity.js            # check (exit 1 on fail)
 *   node test/build-integrity.js --update   # (re)capture the baseline
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const webpack = require("webpack");

const BASELINE = path.resolve(__dirname, "__baseline__", "build.json");
const EXPECTED_ASSETS = ["core.js", "full.js", "index.js", "tours.chunk.js"];
const GROWTH_TOLERANCE = 0.02; // assets must not grow > 2% (deletions only)

// Source modules this cleanup intentionally removes from the bundle. Grows per wave.
// Source modules intentionally removed vs the committed baseline. Empty in the
// steady state (baseline captured on the current module set). If you remove a
// module later, add it here AND re-run `npm run test:update`.
const KNOWN_DEAD_MODULES = [];

function buildConfigs() {
  process.env.npm_package_version = process.env.npm_package_version || "1.0.0";
  const factory = require(path.resolve(__dirname, "..", "webpack.config.js"));
  const configs = factory({}); // [esmConfig, cjsConfig]
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yaplet-buildcheck-"));
  configs.forEach((c, i) => {
    const isEsm = c.output && c.output.library && c.output.library.type === "module";
    c.output = { ...c.output, path: path.join(tmp, isEsm ? "esm" : "cjs"), clean: true };
    // Drop the copyBuildPlugin (a plain-object plugin) so we never write to
    // published/. Keep DefinePlugin (a real class instance).
    c.plugins = (c.plugins || []).filter(
      (p) => p && p.constructor && p.constructor.name !== "Object"
    );
  });
  return { configs, tmp };
}

function extractCjs(multiStats) {
  const children = multiStats.stats; // array of Stats
  let cjs = null;
  for (const st of children) {
    const json = st.toJson({ assets: true, modules: true, errors: true });
    const hasUmd = (json.assets || []).some((a) => a.name === "core.js");
    if (hasUmd) cjs = json;
  }
  if (!cjs) throw new Error("could not locate CJS compilation in stats");
  const assets = {};
  for (const a of cjs.assets) assets[a.name] = a.size;
  const srcModules = Array.from(
    new Set(
      (cjs.modules || [])
        .flatMap((m) => (m.modules ? m.modules.map((s) => s.name) : [m.name]))
        .filter((n) => typeof n === "string" && /^\.\/src\/[^ ]+\.js$/.test(n))
    )
  ).sort();
  return { assets, srcModules };
}

function compile() {
  return new Promise((resolve, reject) => {
    const { configs, tmp } = buildConfigs();
    webpack(configs, (err, multiStats) => {
      if (err) return reject(err);
      if (multiStats.hasErrors()) {
        return reject(new Error(multiStats.toString({ errors: true, all: false })));
      }
      let result;
      try {
        result = extractCjs(multiStats);
      } catch (e) {
        return reject(e);
      }
      fs.rmSync(tmp, { recursive: true, force: true });
      resolve(result);
    });
  });
}

async function run() {
  const update = process.argv.includes("--update");
  let current;
  try {
    current = await compile();
  } catch (e) {
    console.log("build-integrity FAIL — compile error:\n" + (e && e.message));
    return false;
  }

  const missingAssets = EXPECTED_ASSETS.filter((a) => !(a in current.assets));
  if (missingAssets.length) {
    console.log(`build-integrity FAIL — missing assets: ${missingAssets.join(", ")}`);
    return false;
  }

  if (update) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    console.log("build-integrity: baseline updated");
    console.log(`  assets: ${Object.entries(current.assets).map(([k, v]) => `${k}=${(v / 1024).toFixed(0)}KB`).join(", ")}`);
    console.log(`  src modules: ${current.srcModules.length}`);
    return true;
  }

  if (!fs.existsSync(BASELINE)) {
    console.log("build-integrity: NO BASELINE — run with --update first");
    return false;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));

  let ok = true;
  const baseMods = new Set(baseline.srcModules);
  const curMods = new Set(current.srcModules);
  const removed = [...baseMods].filter((m) => !curMods.has(m));
  const added = [...curMods].filter((m) => !baseMods.has(m));
  const badRemovals = removed.filter((m) => !KNOWN_DEAD_MODULES.includes(m));

  if (added.length) {
    ok = false;
    console.log(`build-integrity FAIL — unexpected new modules: ${added.join(", ")}`);
  }
  if (badRemovals.length) {
    ok = false;
    console.log(`build-integrity FAIL — unexpected module removals: ${badRemovals.join(", ")}`);
  }

  for (const [name, size] of Object.entries(current.assets)) {
    const base = baseline.assets[name];
    if (base && size > base * (1 + GROWTH_TOLERANCE)) {
      ok = false;
      console.log(`build-integrity FAIL — ${name} grew ${((size / base - 1) * 100).toFixed(1)}% (${base}→${size})`);
    }
  }

  if (ok) {
    const note = removed.length ? ` (removed as planned: ${removed.join(", ")})` : "";
    console.log(`build-integrity OK — ${curMods.size} src modules, assets within tolerance${note}`);
  }
  return ok;
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1));
}
module.exports = { run, compile };
