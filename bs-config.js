/**
 * Browser-Sync configuration for yaplet-sdk development.
 *
 * Serves demo/ as the root and mounts build/ at /build so that
 * <script src="build/cjs/index.js"> in demo/index.html resolves correctly.
 *
 * Watches build/cjs/index.js for changes (triggered by webpack --watch)
 * and auto-reloads the browser.
 */
module.exports = {
  server: {
    baseDir: "demo",
    routes: {
      "/build": "build",
    },
  },
  files: ["build/cjs/index.js"],
  port: 4444,
  open: false,
  notify: false,
  ui: false,
  // Small delay to let webpack finish writing the file
  reloadDelay: 300,
};
