// Public frontend config. This is not a secret.
// After deploying cloudflare-worker.js, paste your Worker URL here.
// Example: window.GAMEVAULT_ORDER_API_URL = "https://hyperkey-order.yourname.workers.dev";
// The worker serves:
//   GET  /api/data     — products, categories, currency, routes (from D1)
//   GET  /api/settings — payment settings (from D1)
//   POST /             — order submission, status lookup, admin actions
// Products and settings are read from D1 only. Use the admin panel (nope.html)
// to add products, categories, and configure payment settings in the database.
window.GAMEVAULT_ORDER_API_URL = "https://wrok.kuke-6002.workers.dev/";
