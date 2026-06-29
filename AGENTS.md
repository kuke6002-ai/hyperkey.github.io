# Session Log

## Goal
- Improve mobile performance, fix small-screen layout, and clean up the codebase

## Constraints & Preferences
- Bootstrap 5 grid/utilities must stay intact
- JS functionality must not break (no class names removed)
- `backdrop-filter` and `will-change` are banned on mobile (cause GPU jank)
- Original visual design preserved; only performance/layout/cleanup fixes applied

## Progress
### Done
- Removed all 9 `will-change` declarations across CSS
- Removed all `backdrop-filter: blur()` from navbar and hero panels
- Simplified body background on mobile to solid color
- Disabled expensive animations on mobile: `pageRise`, `buttonShine`, `homeSweep`, `panelFloat`, `logoBreath`, `brandGlow`
- Reduced glow box-shadow sizes on mobile (60-70% smaller spread)
- Reduced hover transform distances on mobile (`-3px` instead of `-6px`)
- Fixed overflow issues: cart badge `right: -10px → -6px`, floating card `max-width`, summary line `flex-basis 180px → 120px`
- Fixed admin `white-space: nowrap` on tabs, item-meta, order-details small
- Fixed admin mobile tabs `min-width: 112px → 80px`
- Fixed admin order body grid to collapse `260px` column to `1fr` on mobile
- Added comprehensive `@media (max-width: 360px)` block with 40+ overrides for tiny phones
- Reverted all HTML design changes: removed `nav-glass`, `text-neon`, Orbitron font links, CSS version bump
- Replaced `styles.css` with original design from `old/`, then merged function fixes on top
- Added missing lock screen CSS to current styles.css
- Removed "Continue order in WhatsApp" button from `payment.html`
- Removed Recipient name display from checkout (`app.js` line 1290 removed, `hasRecipient` check simplified)
- Removed Recipient name label+input from admin panel (`nope.html` D17/Flouci sections)
- Fixed `admin.js` `textValue` crash (`?.value?.trim()`)
- Removed orphaned `recipientName` references from `admin.js`
- Hardcoded `recipientValue: "97671058"` for D17 and Flouci in `DEFAULT_PAYMENT_SETTINGS` within `app.js`
- Deleted `old/` directory (original project backup, ~42 files)
- Deleted `backup/` directory (Neon Desert redesign backup, ~45 files)
- Deleted `styless.css` (typo duplicate of styles.css)
- Deleted `products.jsonx`, `products.jsonxx` (typo backup files)
- Deleted `accounts.html`, `gift-cards.html`, `top-ups.html` (orphaned pages)
- Removed blanket `* { animation: none !important }` rule from styles.css
- Removed duplicate admin override block (`/* Admin full-width clarity pass */` + media queries, ~165 lines)

### In Progress
- (none)

### Blocked
- "Save settings to DB" button in admin panel does not persist to D1 — appears to be a worker-side issue (the D1 write path needs debugging on Cloudflare)

## Key Decisions
- Original design kept from `old/`; only function/performance fixes cherry-picked from redesign session
- Replaced `styles.css` wholesale (original from `old/`) instead of line-by-line revert because the redesign touched essentially every line
- Lock screen CSS was missing entirely from original `styles.css` (was only in `backup/`); added it back
- Hardcoded recipient values as fallback because admin panel "Save settings to DB" wasn't persisting settings to D1
- Deleted `old/` and `backup/` directories — superseded by current working directory
- Chose not to fix the `PRODUCTS = {}` no-fallback issue at user's request
- Removed blanket `* { animation: none !important }` in favor of targeted animation disables on specific elements
- Removed duplicate admin override block (second copy of identical CSS rules)

## Critical Context
- `settings.json` is stale/not used directly — the runtime source of truth is D1 (via the worker API), but the save-to-DB path is broken; `app.js` falls back to hardcoded defaults
- `cart.html` already has `config.js` loaded (false positive in audit)
- JSON backup files (`products.jsonx`, `products.jsonxx`) and `old/`/`backup/` directories are deleted — ensure no code references them
- The `* { animation: none !important; }` blanket rule has been removed; animation disables are now targeted to specific elements
- Duplicate admin override block has been removed; only one instance of admin override rules remains
