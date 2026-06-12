const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_QUANTITY = 99;
const processedOrders = new Map();

function jsonResponse(body, status = 200, corsHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
        },
    });
}

function getCorsHeaders(request) {
    const origin = request.headers.get("Origin") || "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
    };
}

async function hmacSha256(key, message) {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        typeof key === "string" ? encoder.encode(key) : key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

function bytesToHex(buffer) {
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a, b) {
    if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
    let diff = 0;
    for (let index = 0; index < a.length; index += 1) {
        diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return diff === 0;
}

async function validateTelegramInitData(initData, botToken) {
    if (!initData || typeof initData !== "string") {
        const error = new Error("Missing Telegram initData");
        error.statusCode = 401;
        throw error;
    }
    if (!botToken) {
        const error = new Error("Telegram bot token is not configured");
        error.statusCode = 500;
        throw error;
    }

    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secret = await hmacSha256("WebAppData", botToken);
    const calculatedHash = bytesToHex(await hmacSha256(secret, dataCheckString));
    if (!timingSafeEqualHex(hash, calculatedHash)) {
        const error = new Error("Invalid Telegram initData");
        error.statusCode = 401;
        throw error;
    }

    const authDate = Number(params.get("auth_date") || 0);
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || now - authDate > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
        const error = new Error("Expired Telegram session");
        error.statusCode = 401;
        throw error;
    }

    let user = null;
    try {
        user = JSON.parse(params.get("user") || "null");
    } catch {
        user = null;
    }
    if (!user || !user.id) {
        const error = new Error("Telegram user is missing from initData");
        error.statusCode = 401;
        throw error;
    }
    return user;
}

async function readDatabase(env) {
    if (!env.PRODUCT_DATABASE_URL) {
        const error = new Error("PRODUCT_DATABASE_URL is not configured");
        error.statusCode = 500;
        throw error;
    }

    const response = await fetch(env.PRODUCT_DATABASE_URL, {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 30, cacheEverything: true },
    });
    if (!response.ok) {
        throw new Error(`Could not load product database: ${response.status}`);
    }
    return response.json();
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getProductVariations(product) {
    const source = product.variations || product.options || product.variants;
    if (Array.isArray(source)) {
        return source.map((variation, index) => ({
            ...variation,
            id: variation.id || slugify(variation.label || variation.name || `option-${index + 1}`),
        }));
    }
    if (source && typeof source === "object") {
        return Object.entries(source).map(([id, variation]) => ({
            id,
            ...(typeof variation === "object" ? variation : { label: String(variation), price: product.price }),
        }));
    }
    return [];
}

function getVariation(product, variationId) {
    return getProductVariations(product).find((variation) => variation.id === variationId) || null;
}

function normalizePaymentMethod(value) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, 80);
}

function money(amount, currency) {
    return new Intl.NumberFormat("en-TN", {
        style: "currency",
        currency,
    }).format(Number(amount) || 0);
}

function buildOrder(items, paymentMethod, telegramUser, database) {
    const products = database.products || {};
    const currency = database.currency || "TND";
    const lines = [];

    if (!Array.isArray(items) || !items.length) throw new Error("Cart is empty");

    items.forEach((item) => {
        const productId = typeof item?.productId === "string" ? item.productId.trim() : "";
        const variationId = typeof item?.variationId === "string" ? item.variationId.trim() : "";
        const quantity = Number(item?.quantity);

        if (!productId) throw new Error("Missing product ID");
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
            throw new Error(`Invalid quantity for product: ${productId}`);
        }

        const product = products[productId];
        if (!product || product.visible === false) throw new Error(`Invalid product: ${productId}`);

        const variations = getProductVariations(product);
        let variation = null;
        if (variations.length) {
            if (!variationId) throw new Error(`Missing selected option for product: ${productId}`);
            variation = getVariation(product, variationId);
            if (!variation) throw new Error(`Invalid selected option for product: ${productId}`);
        } else if (variationId) {
            throw new Error(`Product has no selectable options: ${productId}`);
        }

        const unitPrice = Number(variation?.price ?? product.price);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            throw new Error(`Invalid server price for product: ${productId}`);
        }

        lines.push({
            productId,
            variationId,
            name: variation?.name || product.name || productId,
            optionLabel: variation?.label || variation?.name || "",
            category: product.category || "Digital",
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
        });
    });

    const createdAt = new Date();
    return {
        id: `GV-${createdAt.getTime()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        createdAt: createdAt.toISOString(),
        currency,
        paymentMethod: normalizePaymentMethod(paymentMethod),
        paymentStatus: "Not verified - no online payment provider configured",
        lines,
        total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
        telegramUserId: telegramUser.id,
    };
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getTelegramDisplayName(user) {
    return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Telegram user";
}

function formatAdminMessage(order, telegramUser) {
    const username = telegramUser.username ? `@${telegramUser.username}` : "";
    const products = order.lines
        .map((line, index) => {
            const option = line.optionLabel ? `\n   Option: ${escapeHtml(line.optionLabel)}` : "";
            return [
                `${index + 1}. <b>${escapeHtml(line.name)}</b>`,
                option,
                `\n   Category: ${escapeHtml(line.category)}`,
                `\n   Quantity: ${line.quantity}`,
                `\n   Unit price: ${escapeHtml(money(line.unitPrice, order.currency))}`,
                `\n   Line total: ${escapeHtml(money(line.lineTotal, order.currency))}`,
            ].join("");
        })
        .join("\n");

    return [
        "<b>New GameVault order</b>",
        `<b>Order ID:</b> ${escapeHtml(order.id)}`,
        `<b>Order date:</b> ${escapeHtml(order.createdAt)}`,
        "",
        "<b>Telegram customer</b>",
        `<b>Display name:</b> ${escapeHtml(getTelegramDisplayName(telegramUser))}`,
        username ? `<b>Username:</b> ${escapeHtml(username)}` : "",
        `<b>User ID:</b> ${escapeHtml(telegramUser.id)}`,
        "",
        "<b>Products</b>",
        products,
        "",
        `<b>Total:</b> ${escapeHtml(money(order.total, order.currency))}`,
        `<b>Payment status:</b> ${escapeHtml(order.paymentStatus)}`,
        `<b>Payment method:</b> ${escapeHtml(order.paymentMethod || "Not selected")}`,
    ]
        .filter((line) => line !== "")
        .join("\n");
}

function formatCustomerMessage(order) {
    return [
        "<b>Order received</b>",
        `Order ID: ${escapeHtml(order.id)}`,
        `Total: ${escapeHtml(money(order.total, order.currency))}`,
        "We will review your payment and process the digital order.",
    ].join("\n");
}

async function sendTelegramMessage(env, chatId, text, replyMarkup) {
    if (!env.TELEGRAM_BOT_TOKEN) {
        const error = new Error("Telegram bot token is not configured");
        error.statusCode = 500;
        throw error;
    }

    const payload = {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Telegram sendMessage failed: ${await response.text()}`);
    }
}

function cleanupProcessedOrders() {
    const now = Date.now();
    for (const [key, value] of processedOrders.entries()) {
        if (now - value.createdAt > IDEMPOTENCY_TTL_MS) processedOrders.delete(key);
    }
}

async function handleOrder(request, env, corsHeaders) {
    cleanupProcessedOrders();

    const body = await request.json();
    const telegramUser = await validateTelegramInitData(body.telegramInitData, env.TELEGRAM_BOT_TOKEN);
    const checkoutRequestId = String(body.checkoutRequestId || "").trim();
    if (!checkoutRequestId) return jsonResponse({ error: "Missing checkout request ID" }, 400, corsHeaders);

    if (processedOrders.has(checkoutRequestId)) {
        const existing = processedOrders.get(checkoutRequestId);
        if (existing.pending) return jsonResponse({ error: "Order is already being processed" }, 409, corsHeaders);
        return jsonResponse(existing.response, 200, corsHeaders);
    }

    if (!env.TELEGRAM_ADMIN_CHAT_ID) {
        const error = new Error("Telegram admin chat ID is not configured");
        error.statusCode = 500;
        throw error;
    }

    const database = await readDatabase(env);
    const order = buildOrder(body.items, body.paymentMethod, telegramUser, database);
    const responsePayload = {
        ok: true,
        orderId: order.id,
        total: order.total,
        currency: order.currency,
        paymentStatus: order.paymentStatus,
    };

    processedOrders.set(checkoutRequestId, { createdAt: Date.now(), pending: true });

    const contactMarkup = {
        inline_keyboard: [
            [
                {
                    text: "Contact customer",
                    url: `tg://user?id=${encodeURIComponent(String(telegramUser.id))}`,
                },
            ],
        ],
    };

    try {
        await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatAdminMessage(order, telegramUser), contactMarkup);
    } catch (error) {
        processedOrders.delete(checkoutRequestId);
        throw error;
    }

    processedOrders.set(checkoutRequestId, {
        createdAt: Date.now(),
        pending: false,
        response: responsePayload,
    });

    try {
        await sendTelegramMessage(env, telegramUser.id, formatCustomerMessage(order));
    } catch (error) {
        console.warn("Telegram customer confirmation failed", error);
    }

    return jsonResponse(responsePayload, 200, corsHeaders);
}

export default {
    async fetch(request, env) {
        const corsHeaders = getCorsHeaders(request);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
        }

        try {
            return await handleOrder(request, env, corsHeaders);
        } catch (error) {
            console.error(error);
            return jsonResponse({ error: error.message || "Order failed" }, error.statusCode || 400, corsHeaders);
        }
    },
};
