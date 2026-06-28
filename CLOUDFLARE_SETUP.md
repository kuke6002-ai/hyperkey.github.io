# Cloudflare Worker Checkout Setup

GitHub Pages can host the store frontend, but it cannot run secret backend code.
Use `cloudflare-worker.js` as the secure order backend.

## 1. Deploy the Worker

Create a Cloudflare Worker and paste the full contents of `cloudflare-worker.js`.

## 2. Add Worker Variables and Secrets

In the Worker settings, add these names:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
ADMIN_API_TOKEN=
```

Use Cloudflare secrets for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
`ADMIN_API_TOKEN`.

## 3. Bind the D1 Order Database

Create a D1 database, then bind it to this Worker:

```text
Binding type: D1 database
Variable name: DB
Database: hyperkey-orders
```

Open the D1 database console and run the order tables from `schema.sql`:

```sql
-- orders, order_items, payment_proofs, order_deliveries, order_customer_inputs
```

## 3.5 Bind the D1 Catalog Database

Create a second D1 database named `hyperkey-catalog`, then bind it:

```text
Binding type: D1 database
Variable name: product_db
Database: hyperkey-catalog
```

Open the D1 database console and run the catalog tables from `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS categories (...);
CREATE TABLE IF NOT EXISTS products (...);
CREATE TABLE IF NOT EXISTS store_config (...);
CREATE TABLE IF NOT EXISTS settings (...);
```

The Worker uses `product_db` for product/category/settings data and `DB` for orders.
Both are separate Cloudflare D1 databases.

## 4. Connect GitHub Pages to the Worker

After deployment, copy the Worker URL and paste it into `config.js`:

```js
window.GAMEVAULT_ORDER_API_URL = "https://your-worker.yourname.workers.dev";
```

## 5. Populate the Catalog Database

The catalog is stored entirely in D1 — no static JSON files are used.

Open `nope.html` and enter your `ADMIN_API_TOKEN`, then click Save. Use the
admin panel to:

- Add, edit, or delete products and categories
- Click **"Save Products to DB"** to sync products/categories to D1
- Click **"Save Settings to DB"** to sync payment settings to D1

On first deploy the catalog tables are empty. You must populate them through
the admin panel before products will appear in the store.

## 6. Test

Open the store, add a product to the cart, enter an 8-digit Tunisian WhatsApp
number on checkout, choose a payment method, enter the required reference or
card codes on `payment.html`, and submit the order.

After the order succeeds, check the D1 tables:

```sql
SELECT * FROM orders ORDER BY created_at DESC;
SELECT * FROM order_items ORDER BY id DESC;
SELECT * FROM payment_proofs ORDER BY id DESC;
```

The customer can check the order later on `order-status.html` using the short
Order ID, for example `HK-123456`, and the same WhatsApp number used at checkout.

## 7. Telegram Status Buttons

New order notifications include Telegram buttons to:

- mark payment as verified, rejected, or pending
- mark delivery as delivered, cancelled, or waiting
- open the customer WhatsApp chat

To make the status buttons work, set the bot webhook to the same Worker URL.
Use the exact same secret value you stored in `TELEGRAM_WEBHOOK_SECRET`:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WORKER_URL&secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET
```

After this, tapping a status button in the admin Telegram chat updates the D1
order and edits the original Telegram notification with the latest status.

## 8. Admin Orders

Open `nope.html`, enter the `ADMIN_API_TOKEN`, click Save, then Load orders.
The admin dashboard can:

- view order products and payment proofs
- copy the order ID or WhatsApp number
- mark payment as pending, verified, or rejected
- mark delivery as waiting, delivered, or cancelled

## Security Notes

- Do not put `TELEGRAM_BOT_TOKEN` in frontend JavaScript.
- Do not commit `ADMIN_API_TOKEN`; enter it only inside `nope.html`.
- Do not commit real secret values to GitHub.
- `.env.example` must contain variable names only.
- Payment is not verified online until you add a payment provider.
- Duplicate checkout requests are stored in D1 using `checkout_request_id`.
