const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const MAX_QUANTITY = 99;
const processedOrders = new Map();

const DEFAULT_PAYMENT_SETTINGS = {
    payment: {
        d17: {
            enabled: true,
            label: "D17 transfer",
            instructions: "Send the shown amount by D17, then enter only the authorization number from your receipt.",
            proofLabel: "Authorization number",
            feePercent: 1,
            roundUpToDecimal: 1,
        },
        flouci: {
            enabled: true,
            label: "Flouci transfer",
            instructions: "Send the shown amount by Flouci, then enter only the transaction ID from your receipt.",
            proofLabel: "Transaction ID",
            feeUnder100: 1,
            feeFrom100: 2,
        },
        "tt-card": {
            enabled: true,
            label: "Tunisie Telecom recharge card",
            instructions: "Enter the required Tunisie Telecom recharge card codes. Each code must be 15 digits.",
            cardValue: 5,
            feePercent: 20,
            codeLength: 15,
        },
    },
};

const ICONS = {
    cart: "\uD83D\uDED2",
    phone: "\uD83D\uDCF1",
    money: "\uD83D\uDCB0",
    card: "\uD83D\uDCB3",
    verify: "\u2705",
    search: "\uD83D\uDD0E",
    ticket: "\uD83C\uDFAB",
    warning: "\u26A0\uFE0F",
};

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

async function readJsonUrl(url, label) {
    const separator = url.includes("?") ? "&" : "?";
    const response = await fetch(`${url}${separator}v=${Date.now()}`, {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 0, cacheEverything: false },
    });
    if (!response.ok) {
        throw new Error(`Could not load ${label}: ${response.status}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${label} did not return JSON`);
    }
}

async function readDatabase(env) {
    if (!env.PRODUCT_DATABASE_URL) {
        const error = new Error("PRODUCT_DATABASE_URL is not configured");
        error.statusCode = 500;
        throw error;
    }

    return readJsonUrl(env.PRODUCT_DATABASE_URL, "product database");
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergePaymentSettings(settings = {}) {
    const merged = clone(DEFAULT_PAYMENT_SETTINGS);
    const incomingPayment = settings.payment && typeof settings.payment === "object" ? settings.payment : {};

    Object.entries(incomingPayment).forEach(([method, config]) => {
        const key = method === "ttCard" ? "tt-card" : method;
        if (!merged.payment[key] || !config || typeof config !== "object") return;
        merged.payment[key] = {
            ...merged.payment[key],
            ...config,
        };
    });

    return merged;
}

async function readSettings(env) {
    if (!env.PAYMENT_SETTINGS_URL) return clone(DEFAULT_PAYMENT_SETTINGS);
    return mergePaymentSettings(await readJsonUrl(env.PAYMENT_SETTINGS_URL, "payment settings"));
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

function normalizePhone(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

function validatePhone(value) {
    const phone = normalizePhone(value);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15 || !/^[+\d][+\d\s().-]*$/.test(phone)) {
        throw new Error("A valid WhatsApp number is required");
    }
    return phone;
}

function normalizeTelegramUsername(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32);
}

function normalizePaymentMethod(value) {
    const method = String(value || "").trim().toLowerCase();
    if (["d17", "d-17"].includes(method)) return "d17";
    if (["flouci", "flousi"].includes(method)) return "flouci";
    if (["tt", "tt-card", "ttcard", "tunisie-telecom", "tunisie telecom recharge card"].includes(method)) return "tt-card";
    return "";
}

function getPaymentConfig(settings, method) {
    return settings.payment?.[method] || DEFAULT_PAYMENT_SETTINGS.payment[method] || null;
}

function roundUpToDecimal(value, decimals = 1) {
    const factor = 10 ** Math.max(0, Number(decimals) || 0);
    return Math.ceil((Number(value) - 1e-9) * factor) / factor;
}

function roundUpToMultiple(value, multiple) {
    const step = Number(multiple) || 1;
    return Math.ceil((Number(value) - 1e-9) / step) * step;
}

function calculatePaymentDetails(productTotal, method, settings) {
    const config = getPaymentConfig(settings, method);
    if (!config || config.enabled === false) {
        throw new Error("This payment method is not available");
    }

    if (method === "d17") {
        return {
            method,
            label: config.label || "D17 transfer",
            proofLabel: config.proofLabel || "Authorization number",
            amountDue: roundUpToDecimal(productTotal * (1 + Number(config.feePercent || 0) / 100), config.roundUpToDecimal ?? 1),
        };
    }

    if (method === "flouci") {
        const fee = productTotal < 100 ? Number(config.feeUnder100 || 0) : Number(config.feeFrom100 || 0);
        return {
            method,
            label: config.label || "Flouci transfer",
            proofLabel: config.proofLabel || "Transaction ID",
            amountDue: productTotal + fee,
        };
    }

    if (method === "tt-card") {
        const cardValue = Number(config.cardValue || 5);
        const amountDue = roundUpToMultiple(productTotal * (1 + Number(config.feePercent || 0) / 100), cardValue);
        return {
            method,
            label: config.label || "Tunisie Telecom recharge card",
            amountDue,
            cardValue,
            cardCount: amountDue > 0 ? Math.round(amountDue / cardValue) : 0,
            codeLength: Number(config.codeLength || 15),
        };
    }

    throw new Error("Choose a supported payment method");
}

function normalizeReference(value, label) {
    const reference = String(value || "").trim().replace(/\s+/g, " ");
    if (!reference) throw new Error(`${label} is required`);
    if (reference.length > 80) throw new Error(`${label} is too long`);
    return reference;
}

function validatePaymentProof(paymentProof, details) {
    const proof = paymentProof && typeof paymentProof === "object" ? paymentProof : {};

    if (details.method === "tt-card") {
        const source = Array.isArray(proof.cardCodes) ? proof.cardCodes : [];
        if (source.length !== details.cardCount) {
            throw new Error(`Enter ${details.cardCount} Tunisie Telecom recharge card code${details.cardCount === 1 ? "" : "s"}`);
        }

        const cardCodes = source.map((code) => String(code || "").replace(/\s+/g, ""));
        cardCodes.forEach((code, index) => {
            const pattern = new RegExp(`^\\d{${details.codeLength}}$`);
            if (!pattern.test(code)) {
                throw new Error(`Card ${index + 1} must be ${details.codeLength} digits`);
            }
        });
        if (new Set(cardCodes).size !== cardCodes.length) {
            throw new Error("Recharge card codes must be unique");
        }

        return {
            type: "tt-card",
            cardCodes,
        };
    }

    return {
        type: "reference",
        label: details.proofLabel,
        reference: normalizeReference(proof.reference, details.proofLabel),
    };
}

function formatTndAmount(amount) {
    const value = Number(amount) || 0;
    const formatted = value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
        useGrouping: false,
    });
    return `${formatted} TND`;
}

function formatTunisianPhone(phone) {
    const raw = String(phone || "").trim();
    const digits = raw.replace(/\D/g, "");
    let localNumber = "";
    let prefix = "";

    if (digits.startsWith("00216") && digits.length === 13) {
        localNumber = digits.slice(5);
        prefix = "+216 ";
    } else if (digits.startsWith("216") && digits.length === 11) {
        localNumber = digits.slice(3);
        prefix = "+216 ";
    } else if (digits.length === 8) {
        localNumber = digits;
    }

    if (localNumber.length !== 8) return raw;
    return `${prefix}${localNumber.slice(0, 2)} ${localNumber.slice(2, 5)} ${localNumber.slice(5)}`;
}

function buildOrderLines(items, database) {
    const products = database.products || {};
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
        if (!product) {
            throw new Error(`Invalid product: ${productId}. Check PRODUCT_DATABASE_URL and make sure products.json is deployed.`);
        }
        if (product.visible === false) throw new Error(`Product is hidden: ${productId}`);

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

    return lines;
}

function buildOrder(body, database, settings) {
    const currency = database.currency || "TND";
    const lines = buildOrderLines(body.items, database);
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const paymentMethod = normalizePaymentMethod(body.paymentMethod);
    if (!paymentMethod) throw new Error("Choose a supported payment method");

    const paymentDetails = calculatePaymentDetails(total, paymentMethod, settings);
    const paymentProof = validatePaymentProof(body.paymentProof, paymentDetails);
    const createdAt = new Date();

    return {
        id: `HK-${createdAt.getTime()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        createdAt: createdAt.toISOString(),
        currency,
        customerPhone: validatePhone(body.customerPhone),
        telegramUsername: normalizeTelegramUsername(body.telegramUsername),
        paymentMethod,
        paymentMethodLabel: paymentDetails.label,
        paymentStatus: "Pending manual verification",
        paymentProof,
        paymentDetails,
        lines,
        total,
        amountDue: paymentDetails.amountDue,
    };
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatProofLines(order) {
    if (order.paymentProof.type === "tt-card") {
        const codes = order.paymentProof.cardCodes.map((code, index) => `${index + 1}. ${escapeHtml(code)}`);
        return [
            `${ICONS.ticket} Cards: ${order.paymentProof.cardCodes.length} x ${escapeHtml(formatTndAmount(order.paymentDetails.cardValue))}`,
            "Codes:",
            ...codes,
        ];
    }

    return [
        `${ICONS.search} ${escapeHtml(order.paymentProof.label)}: ${escapeHtml(order.paymentProof.reference)}`,
    ];
}

function formatAdminMessage(order) {
    const products = order.lines
        .map((line) => {
            const quantity = Number(line.quantity) > 1 ? `${line.quantity}\u00D7 ` : "";
            return `\u2022 ${escapeHtml(quantity)}${escapeHtml(line.name)} \u2014 ${escapeHtml(formatTndAmount(line.lineTotal))}`;
        })
        .join("\n");

    return [
        `${ICONS.cart} New order \u2014 ${escapeHtml(order.id)}`,
        "",
        `${ICONS.phone} WhatsApp: ${escapeHtml(formatTunisianPhone(order.customerPhone))}`,
        "",
        products,
        "",
        `${ICONS.money} Products: ${escapeHtml(formatTndAmount(order.total))}`,
        `${ICONS.card} Payment: ${escapeHtml(order.paymentMethodLabel)}`,
        `${ICONS.verify} To verify: ${escapeHtml(formatTndAmount(order.amountDue))}`,
        "",
        ...formatProofLines(order),
        "",
        `${ICONS.warning} Payment: ${escapeHtml(order.paymentStatus)}`,
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

    const [database, settings] = await Promise.all([readDatabase(env), readSettings(env)]);
    const order = buildOrder(body, database, settings);
    const responsePayload = {
        ok: true,
        orderId: order.id,
        total: order.total,
        amountDue: order.amountDue,
        currency: order.currency,
        paymentMethod: order.paymentMethodLabel,
        paymentStatus: order.paymentStatus,
    };

    processedOrders.set(checkoutRequestId, { createdAt: Date.now(), pending: true });

    const contactButton = order.telegramUsername
        ? {
              inline_keyboard: [
                  [
                      {
                          text: "Open Telegram username",
                          url: `https://t.me/${encodeURIComponent(order.telegramUsername)}`,
                      },
                  ],
              ],
          }
        : undefined;

    try {
        await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatAdminMessage(order), contactButton);
    } catch (error) {
        processedOrders.delete(checkoutRequestId);
        throw error;
    }

    processedOrders.set(checkoutRequestId, {
        createdAt: Date.now(),
        pending: false,
        response: responsePayload,
    });

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
