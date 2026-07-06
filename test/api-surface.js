/**
 * API-surface guard.
 *
 * Loads the built core.js + full.js in jsdom and snapshots the public static
 * method surface of window.Yaplet. The primary defense against the #1 cleanup
 * bug — accidentally deleting a still-used method.
 *
 *   node test/api-surface.js            # check against baseline (exit 1 on fail)
 *   node test/api-surface.js --update   # (re)capture the baseline
 *
 * Ratchet: every method that disappears vs the baseline must be listed in
 * KNOWN_DEAD (the methods this cleanup intentionally removes). Any other
 * removal, or any HARD_KEEP method going missing, or any surprise addition,
 * fails the guard.
 */
const fs = require("fs");
const path = require("path");
const { loadYaplet } = require("./lib/harness");

const BUNDLES = ["core.js", "full.js"];
const BASELINE = path.resolve(__dirname, "__baseline__", "surface.json");

// Methods the SDK's live consumers (Yaplet frontend, embed snippets, docs)
// depend on. If any of these vanish, the guard fails hard.
const HARD_KEEP = [
  "initialize", "destroy", "getInstance", "open", "close", "hide", "isOpened",
  "identify", "updateContact", "clearIdentity", "getIdentity", "isUserIdentified",
  "attachCustomData", "setCustomData", "setTicketAttribute", "removeCustomData", "clearCustomData",
  "startFeedbackFlow", "startFeedbackFlowWithOptions", "showSurvey", "setFlowConfig",
  "startBot", "startConversation", "openConversation",
  "openNewsArticle", "openHelpCenterArticle",
  "startProductTour", "startProductTourWithConfig",
  "trackEvent", "log", "on",
  "startNetworkLogger", "setNetworkLogsBlacklist", "setNetworkLogPropsToIgnore",
  "attachNetworkLogs", "setMaxNetworkRequests", "setReplayOptions",
  "setAiTools", "setStyles", "showFeedbackButton", "setLanguage", "setEnvironment",
  "setApiUrl", "setWSApiUrl", "setFrameUrl", "setAdminUrl", "setUseCookies",
  "disableConsoleLogOverwrite", "enableShortcuts", "setUrlHandler",
  "showBanner", "closeBanner", "setBannerUrl", "showNotification",
  "showTabNotificationBadge", "playSound",
  "setAppBuildNumber", "setAppVersionCode", "setTags", "setOfflineMode",
  "setDisableInAppNotifications", "setDisablePageTracking", "checkForUrlParams",
  "registerCustomAction", "triggerCustomAction",
];

// Methods this cleanup intentionally removes. Grows per wave.
// Methods intentionally removed vs the committed baseline. Empty in the steady
// state — the baseline was captured on the current surface. If you deliberately
// remove a method later, add its name here AND re-run `npm run test:update`;
// otherwise the guard flags it as an unexpected removal.
const KNOWN_DEAD = [];

function surfaceOf(bundleFile) {
  const p = path.resolve(__dirname, "..", "build", "cjs", bundleFile);
  const { Yaplet } = loadYaplet(p);
  if (!Yaplet) throw new Error(`${bundleFile}: window.Yaplet is undefined after load`);
  return Object.getOwnPropertyNames(Yaplet)
    .filter((n) => typeof Yaplet[n] === "function")
    .sort();
}

function capture() {
  const out = {};
  for (const b of BUNDLES) out[b] = surfaceOf(b);
  return out;
}

/**
 * The published index.d.ts must describe EXACTLY the real bundle surface — no
 * phantom declarations (a deleted method still typed), no undeclared methods.
 * This keeps the typed exports honest as the surface evolves.
 */
function checkDts(bundleSurface) {
  const dtsPath = path.resolve(__dirname, "..", "index.d.ts");
  if (!fs.existsSync(dtsPath)) {
    console.log("api-surface: index.d.ts not found");
    return false;
  }
  const dts = fs.readFileSync(dtsPath, "utf8");
  const declared = new Set(
    [...dts.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1])
  );
  const bundle = new Set(bundleSurface);
  const phantom = [...declared].filter((m) => !bundle.has(m)).sort();
  const undeclared = [...bundle].filter((m) => !declared.has(m)).sort();
  let ok = true;
  if (phantom.length) {
    ok = false;
    console.log(`api-surface[d.ts] FAIL — declared but not in bundle (phantom): ${phantom.join(", ")}`);
  }
  if (undeclared.length) {
    ok = false;
    console.log(`api-surface[d.ts] FAIL — in bundle but undeclared in index.d.ts: ${undeclared.join(", ")}`);
  }
  if (ok) console.log(`api-surface[d.ts] OK — ${declared.size} declarations match the bundle surface`);
  return ok;
}

function run() {
  const update = process.argv.includes("--update");
  const current = capture();

  if (update) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    console.log("api-surface: baseline updated");
    for (const b of BUNDLES) console.log(`  ${b}: ${current[b].length} methods`);
    return true;
  }

  if (!fs.existsSync(BASELINE)) {
    console.log("api-surface: NO BASELINE — run with --update first");
    return false;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));

  let ok = true;
  for (const b of BUNDLES) {
    const cur = new Set(current[b] || []);
    const base = new Set(baseline[b] || []);
    const removed = [...base].filter((m) => !cur.has(m));
    const added = [...cur].filter((m) => !base.has(m));
    const missingKeep = HARD_KEEP.filter((m) => !cur.has(m));
    const badRemovals = removed.filter((m) => !KNOWN_DEAD.includes(m));

    if (missingKeep.length) {
      ok = false;
      console.log(`api-surface[${b}] FAIL — HARD_KEEP methods missing: ${missingKeep.join(", ")}`);
    }
    if (badRemovals.length) {
      ok = false;
      console.log(`api-surface[${b}] FAIL — unexpected removals (not in KNOWN_DEAD): ${badRemovals.join(", ")}`);
    }
    if (added.length) {
      ok = false;
      console.log(`api-surface[${b}] FAIL — unexpected additions: ${added.join(", ")}`);
    }
    if (missingKeep.length === 0 && badRemovals.length === 0 && added.length === 0) {
      const note = removed.length ? ` (removed as planned: ${removed.join(", ")})` : "";
      console.log(`api-surface[${b}] OK — ${cur.size} methods${note}`);
    }
  }
  // index.d.ts must match the built surface (full.js is the superset).
  if (!checkDts(current["full.js"] || [])) ok = false;
  return ok;
}

if (require.main === module) {
  process.exit(run() ? 0 : 1);
}
module.exports = { run, capture, HARD_KEEP, KNOWN_DEAD };
