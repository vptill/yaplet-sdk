# Yaplet SDK

The client-side JavaScript SDK for [Yaplet](https://www.yaplet.com) — live chat, AI
chatbot, surveys, product tours, screenshots & bug reports, session replay,
notifications and banners. It injects a small host-page layer and renders the
chat UI inside an iframe served from `embed.yaplet.com`.

> **Source of truth for the public API is [`index.d.ts`](./index.d.ts).** It is
> kept in exact sync with the built bundle by the test net (see below), so it is
> the authoritative list of supported methods and signatures.

---

## Installing

### 1. Embed script (what customers use)

Paste the install snippet from your Yaplet dashboard. It stubs the API as a queue
and then loads the bundle from the CDN:

```html
<script>
  // …generated snippet: sets window.Yaplet as a queue, then loads the loader…
</script>
```

The snippet is **safe against API drift**: every stubbed call is pushed onto
`window.YapletActions` and flushed **behind a guard** once the bundle loads
(`if (GLAction && GLAction.e && Yaplet[GLAction.e])`), so a queued call to a method
that no longer exists silently no-ops instead of throwing.

Then call it:

```js
Yaplet.initialize("YOUR_SDK_KEY");
// userHash = HMAC-SHA256 of the user id, computed on YOUR server with the
// widget's identity secret (dashboard → Widgets → Embed → Identity verification).
// identify() calls without a valid hash are rejected.
Yaplet.identify("user-123", { name: "Ada", email: "ada@example.com" }, userHash);
```

### 2. Git dependency (how Yaplet's own frontend consumes it)

```jsonc
// package.json
"yaplet": "github:vptill/yaplet-sdk#master"
```

On install, the `prepare` script runs `npm run build`, regenerating `build/`
(which is **not** committed — see below). The package `main` points at the
**full** build.

---

## Two bundles: `core` vs `full`

| Bundle | Contents | Size (min) |
| --- | --- | --- |
| `core.js` | Everything **except** rrweb session replay | ~271 KB |
| `full.js` | Core **+** rrweb session replay | ~463 KB |

The CDN serves **core** by default and **full** only when the widget has
`config.enableWebReplays` set.

> **⚠️ The `index` filename is intentionally inverted between the two consumers:**
> - **npm/git dependency:** package `main` → `build/cjs/index.js` = the **full**
>   build (backwards-compatible: bundlers get replay).
> - **CDN:** `published/index.js` = the **core** build (via `copyBuildPlugin`'s
>   `core.js → index.js` remap), so customers get the smaller bundle by default.
>
> So "`index`" means *full* to a bundler and *core* on the CDN. This is deliberate;
> don't "fix" it.

---

## Public API (summary)

The complete, authoritative signatures live in [`index.d.ts`](./index.d.ts). Grouped:

- **Lifecycle:** `initialize(sdkKey)`, `destroy()`, `open()`, `close()`, `hide()`,
  `isOpened()`, `getInstance()`.
- **Identity:** `identify(userId, customerData, userHash)` (userHash required — HMAC of the
  user id signed server-side with the widget's identity secret), `updateContact(customerData)`,
  `clearIdentity()`, `getIdentity()`, `isUserIdentified()`.
- **Custom data:** `attachCustomData()`, `setCustomData()`, `setTicketAttribute()`,
  `removeCustomData()`, `clearCustomData()`.
- **Conversations / bot:** `startBot()`, `startConversation()`, `openConversation()`.
- **Content deep-links:** `openHelpCenterArticle()`, `openHelpCenterCollection()`,
  `openNewsArticle()`.
- **Feedback / surveys:** `startFeedbackFlow()`, `startFeedbackFlowWithOptions()`,
  `startClassicForm()`, `showSurvey()`, `setFlowConfig()`,
  `sendSilentCrashReport()`, `sendSilentCrashReportWithFormData()`.
- **Product tours:** `startProductTour()`, `startProductTourWithConfig()`,
  `checkForTourResume()`.
- **Events:** `trackEvent()`, `on()`, `log()`. *(`logEvent()` is a deprecated alias of
  `trackEvent()`.)*
- **Network / replay:** `startNetworkLogger()`, `setNetworkLogsBlacklist()`,
  `setNetworkLogPropsToIgnore()`, `attachNetworkLogs()`, `setMaxNetworkRequests()`,
  `setReplayOptions()`.
- **AI tools:** `setAiTools()`.
- **UI / config:** `setStyles()`, `showFeedbackButton()`, `setLanguage()`,
  `setEnvironment()`, `setUseCookies()`, `disableConsoleLogOverwrite()`,
  `enableShortcuts()`, `setUrlHandler()`, plus dev URL setters `setApiUrl()`,
  `setWSApiUrl()`, `setFrameUrl()`, `setAdminUrl()`.
- **Notifications / banners:** `showBanner()`, `closeBanner()`, `setBannerUrl()`,
  `showNotification()`, `showTabNotificationBadge()`, `playSound()`.
- **App metadata:** `setAppBuildNumber()`, `setAppVersionCode()`, `setTags()`,
  `setOfflineMode()`, `setDisableInAppNotifications()`, `setDisablePageTracking()`,
  `checkForUrlParams()`.
- **Custom actions:** `registerCustomAction()`, `triggerCustomAction()`.

### `setLanguage()` also switches the chat widget

`setLanguage("hu")` sets the language of the SDK's own texts **and of the chat widget
inside the iframe** — its whole interface, the status lines in a conversation, and
whatever of the greeting, cards and buttons the widget's owner has translated.

The widget speaks nine languages: `en`, `de`, `es`, `fr`, `pt`, `it`, `nl`, `pl`, `hu`.
Only the two-letter prefix is read, so `hu` and `hu-HU` are the same request. A language
the widget does not speak leaves it in the brand's own language rather than dropping it
to English.

The language reaches the widget two ways, and both are needed. The iframe URL gains
`&lang=<code>` when the frame is injected — that is what lets the widget open in the
right language on its very first frame, with no flash of the brand's language.
`overrideLanguage` on the `config-update` message is the fallback for host pages still
serving an older SDK bundle, where the language can only arrive after the widget has
painted. Calling `setLanguage()` on an already-running SDK re-injects the frame, so that
path uses the URL too.

A visitor who picks a language themselves, in the widget's own selector (the globe on
its home screen), keeps that choice — it outranks `setLanguage()`.

---

## Architecture (short version)

- Every subsystem is a singleton `Manager` accessed via `static getInstance()`; the
  `Yaplet` class is a thin static façade over them.
- The **chat UI is a separate SolidJS app inside an iframe** (`embed.yaplet.com`).
  The SDK talks to it with `postMessage` (10 commands out) and listens for a reverse
  channel (`FrameManager`) that drives the live **screenshot / bug-report** pipeline.
  **CSS never crosses the iframe boundary** — `UI.js` styles only the host-page
  elements the SDK itself injects (launcher button, notifications, banners, tour
  overlays, screenshot editor).
- Host-page overlays that the iframe can't render (product tours, the screenshot
  annotation editor) are drawn directly by the SDK.

---

## Development

```bash
npm start          # dev server on http://localhost:4444 (serves demo/, HMR)
npm run build      # production build → build/{cjs,esm} and published/
npm test           # run the test net (see below)
npm run test:update  # recapture the test-net baselines (only on a known-good bundle)
```

### Test net

`npm test` runs two local guards (jsdom-based, no live backend/iframe, no CI) —
see [`test/`](./test). Run it against a fresh `npm run build`, since both guards
read `build/cjs/`:

1. **`api-surface`** — loads `core.js`/`full.js` and asserts that
   [`index.d.ts`](./index.d.ts) declares *exactly* the public static methods the
   bundle really has: no phantom declaration (typed here, gone from the bundle —
   TypeScript consumers compile green and crash at runtime) and nothing shipped
   undeclared. Baseline-free — it compares two live artifacts, so it never needs
   recapturing. Add or remove a public method and update `index.d.ts` in the same
   commit.
2. **`golden-effects`** — boots the SDK against canned responses, completes the
   iframe `ping` handshake so `sendMessage` fires for real, runs a scripted
   scenario of live methods ([`test/lib/scenario.js`](./test/lib/scenario.js)),
   and diffs the recorded outbound effects (postMessages, XHR, injected DOM)
   against a golden transcript. This is the behavioral-equivalence gate for
   refactors, and the one thing to run before publishing.

The golden transcript lives in [`test/__baseline__/effects.json`](./test/__baseline__).
`npm run test:update` rewrites it — only ever do that on a bundle you have
verified by hand, because re-recording throws away the evidence that nothing broke.

Whether the bundle compiles and emits its assets is answered by `npm run build`,
which you run before publishing anyway; there is no separate build guard.

---

## Deploying

The CDN (`sdk.yaplet.com`) is a **Cloudflare Pages project connected to this repo**
(`vptill/yaplet-sdk`). It **auto-deploys on push to `master`** — Cloudflare runs the
build command `npm run build` (which emits `published/` via the post-build copy step)
and serves `published/`. So **merging to `master` and pushing is the whole deploy**;
there is no manual deploy step or deploy hook.

- Pushing a non-`master` branch produces a **preview** deployment, not production.
- To force a redeploy without a code change: Cloudflare dashboard → **Workers & Pages
  → yaplet-sdk → Deployments → Retry deployment**.

`build/` is **not** committed (regenerated by `prepare`/`build`). `published/` is
regenerated by Cloudflare's build on every deploy, so it never needs hand-updating.
