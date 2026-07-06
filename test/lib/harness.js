/**
 * Shared test harness for the Yaplet SDK dead-code cleanup net.
 *
 * Loads a built UMD bundle (build/cjs/core.js | full.js) into a jsdom window,
 * with browser APIs the SDK touches stubbed so it neither hits the network nor
 * hangs. Two entry points:
 *
 *   loadYaplet(bundlePath)       -> just eval the bundle, return window.Yaplet
 *                                   (used by the API-surface guard — no init).
 *   runEffectsScenario(path, fn) -> boot the SDK against canned XHR responses,
 *                                   drive the real iframe "ping" handshake so
 *                                   sendMessage() actually fires, run fn() with
 *                                   a recorder, and return the captured
 *                                   outbound effects (postMessages + XHR + DOM).
 *
 * No live backend, no live iframe, no CI — everything is local + deterministic.
 */
const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const FRAME_ORIGIN = "https://embed.yaplet.com";

/** Create a jsdom window with the browser bits the SDK expects. */
function createDom() {
  const jsdomErrors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => jsdomErrors.push(e && (e.detail || e.message || String(e))));
  const dom = new JSDOM(
    `<!DOCTYPE html><html><head></head><body></body></html>`,
    {
      // Page origin == the widget iframe origin (embed.yaplet.com) so jsdom
      // gives the injected iframe a real, same-origin contentWindow whose
      // postMessage we can wrap. Cross-origin would leave contentWindow
      // inaccessible and every sendMessage would silently drop.
      url: FRAME_ORIGIN + "/",
      referrer: FRAME_ORIGIN + "/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      storageQuota: 10_000_000,
      virtualConsole: vc,
    }
  );
  dom.jsdomErrors = jsdomErrors;
  const win = dom.window;

  // jsdom gaps the SDK reads defensively but which must at least exist.
  if (typeof win.matchMedia !== "function") {
    win.matchMedia = () => ({
      matches: false,
      media: "",
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (typeof win.requestIdleCallback !== "function") {
    win.requestIdleCallback = (cb) => win.setTimeout(() => cb({ timeRemaining: () => 0, didTimeout: true }), 0);
    win.cancelIdleCallback = (id) => win.clearTimeout(id);
  }
  if (typeof win.scrollTo !== "function") win.scrollTo = () => {};
  win.focus = () => {};
  win.open = () => null;

  return dom;
}

/**
 * Execute the UMD bundle inside the jsdom window via a real <script> element so
 * webpack's `publicPath:"auto"` runtime finds `document.currentScript` (a bare
 * win.eval leaves currentScript null and the bundle throws). Requires the dom to
 * be created with runScripts:"dangerously".
 */
function injectBundle(win, src) {
  const doc = win.document;
  // Webpack's auto-publicPath runtime scans document.scripts for one with an
  // http(s) src and throws "Automatic publicPath is not supported" if none is
  // found. Add a decoy with such a src (never fetched — resources are off) so
  // the scan resolves. publicPath ends up as the decoy's dir, irrelevant here
  // since the surface/effects scenarios don't lazy-load chunks.
  if (!doc.getElementById("__yaplet_pp_decoy__")) {
    const decoy = doc.createElement("script");
    decoy.id = "__yaplet_pp_decoy__";
    decoy.src = "https://sdk.yaplet.test/yaplet.js";
    doc.head.appendChild(decoy);
  }
  const script = doc.createElement("script");
  script.textContent = src;
  doc.head.appendChild(script);
}

/**
 * Install a recording XMLHttpRequest that never touches the network and
 * returns canned responses keyed by "METHOD path-suffix".
 */
function installFakeXHR(win, records) {
  const responders = {
    "POST /sdk/sessions": () => ({
      status: 200,
      body: JSON.stringify({
        yapletId: "vis_TEST",
        yapletHash: "hash_TEST",
        userId: null,
        unreadCount: 0,
        hasQueuedItems: false,
        config: sampleFlowConfig(),
      }),
    }),
    "GET /sdk/config": () => ({
      status: 200,
      body: JSON.stringify({ flowConfig: sampleFlowConfig(), aiTools: [] }),
    }),
  };

  class FakeXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = "";
      this._headers = {};
      this.timeout = 0;
      this.onreadystatechange = null;
      this.ontimeout = null;
      this.onerror = null;
      this.onload = null;
      this.upload = {};
    }
    open(method, url) {
      this._method = method;
      this._url = url;
    }
    setRequestHeader(k, v) {
      this._headers[k] = v;
    }
    getAllResponseHeaders() {
      return "";
    }
    getResponseHeader() {
      return null;
    }
    abort() {}
    send(body) {
      records.xhr.push({
        method: this._method,
        url: normalizeUrl(this._url),
        body: safeParse(body),
      });
      const key = this._method + " " + suffixOf(this._url);
      const responder = responders[key];
      const res = responder ? responder() : { status: 200, body: "{}" };
      // Resolve on next tick like a real async XHR.
      win.setTimeout(() => {
        this.readyState = 4;
        this.status = res.status;
        this.responseText = res.body;
        this.response = res.body;
        if (typeof this.onreadystatechange === "function") this.onreadystatechange();
        if (typeof this.onload === "function") this.onload();
      }, 0);
    }
  }
  win.XMLHttpRequest = FakeXHR;
}

/** Stub WebSocket (StreamedEvent opens one on init) so nothing dials out. */
function installFakeWebSocket(win, records) {
  class FakeWS {
    constructor(url) {
      records.ws.push({ url: normalizeUrl(url) });
      this.url = url;
      this.readyState = 0;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
      // Never actually "open" — leave it CONNECTING so no heartbeat traffic fires.
    }
    send() {}
    close() {
      this.readyState = 3;
    }
    addEventListener() {}
    removeEventListener() {}
  }
  FakeWS.CONNECTING = 0;
  FakeWS.OPEN = 1;
  FakeWS.CLOSING = 2;
  FakeWS.CLOSED = 3;
  win.WebSocket = FakeWS;
}

/**
 * Load a bundle into a fresh jsdom and return { dom, win, Yaplet }.
 * Does NOT initialize — used by the surface guard.
 */
function loadYaplet(bundlePath) {
  const dom = createDom();
  const win = dom.window;
  const records = emptyRecords();
  installFakeXHR(win, records);
  installFakeWebSocket(win, records);
  injectBundle(win, fs.readFileSync(bundlePath, "utf8"));
  return { dom, win, Yaplet: win.Yaplet, records };
}

function emptyRecords() {
  return { postMessages: [], xhr: [], ws: [], console: [], domSurfaces: [] };
}

/**
 * Boot the SDK with canned responses, complete the iframe ping handshake so
 * sendMessage() fires for real, then run `scenario(Yaplet, ctx)` and return the
 * recorded outbound effects.
 */
async function runEffectsScenario(bundlePath, scenario) {
  const dom = createDom();
  const win = dom.window;
  const records = emptyRecords();
  installFakeXHR(win, records);
  installFakeWebSocket(win, records);

  // Capture console.* the SDK emits (normalized, order preserved).
  ["log", "warn", "error", "info"].forEach((level) => {
    const orig = win.console[level];
    win.console[level] = (...args) => {
      records.console.push({ level, msg: args.map(String).join(" ") });
      if (orig) orig.apply(win.console, args);
    };
  });

  injectBundle(win, fs.readFileSync(bundlePath, "utf8"));
  const Yaplet = win.Yaplet;

  Yaplet.initialize("TESTSDKKEY");
  await flush(win, 20);

  // The widget iframe is injected lazily on first open() — force it to mount so
  // there is a same-origin contentWindow to record. (Also what a real visitor
  // clicking the launcher does.)
  Yaplet.open();

  // Wrap the iframe's postMessage sink as soon as it appears, so every
  // SDK→iframe message is recorded.
  const wrapFrame = () => {
    const frame = win.document.querySelector(".yaplet-frame");
    if (frame && frame.contentWindow && !frame.__yapletWrapped) {
      frame.__yapletWrapped = true;
      frame.contentWindow.postMessage = (raw) =>
        records.postMessages.push(normalizePayload(safeParse(raw)));
    }
    return !!(frame && frame.__yapletWrapped);
  };

  let wrapped = false;
  for (let i = 0; i < 120 && !wrapped; i++) {
    await new Promise((r) => win.setTimeout(r, 0));
    wrapped = wrapFrame();
  }

  // Simulate the widget bundle booting inside the iframe: the "ping" flips
  // comReady and flushes the queued config/session updates.
  win.dispatchEvent(
    new win.MessageEvent("message", {
      data: JSON.stringify({ name: "ping", shouldOpen: false }),
      origin: FRAME_ORIGIN,
    })
  );
  await flush(win, 10);
  wrapFrame();

  // Scope the transcript to the scripted scenario: drop the init/open/ping
  // handshake noise (canned + volatile) so the golden diff reflects exactly what
  // the live API methods emit.
  records.postMessages.length = 0;

  const ctx = { win, records, frameInjected: wrapped };
  await scenario(Yaplet, ctx);
  await flush(win, 20);

  // Snapshot the host-page DOM surfaces the SDK injected (class list only —
  // stable, unlike full innerHTML).
  records.domSurfaces = Array.from(win.document.body.children)
    .map((el) => el.className)
    .filter((c) => typeof c === "string" && c.indexOf("yaplet") !== -1)
    .sort();
  records.jsdomErrors = dom.jsdomErrors.slice();

  return records;
}

/** Run pending timers/microtasks a few times to let async settle. */
async function flush(win, ticks) {
  for (let i = 0; i < ticks; i++) {
    await new Promise((r) => win.setTimeout(r, 0));
  }
}

// ---- normalization (kill volatile fields so goldens are stable) ----

const VOLATILE_KEYS = new Set([
  "time",
  "client_session_id",
  "clientSessionId",
  "sessionDuration",
  "snapshotPosition",
  "yapletHash",
  "yapletId",
  "access_token",
  "ws",
  "sdkVersion",
  "referrer",
  "url",
  "events",
]);

function normalizePayload(obj) {
  return deepNormalize(obj);
}

function deepNormalize(v) {
  if (Array.isArray(v)) return v.map(deepNormalize);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      out[k] = VOLATILE_KEYS.has(k) ? "<volatile>" : deepNormalize(v[k]);
    }
    return out;
  }
  return v;
}

function sampleFlowConfig() {
  return {
    primaryColor: "#485BFF",
    headerColor: "#485BFF",
    buttonColor: "#485BFF",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    buttonX: 20,
    buttonY: 20,
    feedbackButtonPosition: "BOTTOM_RIGHT",
    enableWebReplays: false,
    enableNetworkLogs: false,
    hideForGuests: false,
    enableConsoleLogs: false,
  };
}

function suffixOf(url) {
  const s = normalizeUrl(url);
  const idx = s.indexOf("/sdk/");
  return idx === -1 ? s : s.slice(idx);
}

function normalizeUrl(url) {
  if (!url) return "";
  return String(url).replace(/\?.*$/, "");
}

function safeParse(s) {
  if (typeof s !== "string") return s ?? null;
  try {
    return JSON.parse(s);
  } catch (e) {
    return s;
  }
}

module.exports = {
  loadYaplet,
  runEffectsScenario,
  FRAME_ORIGIN,
};
