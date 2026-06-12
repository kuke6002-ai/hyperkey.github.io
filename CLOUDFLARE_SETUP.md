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
PRODUCT_DATABASE_URL=
```

Use Cloudflare secrets for `TELEGRAM_BOT_TOKEN`.

`PRODUCT_DATABASE_URL` must be the public URL for this store's `products.json`
on GitHub Pages.

## 3. Connect GitHub Pages to the Worker

After deployment, copy the Worker URL and paste it into `config.js`:

```js
window.GAMEVAULT_ORDER_API_URL = "https://your-worker.yourname.workers.dev";
```

## 4. Test

Open the store from your Telegram Mini App, add a product to the cart, and place
an order. A normal browser will not have `Telegram.WebApp.initData`, so checkout
should only succeed inside Telegram.

## Security Notes

- Do not put `TELEGRAM_BOT_TOKEN` in frontend JavaScript.
- Do not commit real secret values to GitHub.
- `.env.example` must contain variable names only.
- Payment is not verified online until you add a payment provider.
- Duplicate-click protection is in memory only; complete idempotency requires
  persistent order storage.
