# Session Log

## Goal
- Build a referral/affiliate program where customers earn commissions by promoting products, with admin-managed affiliates, per-category commission rates, and manual payouts.

## Constraints & Preferences
- Affiliates created by admin only (no self-signup), codes auto-generated from name with hyphen format (e.g., `sara-ben-ali`) and numeric suffix for duplicates
- Admin sets each affiliate's password (plain text, hashed with SHA-256 on worker)
- Affiliate logs in via code + password on `affiliate.html` to view stats and request payouts
- No cookies for tracking; link sets `?ref=CODE` → captured in sessionStorage, shown read-only at checkout (`Referred by: code`)
- Per-category commission (set via category editor, stored in `categories.commission_percent`), calculated when admin marks order as delivered
- Payouts manual: affiliate requests → admin approves/rejects in panel
- Affiliate code IS the display name shown to customers (no separate lookup)

## Progress
### Done
- `schema.sql`: added `referred_by` column to `orders`, created `affiliates`, `referral_commissions`, `affiliate_payouts` tables with indexes
- `cloudflare-worker.js`: added `ensureAffiliateSchema()`, `calculateAndSaveCommissions()`, affiliate CRUD & login/stats/payout handler functions, admin affiliate/payout actions (`admin-list-affiliates`, `admin-create-affiliate`, `admin-toggle-affiliate`, `admin-list-payouts`, `admin-approve-payout`), modified `buildOrder`/`saveOrderToDatabase`/`updateAdminOrder`/`getOrderStatusPayload`/`getAdminOrderPayload`/`listAdminOrders`/`getOrderById`/`getOrderByIdAndPhone` to pass/store/display `referred_by`, modified GET router, added affiliate action dispatch in `handleOrder`
- `app.js`: added `REFERRAL_KEY`, `captureReferralFromUrl()`, `getReferralCode()`, `clearReferralCode()`, `showReferralBadge()`, modified `setupCheckoutForm` to include `referredBy` in session, modified `submitPaymentOrder` to send `referredBy`, added `captureReferralFromUrl()` and `showReferralBadge()` calls in `initSite()`, added Affiliate link to footer
- `checkout.html`: added referral badge `<div id="referralBadge">` (hidden by default, shown via `showReferralBadge()`)
- `nope.html`: added Affiliates and Payouts tab nav items, added Affiliates and Payouts tab panes with form elements and container divs
- `admin.js`: added `commissionPercent` field to category editor and save flow (`updateCategory` normalizes to number, `validateCategories` enforces it), added `referredBy` display to admin order cards, added `referredBy` to order search filter, added `loadAdminAffiliates()`, `createAdminAffiliate()`, `toggleAdminAffiliate()`, `loadAdminPayouts()`, `approveAdminPayout()` functions, added event listeners for affiliate/payout buttons
- `affiliate.html`: created full login + dashboard page with stats cards, referral link copy, payout request form, commission & payout history tables
- `styles.css`: added affiliate page styling (`.admin-affiliates-list`, `.admin-payouts-list`, `#affiliateDashboardSection .content-panel`, `#affiliateLoginSection .content-panel`, dark mode variants)
- Bumped cache-busting versions: `app.js`, `styles.css`, `admin.js` → `v=20260630-1` across all 22 HTML files
- Fixed `getOrderByCheckoutRequestId`: added missing `referred_by` to SELECT
- Fixed `admin.js` `updateCategory` to normalize `commissionPercent` to number, added `change` event fallback, added `validateCategories()` call before save
- Fixed `cloudflare-worker.js` `handleAdminSaveData` to check `db.batch()` results for errors (D1 silently returns success on failed statements)
- Fixed `handleAdminSaveSettings` to check `db.run()` result for `success`
- Added `ICONS.link` emoji to Telegram message icons
- Added `Referred by:` line to Telegram admin notifications via `formatAdminMessage`
- Added `referredBy` to `getSavedOrderForNotification` return object
- Added `referral_commissions` cleanup to `deleteAdminOrder`
- Fixed `buildOrder` and `captureReferralFromUrl` to lowercase `referredBy` (case mismatch prevented commission lookup)
- Fixed `calculateAndSaveCommissions` to check `db.batch()` results for errors
- Added extensive `[commission]` prefixed console.log debugging to `calculateAndSaveCommissions` (logs every step: affiliate lookup, catMap contents, per-item product.category/commissionPercent/amount, batch results)
- Added `[admin-save]` prefixed console.log to `handleAdminSaveData` categories section (logs each category name + commissionPercent value before INSERT)
- Added success log to `handleAdminSaveData` with count of saved categories/products
- **Admin page density reduction**: removed page title description, replaced order status pill buttons with `<select>` dropdown, removed order notice, removed verbose descriptions across categories/import/export/settings panes, removed WhatsApp delivery card, hid 3-column product preview by default with toggle button, removed dead CSS rules (`.admin-order-notice`, `.admin-order-status-tabs`, `.admin-help-card`, `.admin-provider-static`), fixed admin navbar dark mode parity, cleaned up aggressive font weights across admin CSS

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Affiliate code = display name (hyphenated lowercase, e.g., `sara-ben-ali`) no separate lookup needed at checkout
- sessionStorage over cookies for referral tracking (ephemeral, cleared on tab close)
- Commission only triggers on delivery (not on order placement or payment)
- Per-category commission rates (set via category editor, stored in `categories.commission_percent`), calculated using product's category

## Critical Context
- Worker uses two D1 databases: `getOrderDb(env)` for orders/affiliates, `getProductDb(env)` for catalog data
- `calculateAndSaveCommissions` reads `commissionPercent` from category data via `readAllCategories(env)`, uses product's category to look up the rate, skips categories with 0%
- Affiliate passwords hashed with SHA-256 on the worker (no bcrypt — using Web Crypto API `crypto.subtle.digest`)
- Code auto-generation: `name.toLowerCase().replace(/[^a-z0-9]+/g, "-")` with numeric suffix on duplicates
- Phone validation uses the 8-digit Tunisian format (already existing in codebase)
- `getOrderByCheckoutRequestId` now includes `referred_by` in SELECT (was missing, fixed in this session)
- `deleteAdminOrder` now cleans up `referral_commissions` for that order

## Relevant Files
- `schema.sql`: new tables and column definitions
- `cloudflare-worker.js`: all backend logic — affiliate creation, login, stats, commissions, payouts, admin actions, Telegram notification referred_by line
- `app.js`: frontend referral capture, checkout integration, footer link
- `checkout.html`: referral badge element
- `affiliate.html`: new affiliate dashboard page
- `nope.html`: admin panel tabs and forms for affiliates/payouts
- `admin.js`: admin panel functions for affiliate/payout management and commission field
- `styles.css`: styling for affiliate page and admin tables
