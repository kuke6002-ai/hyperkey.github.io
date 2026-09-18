# HyperKey Store — System & Algorithm Documentation

> Generated from the repository source. Covers architecture, data model,
> every major algorithm/flow, the worker API surface, and deployment.

## 1. What the project is

**HyperKey Store** is a Tunisian (TND) digital-goods storefront with a
marketplace layer:

- **Catalog sales** — game keys, subscriptions, top-ups, gift cards sold
  directly by HyperKey, paid by recharge cards / e-Dinar (D17) / Flouci,
  verified **manually** by the admin.
- **Marketplace** — professional sellers (`sellers`) list products with
  `soldBy`, earn per-order commissions minus a platform fee, chat with
  buyers, request payouts.
- **Community sellers** — anyone registers with a WhatsApp number on
  `sell.html`, gets a one-time 6-char code, lists products (admin
  approves each), gets paid per delivered order via D17 payout requests.
- **Affiliates** — admin-created referrers earn per-category commission
  when referred orders are delivered; manual payouts.
- **Buyer Protection policy** (`buyer-protection.html`, EN/FR/AR) backed
  by real enforcement: per-listing warranty, 72h auto-completion,
  dispute flag that freezes payouts.

## 2. Architecture

```
Browser (static HTML + JS)              Cloudflare                     Telegram
──────────────────────────              ──────────                     ────────
32 HTML pages                           worker (cloudflare-worker.js)
  ├ app.js      (shop, i18n, cart,           ├─ Orders D1 ─────────┐
  │              checkout, status, chat)      │  orders, items,     │
  ├ admin.js    (nope.html panel)            │  affiliates,        │  Bot API:
  ├ seller.js   (seller.html)                │  sellers, public,   │  send/edit
  ├ sell.js     (sell.html community)        │  chat, payouts      │  messages,
  ├ styles.css  (theme + all UI)             ├─ Catalog D1 ────────┘  inline
  ├ config.js   (API base URL)               │  categories, products,  buttons,
  └ lang/*.json (fr/ar dictionaries)        │  marketplace_products,  callback
                                             │  store_config, settings queries
                                             └─ (GitHub API for images)
```

- **No build step, no framework.** Static files are hosted (GitHub
  Pages / custom domain `hyperkey.tn`); the user uploads
  `cloudflare-worker.js` manually via the Cloudflare dashboard
  (Workers & Pages → worker → Edit code → paste → Deploy).
  **Never use wrangler.**
- **Two D1 databases**: `getOrderDb(env)` (orders, affiliates,
  sellers, public/community, chat, payouts) and `getProductDb(env)`
  (catalog). Fresh tables/columns self-migrate through
  `ensure*Schema()` ALTERs (`duplicate column` errors are swallowed),
  mirrored in `schema.sql`.
- **All state changes go through one POST endpoint.** The frontend
  posts `{ action, ... }` JSON; the worker dispatches on `action`.
  **GET routes** (read-only): `/api/data` (catalog bundle),
  `/api/settings` (payment settings), `/api/chat-image?id=`,
  `/api/public-product-image?id=&pos=`.

## 3. Frontend pages (32 HTML)

| Page | Purpose |
|---|---|
| `index.html` | Home, featured products |
| `products.html`, `category.html`, `product.html` | Catalog browse + detail |
| `marketplace.html` | Marketplace grid (pro + community products) |
| `cart.html`, `checkout.html`, `payment.html`, `payment-guide.html` | Cart → checkout → pay |
| `order-status.html`, `order-received.html` | Track order, confirm delivery, report, chat |
| `affiliate.html`, `affiliate-info.html`, `affiliate-register.html` | Affiliate login/dashboard/info |
| `seller.html` (+ `seller/index.html` redirect) | Pro seller dashboard |
| `sell.html` | Community seller register/sell/orders |
| `nope.html` | **Admin panel** (no app.js, English-only, no footer) |
| `buyer-protection.html`, `terms.html`, `privacy.html`, `faq.html` | Policy pages (`data-policy-lang` EN/FR/AR blocks) |
| others | accounts, game-keys, gift-cards, top-ups, streaming…, 404 |

Shared conventions: Bootstrap 5.3 + Bootstrap Icons, `data-bs-theme="dark"`,
`.hk-reveal` scroll animation, `.cart-count` badge, `#cartToast`,
`?v=YYYYMMDD-N` cache-busting on every asset reference.

## 4. Data model (D1)

**Orders DB**
- `orders` — `id` (`HK-XXXXXX`), `checkout_request_id` (UNIQUE,
  idempotency), customer phone, totals, `payment_status`
  (`pending|verified|rejected` + reason), `delivery_status`
  (`waiting|delivered|cancelled` + reason), `referred_by`,
  `customer_confirmed_at`, **`delivered_at`**,
  **`disputed` (0/1)**, `dispute_reported_at`,
  **`auto_completed_at`**, `telegram_notified_at`, timestamps.
- `order_items` — lines with `product_id`, `variation_id`,
  `product_name`, `option_label`, `quantity`, prices, **`sold_by`**
  (empty = sold directly by HyperKey; drives chat availability).
- `order_deliveries` (admin gift-card codes/notes, replaced wholesale),
  `seller_deliveries` (append-only per-seller gift items),
  `order_customer_inputs` (e.g. Player ID), payment proofs.
- **Affiliates** — `affiliates` (`ref_code` PK = hyphenated name,
  `password_hash` SHA-256 via Web Crypto, `total_earnings`, `active`),
  `referral_commissions` (`order_id`, `ref_code`, `product_id?`,
  `commission_amount`, `pending|paid`), `affiliate_payouts`
  (`requested|paid|rejected`), `affiliate_sessions` (token PK).
- **Sellers** — `sellers` (`SLR-xxxx`, `display_name`, `store_name`,
  `verified`, `platform_fee_percent` default 10, `active`, admin-only
  `notes`), `seller_sessions`, `seller_earnings` (per order+product,
  `pending|paid`), `seller_payouts` (`requested|paid|rejected`).
- **Community** — `public_sellers` (phone UNIQUE, code UNIQUE),
  `public_products` (`CM-*`, stock, base64 image ≤1 MB, `approved`,
  `active`, **`warranty_days`**), `public_product_images` (up to 4),
  `public_payout_requests` (one row per order, D17 number,
  `pending|approved|rejected`).
- **Chat** — `chat_messages` (`order_id`, sender side/name,
  `message_type` text|image, `image_url`, `seller_read`,
  `customer_read`), `chat_images` (base64 ≤1 MB, served by worker).

**Catalog DB**
- `categories` (incl. **`commission_percent`**),
- `products` / `marketplace_products` — `id`, JSON **`data`**
  (`name, price, category, image(s), variations, soldBy, warrantyDays…`),
- `store_config`, `settings` (payment methods, FAQ, status copy).

## 5. Core algorithms & flows

### 5.1 Catalog load (frontend boot)

1. `app.js initSite()` fetches `/api/data` (+ settings) once.
2. Populates globals `PRODUCTS`, `MARKETPLACE_PRODUCTS` (catalog merge
   already includes approved+active community products as
   `{ community: true }`), `PRODUCT_ROUTES`, categories.
3. Language: `CURRENT_LANGUAGE` ← localStorage → `translatePage()`.
4. Cart badge, theme, navbar toggles, page-specific setup.

### 5.2 Order lifecycle (state machine)

```
submit (checkout_request_id dedupe, in-memory + DB UNIQUE)
  → payment: pending ──admin verify──▶ verified ──deliver──▶ delivered
        │                                 │                      │
        └──── admin/Telegram reject ──▶ rejected ──▶ delivery forced cancelled
        │                                                        │
        └─ customer Confirm delivery ──▶ delivered + customer_confirmed_at
        └─ 72h after delivered_at, no dispute ──▶ auto-completed
        └─ customer Report to admin ──▶ disputed=1 (freezes money + clock)
```

- **Submit**: `buildOrder()` validates stock (incl. community stock),
  prices server-side from catalog (never trusts client totals);
  `saveOrderToDatabase()` is idempotent per `checkout_request_id`;
  Telegram admin message + inline keyboard sent once
  (`telegram_notified_at`).
- **Delivery**: admin `updateAdminOrder` (sets **`delivered_at`**),
  customer `customer-confirm-delivery` (sets delivered +
  `customer_confirmed_at`, keeps first `delivered_at` via COALESCE),
  or seller gift items (`seller-save-delivery`, append-only).
  Delivery triggers `earnCommissionsForOrder` + `earnSellerForOrder`
  + community Telegram alert — all idempotent.
- **Cancel**: admin, or seller (`seller-cancel-order`, blocked once
  delivered/customer-confirmed). Chat stays open on cancelled orders.

### 5.3 Commission algorithm (affiliates)

- Tracking: `?ref=CODE` → `sessionStorage` (no cookies) → read-only
  `Referred by: code` badge at checkout → stored lowercase as
  `orders.referred_by`.
- `calculateAndSaveCommissions(orderId)` (on delivery):
  for each order line, look up product → its **category** →
  `categories.commission_percent`; skip 0%; write
  `referral_commissions` rows (`pending`). Logged with `[commission]`.
- Earnings only exist after delivery; payout = request → admin
  approve (marks matching pending commissions `paid`, FIFO against
  the amount) / reject (deducts from `total_earnings`).

### 5.4 Seller earnings algorithm

- `earnSellerForOrder(orderId)`: for each line with `sold_by` matching
  an active seller, `earnings = line_total × (1 − fee%)`, one row per
  seller/order/product (skip if exists). Status `pending` until a
  seller payout is approved → all pending flipped to `paid`.
- Deactivating a seller (`admin-toggle-seller` off) also deletes all
  `seller_sessions` — instant lockout.
- Admin seller detail uses SQL aggregates (not capped arrays):
  `COUNT(DISTINCT order_id)`, `SUM` split by pending/paid.

### 5.5 72h auto-completion (policy §9)

- Clock starts at **`delivered_at`**.
- `applyAutoCompletion(env, record)` runs at the top of
  `getOrderStatusPayload` + `getAdminOrderPayload` (i.e. on every
  order read): if `delivered` + no `customer_confirmed_at` +
  not `disputed` + `now − delivered_at ≥ 72h` → set
  `customer_confirmed_at` + **`auto_completed_at`**, re-run earnings
  (idempotent safety net). Guarded UPDATE
  (`... WHERE customer_confirmed_at IS NULL AND disputed = 0`).
- UI: customer info alert "Order completed automatically after
  72 hours"; admin badge "Completed automatically (72h)" vs
  "Customer confirmed delivery".

### 5.6 Disputes & payout withholding (policy §13)

- `customer-report-admin` (orderId + phone, 60 s cooldown) sets
  `disputed = 1` + `dispute_reported_at`, Telegram-alerts the admin
  that payouts are blocked. Dispute freezes **both** auto-completion
  and money.
- Approval-time guards (checked **before** any status UPDATE):
  - `admin-approve-payout`: throws if any *pending*
    `referral_commissions` for that affiliate JOIN a disputed order.
  - `admin-approve-seller-payout`: returns **409** if any *pending*
    `seller_earnings` JOIN a disputed order (surfaces via admin toast).
- Only `pending` money is guarded (all-or-nothing per person, no
  partial payout, no clawback of already-paid). Admin resolves via
  **Resolve dispute** button → `admin-resolve-dispute` clears the flag
  (order may then auto-complete if 72h already passed).

### 5.7 Warranty (policy §7)

- Catalog/marketplace: JSON `warrantyDays` (admin editors, 0–3650,
  omitted when 0). Community: `public_products.warranty_days`
  (clamped 0–3650, editable in sell form).
- Displayed **before payment** wherever `> 0`: marketplace card chip,
  product-page Delivery panel (`#productWarrantyText`), checkout
  per-line note — composed as
  `t("Buyer protection") + ": " + N + " " + t("days")`.
- `0` = no warranty: field omitted/hidden everywhere, nothing breaks.

### 5.8 Chat (one thread per order)

- Thread key = `orders.id`. Available only when some
  `order_items.sold_by` is non-empty.
- Auth: customer = orderId + phone; pro seller = session token +
  must own an item in the order (`sold_by` match); community seller =
  code + phone + owns a `CM-*` item; admin = read-only (+ send as
  "Admin"). Customer phone never leaks (masked as "Customer").
- Polling (10 s, no WebSocket): each side marks its own read flag on
  fetch; unread = customer messages unread by any seller (admin +
  seller badges).
- Sends: 3 s per-sender rate limit (`chatSendTimes`), ≤1000 chars,
  newlines collapsed. Photos: canvas-compressed ≤800 KB base64,
  PNG/JPG/WebP magic-byte validated, stored in `chat_images`, served
  at `/api/chat-image?id=`, shown in a JS lightbox (never a new tab).

### 5.9 Telegram webhook & inline buttons

- Webhook entry: `callback_query` → `parseTelegramAction("hk|…")`;
  guarded by `!body.action` so chat payloads (which contain a
  `message` field) never collide; admin-chat-only enforcement +
  `answerCallbackQuery` toasts.
- Order keyboard adapts to state: Verify/Reject (unverified),
  Delivered/Not-delivered + delivery-code flow (verified),
  Undo delivery (delivered). Press → `updateAdminOrder` → edit message
  in place; if edit fails (e.g. message >48h old) → send fresh copy.
- **Idempotency**: pressing a button for the already-set status
  answers "`HK-…` is already X" with no update/resend; a
  "message is not modified" edit error never triggers the resend
  fallback (race safety).
- Delivery-code flow: `pendingDeliveryOrders` → admin replies with
  keys (or `0` to clear) → `handleTelegramDeliveryReply` saves.
- Community payout messages carry Approve/Reject buttons
  (`hk|payout|…`, double-press safe, approved payouts can't be
  un-rejected).

### 5.10 i18n

- `lang/fr.json` / `lang/ar.json` (~920 keys), fetched with
  `?v=${Date.now()}` + `cache:"no-store"`.
- `translatePage()` walks text nodes + attributes (`placeholder`,
  `alt`, `title`, `aria-label`), exact-match lookup via `t()`; sets
  `documentElement.lang` and `dir="rtl"` for Arabic.
- Language toggle auto-injected into any navbar with a cart link;
  `hk-languagechange` event re-renders dynamic panes (seller/sell
  pages use `slrT`/`sellT` wrappers; worker-error strings normalized).
- Policy pages use static per-language `data-policy-lang` blocks
  (EN hidden, FR/AR shown), toggled by
  `updateLocalizedPolicyBlocks()` — the walker skips them.
- `nope.html` (admin) and seller pages are English-only.

### 5.11 Auth & validation

- Admin: token (`requireAdmin` / `requireTelegramWebhook` for the bot).
- Pro sellers: password (SHA-256) → `seller_sessions` token in
  sessionStorage. Affiliates: code + password (SHA-256) → token.
- Community: phone + 6-char code, no password.
- Customers: orderId + phone per request (no accounts).
- Phones: Tunisian 8-digit (`validatePhone`), normalized
  (`+216`/`00216` variants in lookups). Product images ≤1 MB.

### 5.12 Cache-busting & deployment

- Every asset URL carries `?v=YYYYMMDD-N`; any JS/CSS change ⇒ bump
  the version string in **every** HTML file referencing it
  (scripted), then hard-refresh (Ctrl+F5).
- Favicons, dict JSONs need no bump (fresh fetch / new reference).
- Deploy = manual: paste worker via Cloudflare dashboard; push static
  files to the host. DB migrations run automatically on first request
  after a worker deploy.

## 6. Worker API surface (POST `action`)

- **Orders**: `order-status`, `customer-confirm-delivery`,
  `customer-report-admin`, `customer-input`, `chat-*`
- **Admin**: `admin-verify`, `admin-list-orders`, `admin-update-order`,
  `admin-save-delivery`, `admin-delete-order`,
  `admin-resolve-dispute`, `admin-save-data`, `admin-save-settings`,
  `admin-upload-image`, `admin-chat-*`, affiliate/seller/public
  list・create・update・toggle・delete・detail, `admin-approve-payout`,
  `admin-approve-seller-payout`, `admin-set-affiliate-balance`,
  `admin-delete-seller-deliveries`
- **Affiliates**: `affiliate-register` (admin-side create),
  `affiliate-login/logout/stats/request-payout`
- **Sellers**: `seller-login/logout/stats/products/product-save/
  product-delete/upload-image/save-delivery/get-delivery/orders/
  cancel-order/request-payout`, `seller-chat-*`
- **Community**: `public-seller-register/login/orders`,
  `public-product-create/update/delete`, `public-request-payout`,
  `public-chat-*`, `public-seller-chat-unread`

## 7. Key files

| File | Role |
|---|---|
| `cloudflare-worker.js` | All backend logic (~5.7k lines) |
| `schema.sql` | D1 reference schema |
| `app.js` | Shop frontend, i18n, cart, checkout, status, chat |
| `admin.js` / `nope.html` | Admin panel (no app.js) |
| `seller.js` / `seller.html` | Pro seller dashboard |
| `sell.js` / `sell.html` | Community sellers |
| `affiliate.html` | Affiliate dashboard |
| `buyer-protection.html` | Buyer Protection policy (EN/FR/AR) |
| `styles.css` | All styling incl. chat, cards, responsive |
| `config.js` | Worker base URL |
| `lang/fr.json`, `lang/ar.json` | Translations |
| `AGENTS.md` | Session log (goals, constraints, history) |
