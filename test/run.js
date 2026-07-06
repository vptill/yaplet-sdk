/**
 * Test-net runner. Runs the three automated guards and exits nonzero if any
 * fails. This is what `npm test` invokes.
 *
 *   node test/run.js            # check all guards against baselines
 *   node test/run.js --update   # (re)capture every baseline (do this on a known-good bundle)
 *
 * The guards:
 *   1. api-surface     — the public static method surface (no live method lost).
 *   2. golden-effects  — the outbound-effects transcript (behavioral equivalence).
 *   3. build-integrity — bundle composition + sizes (dead modules actually left).
 *
 * CSS/visual verification (§3.4) and the demo smoke matrix (§3.5) are manual and
 * live outside this runner.
 */
const update = process.argv.includes("--update");
const surface = require("./api-surface");
const effects = require("./golden-effects");
const build = require("./build-integrity");

(async () => {
  const results = [];
  console.log(`\n=== Yaplet SDK test net ${update ? "(UPDATE baselines)" : "(check)"} ===\n`);

  console.log("[1/3] api-surface");
  results.push(["api-surface", await Promise.resolve(surface.run())]);

  console.log("\n[2/3] golden-effects");
  results.push(["golden-effects", await effects.run()]);

  console.log("\n[3/3] build-integrity");
  results.push(["build-integrity", await build.run()]);

  console.log("\n=== summary ===");
  let allOk = true;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) allOk = false;
  }
  console.log("");
  process.exit(allOk ? 0 : 1);
})();
