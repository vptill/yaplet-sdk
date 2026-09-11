/**
 * Test-net runner. Runs the two guards and exits nonzero if either fails.
 * This is what `npm test` invokes.
 *
 *   node test/run.js            # check
 *   node test/run.js --update   # re-record the golden-effects transcript
 *                               # (only ever on a bundle you have verified by hand)
 *
 * The guards:
 *   1. api-surface     — index.d.ts describes exactly the built bundle's public
 *                        methods (no phantom types, nothing shipped undeclared).
 *                        Baseline-free: it compares two live artifacts.
 *   2. golden-effects  — boots the built SDK in jsdom against canned responses,
 *                        runs a scripted scenario of public calls, and diffs the
 *                        outbound effects (iframe postMessages, XHR, injected DOM)
 *                        against a recorded transcript. The behavioral gate.
 *
 * Whether the bundle compiles at all is answered by `npm run build`, which you
 * run before publishing anyway — there is no separate build guard.
 *
 * CSS/visual verification and the demo smoke matrix are manual and live outside
 * this runner.
 */
const update = process.argv.includes("--update");
const surface = require("./api-surface");
const effects = require("./golden-effects");

(async () => {
  const results = [];
  console.log(`\n=== Yaplet SDK test net ${update ? "(UPDATE baselines)" : "(check)"} ===\n`);

  console.log("[1/2] api-surface");
  results.push(["api-surface", await Promise.resolve(surface.run())]);

  console.log("\n[2/2] golden-effects");
  results.push(["golden-effects", await effects.run()]);

  console.log("\n=== summary ===");
  let allOk = true;
  for (const [name, ok] of results) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) allOk = false;
  }
  console.log("");
  process.exit(allOk ? 0 : 1);
})();
