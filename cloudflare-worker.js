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
    delivery: "\uD83D\uDE9A",
    key: "\uD83D\uDD11",
    game: "\uD83C\uDFAE",
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
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
        Vary: "Origin",
    };
}

function getOrderDb(env) {
    if (!env.DB) {
        const error = new Error("D1 database binding DB is not configured");
        error.statusCode = 500;
        throw error;
    }
    return env.DB;
}

function requireAdmin(request, env) {
    if (!env.ADMIN_API_TOKEN) {
        const error = new Error("ADMIN_API_TOKEN is not configured");
        error.statusCode = 500;
        throw error;
    }

    const token = request.headers.get("X-Admin-Token") || "";
    if (token !== env.ADMIN_API_TOKEN) {
        const error = new Error("Admin token is invalid");
        error.statusCode = 401;
        throw error;
    }
}

function requireTelegramWebhook(request, env) {
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
        const error = new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
        error.statusCode = 500;
        throw error;
    }

    const token = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
        const error = new Error("Telegram webhook token is invalid");
        error.statusCode = 401;
        throw error;
    }
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
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("00216") && digits.length === 13) return digits.slice(5);
    if (digits.startsWith("216") && digits.length === 11) return digits.slice(3);
    if (digits.length === 8) return digits;
    return digits;
}

function validatePhone(value) {
    const phone = normalizePhone(value);
    if (!/^\d{8}$/.test(phone)) {
        throw new Error("A valid Tunisian WhatsApp number is required");
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

function getPaymentStatusLabel(status) {
    const labels = {
        pending: "Pending manual verification",
        verified: "Verified",
        rejected: "Rejected",
    };
    return labels[status] || String(status || "Pending manual verification");
}

function getDeliveryStatusLabel(status) {
    const labels = {
        waiting: "Waiting for delivery",
        delivered: "Delivered",
        cancelled: "Cancelled",
    };
    return labels[status] || String(status || "Waiting for delivery");
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
    const localNumber = normalizePhone(phone);
    if (localNumber.length !== 8) return String(phone || "").trim();
    return `${localNumber.slice(0, 2)} ${localNumber.slice(2, 5)} ${localNumber.slice(5)}`;
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
        if (product.inStock === false) throw new Error(`Product is out of stock: ${productId}`);

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

function generateOrderId() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return `HK-${String((values[0] % 900000) + 100000)}`;
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
        id: generateOrderId(),
        createdAt: createdAt.toISOString(),
        currency,
        customerPhone: validatePhone(body.customerPhone),
        telegramUsername: normalizeTelegramUsername(body.telegramUsername),
        paymentMethod,
        paymentMethodLabel: paymentDetails.label,
        paymentStatus: "pending",
        paymentStatusLabel: "Pending manual verification",
        paymentProof,
        paymentDetails,
        lines,
        total,
        amountDue: paymentDetails.amountDue,
    };
}

function getResponsePayload(order) {
    return {
        ok: true,
        orderId: order.id,
        total: order.total,
        amountDue: order.amountDue,
        currency: order.currency,
        paymentMethod: order.paymentMethodLabel,
        paymentStatus: order.paymentStatusLabel,
    };
}

function getResponsePayloadFromRecord(record) {
    return {
        ok: true,
        orderId: record.id,
        total: Number(record.product_total),
        amountDue: Number(record.amount_due),
        currency: record.currency,
        paymentMethod: record.payment_method_label,
        paymentStatus: getPaymentStatusLabel(record.payment_status),
        duplicate: true,
    };
}

async function getOrderByCheckoutRequestId(env, checkoutRequestId) {
    const db = getOrderDb(env);
    return db
        .prepare(
            `SELECT
                id,
                checkout_request_id,
                created_at,
                customer_phone,
                telegram_username,
                product_total,
                amount_due,
                currency,
                payment_method,
                payment_method_label,
                payment_status,
                delivery_status,
                telegram_notified_at
            FROM orders
            WHERE checkout_request_id = ?`,
        )
        .bind(checkoutRequestId)
        .first();
}

function normalizeOrderId(value) {
    return String(value || "").trim().toUpperCase();
}

async function getOrderByIdAndPhone(env, orderId, customerPhone) {
    const db = getOrderDb(env);
    const phone = validatePhone(customerPhone);
    return db
        .prepare(
            `SELECT
                id,
                checkout_request_id,
                created_at,
                customer_phone,
                product_total,
                amount_due,
                currency,
                payment_method,
                payment_method_label,
                payment_status,
                delivery_status
            FROM orders
            WHERE id = ? AND customer_phone IN (?, ?, ?)`,
        )
        .bind(normalizeOrderId(orderId), phone, `+216${phone}`, `00216${phone}`)
        .first();
}

async function getOrderById(env, orderId) {
    const db = getOrderDb(env);
    return db
        .prepare(
            `SELECT
                id,
                checkout_request_id,
                created_at,
                customer_phone,
                telegram_username,
                product_total,
                amount_due,
                currency,
                payment_method,
                payment_method_label,
                payment_status,
                delivery_status,
                telegram_notified_at
            FROM orders
            WHERE id = ?`,
        )
        .bind(normalizeOrderId(orderId))
        .first();
}

async function getAllResults(statement) {
    const result = await statement.all();
    return result.results || [];
}

async function getOrderItems(env, orderId) {
    const db = getOrderDb(env);
    return getAllResults(
        db
            .prepare(
                `SELECT
                    product_id,
                    variation_id,
                    product_name,
                    option_label,
                    quantity,
                    unit_price,
                    line_total
                FROM order_items
                WHERE order_id = ?
                ORDER BY id`,
            )
            .bind(orderId),
    );
}

async function getPaymentProofs(env, orderId) {
    const db = getOrderDb(env);
    return getAllResults(
        db
            .prepare(
                `SELECT
                    proof_type,
                    proof_label,
                    proof_value
                FROM payment_proofs
                WHERE order_id = ?
                ORDER BY id`,
            )
            .bind(orderId),
    );
}

async function getOrderDeliveries(env, orderId) {
    const db = getOrderDb(env);
    try {
        return await getAllResults(
            db
                .prepare(
                    `SELECT
                        id,
                        delivery_text,
                        created_at
                    FROM order_deliveries
                    WHERE order_id = ?
                    ORDER BY id`,
                )
                .bind(orderId),
        );
    } catch (error) {
        if (/no such table/i.test(String(error?.message || ""))) {
            console.warn("order_deliveries table is missing. Run schema.sql in Cloudflare D1.");
            return [];
        }
        throw error;
    }
}

function normalizeDeliveryText(value) {
    const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
    if (text.length > 3000) throw new Error("Delivery text is too long");
    return text;
}

function parseDeliveryText(deliveryText) {
    const text = normalizeDeliveryText(deliveryText);
    if (!text || text === "0") return [];

    return text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const separatorIndex = line.indexOf(":");
            if (separatorIndex === -1) {
                return {
                    note: "",
                    code: line,
                };
            }

            return {
                note: line.slice(0, separatorIndex).trim(),
                code: line.slice(separatorIndex + 1).trim(),
            };
        })
        .filter((line) => line.note || line.code);
}

function formatDeliveryPayload(deliveries) {
    return deliveries.map((delivery) => ({
        id: delivery.id,
        text: delivery.delivery_text || "",
        createdAt: delivery.created_at,
        lines: parseDeliveryText(delivery.delivery_text),
    }));
}

function getCustomerInputConfig(product) {
    const config = product?.customerInput;
    if (!config || config.enabled === false) return null;

    const label = String(config.label || "Player ID").trim().slice(0, 80) || "Player ID";
    return {
        enabled: true,
        label,
    };
}

function getCustomerInputKey(productId, variationId) {
    return `${productId}::${variationId || ""}`;
}

async function getCustomerInputRequirements(env, record, items) {
    if (record.payment_status !== "verified" || record.delivery_status !== "waiting") return [];

    let database = null;
    try {
        database = await readDatabase(env);
    } catch (error) {
        console.warn("Could not load product database for customer input requirements", error);
        return [];
    }

    const products = database.products || {};
    return items
        .map((item) => {
            const product = products[item.product_id];
            const customerInput = getCustomerInputConfig(product);
            if (!customerInput) return null;

            return {
                key: getCustomerInputKey(item.product_id, item.variation_id || ""),
                productId: item.product_id,
                variationId: item.variation_id || "",
                productName: item.product_name,
                optionLabel: item.option_label || "",
                label: customerInput.label,
            };
        })
        .filter(Boolean);
}

async function getSavedOrderForNotification(env, record) {
    const [items, proofs] = await Promise.all([getOrderItems(env, record.id), getPaymentProofs(env, record.id)]);
    const isTtCard = record.payment_method === "tt-card";

    return {
        id: record.id,
        createdAt: record.created_at,
        currency: record.currency,
        customerPhone: record.customer_phone,
        telegramUsername: record.telegram_username || "",
        paymentMethod: record.payment_method,
        paymentMethodLabel: record.payment_method_label,
        paymentStatus: record.payment_status,
        paymentStatusLabel: getPaymentStatusLabel(record.payment_status),
        deliveryStatus: record.delivery_status,
        deliveryStatusLabel: getDeliveryStatusLabel(record.delivery_status),
        paymentProof: isTtCard
            ? {
                  type: "tt-card",
                  cardCodes: proofs.map((proof) => proof.proof_value),
              }
            : {
                  type: "reference",
                  label: proofs[0]?.proof_label || "Reference",
                  reference: proofs[0]?.proof_value || "",
              },
        paymentDetails: {
            cardValue: isTtCard && proofs.length ? Number(record.amount_due) / proofs.length : 0,
        },
        lines: items.map((item) => ({
            productId: item.product_id,
            variationId: item.variation_id || "",
            name: item.product_name,
            optionLabel: item.option_label || "",
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            lineTotal: Number(item.line_total),
        })),
        total: Number(record.product_total),
        amountDue: Number(record.amount_due),
    };
}

async function getOrderStatusPayload(env, record) {
    const [items, deliveries] = await Promise.all([getOrderItems(env, record.id), getOrderDeliveries(env, record.id)]);
    const customerInputs = await getCustomerInputRequirements(env, record, items);
    return {
        ok: true,
        order: {
            id: record.id,
            createdAt: record.created_at,
            customerPhone: formatTunisianPhone(record.customer_phone),
            productTotal: Number(record.product_total),
            amountDue: Number(record.amount_due),
            currency: record.currency,
            paymentMethod: record.payment_method_label,
            paymentStatusCode: record.payment_status,
            paymentStatus: getPaymentStatusLabel(record.payment_status),
            deliveryStatusCode: record.delivery_status,
            deliveryStatus: getDeliveryStatusLabel(record.delivery_status),
            items: items.map((item) => ({
                productId: item.product_id,
                variationId: item.variation_id || "",
                productName: item.product_name,
                optionLabel: item.option_label || "",
                quantity: Number(item.quantity),
                unitPrice: Number(item.unit_price),
                lineTotal: Number(item.line_total),
            })),
            deliveries: record.payment_status === "verified" ? formatDeliveryPayload(deliveries) : [],
            customerInputs,
        },
    };
}

function formatAdminProofs(proofs) {
    return proofs.map((proof) => ({
        type: proof.proof_type,
        label: proof.proof_label || "",
        value: proof.proof_value || "",
    }));
}

async function getAdminOrderPayload(env, record) {
    const [items, proofs, deliveries] = await Promise.all([
        getOrderItems(env, record.id),
        getPaymentProofs(env, record.id),
        getOrderDeliveries(env, record.id),
    ]);
    return {
        id: record.id,
        createdAt: record.created_at,
        customerPhone: record.customer_phone,
        customerPhoneDisplay: formatTunisianPhone(record.customer_phone),
        telegramUsername: record.telegram_username || "",
        productTotal: Number(record.product_total),
        amountDue: Number(record.amount_due),
        currency: record.currency,
        paymentMethod: record.payment_method,
        paymentMethodLabel: record.payment_method_label,
        paymentStatus: record.payment_status,
        paymentStatusLabel: getPaymentStatusLabel(record.payment_status),
        deliveryStatus: record.delivery_status,
        deliveryStatusLabel: getDeliveryStatusLabel(record.delivery_status),
        telegramNotifiedAt: record.telegram_notified_at,
        items: items.map((item) => ({
            productId: item.product_id,
            variationId: item.variation_id || "",
            productName: item.product_name,
            optionLabel: item.option_label || "",
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            lineTotal: Number(item.line_total),
        })),
        proofs: formatAdminProofs(proofs),
        deliveries: formatDeliveryPayload(deliveries),
    };
}

async function listAdminOrders(env, limit = 50) {
    const db = getOrderDb(env);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const records = await getAllResults(
        db
            .prepare(
                `SELECT
                    id,
                    checkout_request_id,
                    created_at,
                    customer_phone,
                    telegram_username,
                    product_total,
                    amount_due,
                    currency,
                    payment_method,
                    payment_method_label,
                    payment_status,
                    delivery_status,
                    telegram_notified_at
                FROM orders
                ORDER BY created_at DESC
                LIMIT ?`,
            )
            .bind(safeLimit),
    );

    return Promise.all(records.map((record) => getAdminOrderPayload(env, record)));
}

async function updateAdminOrder(env, body) {
    const orderId = normalizeOrderId(body.orderId);
    if (!/^HK-\d{6}$/.test(orderId)) throw new Error("Enter a valid order ID");

    const allowedPayment = new Set(["pending", "verified", "rejected"]);
    const allowedDelivery = new Set(["waiting", "delivered", "cancelled"]);
    const updates = [];
    const values = [];

    if (typeof body.paymentStatus === "string" && body.paymentStatus) {
        if (!allowedPayment.has(body.paymentStatus)) throw new Error("Invalid payment status");
        updates.push("payment_status = ?");
        values.push(body.paymentStatus);
    }

    if (typeof body.deliveryStatus === "string" && body.deliveryStatus) {
        if (!allowedDelivery.has(body.deliveryStatus)) throw new Error("Invalid delivery status");
        updates.push("delivery_status = ?");
        values.push(body.deliveryStatus);
    }

    if (!updates.length) throw new Error("No status update was provided");
    values.push(orderId);

    const db = getOrderDb(env);
    await db.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

    const record = await getOrderById(env, orderId);
    if (!record) throw new Error("Order was not found");
    return getAdminOrderPayload(env, record);
}

async function saveAdminOrderDelivery(env, body) {
    const orderId = normalizeOrderId(body.orderId);
    if (!/^HK-\d{6}$/.test(orderId)) throw new Error("Enter a valid order ID");

    const record = await getOrderById(env, orderId);
    if (!record) throw new Error("Order was not found");

    const deliveryText = normalizeDeliveryText(body.deliveryText);
    const db = getOrderDb(env);
    const deleteStatement = db.prepare("DELETE FROM order_deliveries WHERE order_id = ?").bind(orderId);

    try {
        if (!deliveryText || deliveryText === "0") {
            await deleteStatement.run();
        } else {
            await db.batch([
                deleteStatement,
                db
                    .prepare(
                        `INSERT INTO order_deliveries (
                            order_id,
                            delivery_text,
                            created_at
                        ) VALUES (?, ?, ?)`,
                    )
                    .bind(orderId, deliveryText, new Date().toISOString()),
            ]);
        }
    } catch (error) {
        if (/no such table/i.test(String(error?.message || ""))) {
            throw new Error("order_deliveries table is missing. Run schema.sql in Cloudflare D1.");
        }
        throw error;
    }

    return getAdminOrderPayload(env, record);
}

async function deleteAdminOrder(env, body) {
    const orderId = normalizeOrderId(body.orderId);
    if (!/^HK-\d{6}$/.test(orderId)) throw new Error("Enter a valid order ID");

    const record = await getOrderById(env, orderId);
    if (!record) throw new Error("Order was not found");

    const db = getOrderDb(env);
    try {
        await db.batch([
            db.prepare("DELETE FROM order_deliveries WHERE order_id = ?").bind(orderId),
            db.prepare("DELETE FROM payment_proofs WHERE order_id = ?").bind(orderId),
            db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId),
            db.prepare("DELETE FROM orders WHERE id = ?").bind(orderId),
        ]);
    } catch (error) {
        if (/no such table/i.test(String(error?.message || ""))) {
            throw new Error("Order tables are missing. Run schema.sql in Cloudflare D1.");
        }
        throw error;
    }

    return { id: orderId };
}

function getProofRows(order) {
    if (order.paymentProof.type === "tt-card") {
        return order.paymentProof.cardCodes.map((code, index) => ({
            proofType: "tt-card",
            proofLabel: `Card ${index + 1}`,
            proofValue: code,
        }));
    }

    return [
        {
            proofType: "reference",
            proofLabel: order.paymentProof.label,
            proofValue: order.paymentProof.reference,
        },
    ];
}

async function saveOrderToDatabase(env, checkoutRequestId, order) {
    const db = getOrderDb(env);
    const existingOrder = await getOrderByCheckoutRequestId(env, checkoutRequestId);
    if (existingOrder) {
        return {
            duplicate: true,
            record: existingOrder,
            response: getResponsePayloadFromRecord(existingOrder),
        };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const orderStatement = db
            .prepare(
                `INSERT INTO orders (
                    id,
                    checkout_request_id,
                    created_at,
                    customer_phone,
                    telegram_username,
                    product_total,
                    amount_due,
                    currency,
                    payment_method,
                    payment_method_label,
                    payment_status,
                    delivery_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                order.id,
                checkoutRequestId,
                order.createdAt,
                order.customerPhone,
                order.telegramUsername || null,
                order.total,
                order.amountDue,
                order.currency,
                order.paymentMethod,
                order.paymentMethodLabel,
                order.paymentStatus,
                "waiting",
            );

        const itemStatements = order.lines.map((line) =>
            db
                .prepare(
                    `INSERT INTO order_items (
                        order_id,
                        product_id,
                        variation_id,
                        product_name,
                        option_label,
                        quantity,
                        unit_price,
                        line_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                    order.id,
                    line.productId,
                    line.variationId || null,
                    line.name,
                    line.optionLabel || null,
                    line.quantity,
                    line.unitPrice,
                    line.lineTotal,
                ),
        );

        const proofStatements = getProofRows(order).map((proof) =>
            db
                .prepare(
                    `INSERT INTO payment_proofs (
                        order_id,
                        proof_type,
                        proof_label,
                        proof_value,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?)`,
                )
                .bind(order.id, proof.proofType, proof.proofLabel, proof.proofValue, order.createdAt),
        );

        try {
            await db.batch([orderStatement, ...itemStatements, ...proofStatements]);
            return {
                duplicate: false,
                response: getResponsePayload(order),
            };
        } catch (error) {
            const duplicateOrder = await getOrderByCheckoutRequestId(env, checkoutRequestId);
            if (duplicateOrder) {
                return {
                    duplicate: true,
                    record: duplicateOrder,
                    response: getResponsePayloadFromRecord(duplicateOrder),
                };
            }

            if (/UNIQUE|constraint/i.test(String(error?.message || "")) && attempt < 4) {
                order.id = generateOrderId();
                continue;
            }

            throw error;
        }
    }

    throw new Error("Could not generate a unique order ID");
}

async function markTelegramNotified(env, orderId) {
    const db = getOrderDb(env);
    await db
        .prepare("UPDATE orders SET telegram_notified_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), orderId)
        .run();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function telegramCode(value) {
    return `<code>${escapeHtml(value)}</code>`;
}

function formatProofLines(order) {
    if (order.paymentProof.type === "tt-card") {
        const codes = order.paymentProof.cardCodes.map((code, index) => `${index + 1}. ${telegramCode(code)}`);
        return [
            `${ICONS.ticket} Cards: ${order.paymentProof.cardCodes.length} x ${escapeHtml(formatTndAmount(order.paymentDetails.cardValue))}`,
            "Codes:",
            ...codes,
        ];
    }

    return [
        `${ICONS.search} ${escapeHtml(order.paymentProof.label)}: ${telegramCode(order.paymentProof.reference)}`,
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
        `${ICONS.warning} Payment: ${escapeHtml(order.paymentStatusLabel)}`,
        `${ICONS.delivery} Delivery: ${escapeHtml(order.deliveryStatusLabel || getDeliveryStatusLabel(order.deliveryStatus || "waiting"))}`,
    ].join("\n");
}

function getAdminOrderKeyboard(order) {
    const phone = normalizePhone(order.customerPhone);
    const keyboard = [
        [
            {
                text: "\u2705 Verify payment",
                callback_data: `hk|payment|verified|${order.id}`,
            },
            {
                text: "\u274C Reject payment",
                callback_data: `hk|payment|rejected|${order.id}`,
            },
        ],
        [
            {
                text: "\uD83D\uDE9A Delivered",
                callback_data: `hk|delivery|delivered|${order.id}`,
            },
            {
                text: "\uD83D\uDEAB Cancel order",
                callback_data: `hk|delivery|cancelled|${order.id}`,
            },
        ],
        [
            {
                text: "\uD83D\uDD11 Add delivery code",
                callback_data: `hk|deliverycode|${order.id}`,
            },
        ],
    ];

    if (/^\d{8}$/.test(phone)) {
        keyboard.push([
            {
                text: "WhatsApp customer",
                url: `https://wa.me/216${phone}`,
            },
        ]);
    }

    if (order.telegramUsername) {
        keyboard.push([
            {
                text: "Open Telegram username",
                url: `https://t.me/${encodeURIComponent(order.telegramUsername)}`,
            },
        ]);
    }

    return {
        inline_keyboard: [
            ...keyboard,
        ],
    };
}

async function callTelegramApi(env, method, payload) {
    if (!env.TELEGRAM_BOT_TOKEN) {
        const error = new Error("Telegram bot token is not configured");
        error.statusCode = 500;
        throw error;
    }

    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Telegram ${method} failed: ${await response.text()}`);
    }
}

async function sendTelegramMessage(env, chatId, text, replyMarkup) {
    const payload = {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await callTelegramApi(env, "sendMessage", payload);
}

async function answerTelegramCallback(env, callbackQueryId, text, showAlert = false) {
    if (!callbackQueryId) return;
    await callTelegramApi(env, "answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
    });
}

async function editTelegramMessage(env, chatId, messageId, text, replyMarkup) {
    const payload = {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await callTelegramApi(env, "editMessageText", payload);
}

function cleanupProcessedOrders() {
    const now = Date.now();
    for (const [key, value] of processedOrders.entries()) {
        if (now - value.createdAt > IDEMPOTENCY_TTL_MS) processedOrders.delete(key);
    }
}

async function handleOrderStatus(body, env, corsHeaders) {
    const orderId = normalizeOrderId(body.orderId);
    if (!/^HK-\d{6}$/.test(orderId)) {
        return jsonResponse({ error: "Enter a valid order ID" }, 400, corsHeaders);
    }

    const record = await getOrderByIdAndPhone(env, orderId, body.customerPhone);
    if (!record) {
        return jsonResponse({ error: "Order was not found. Check the order ID and WhatsApp number." }, 404, corsHeaders);
    }

    return jsonResponse(await getOrderStatusPayload(env, record), 200, corsHeaders);
}

function normalizeCustomerInputValue(value, label) {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if (!text) throw new Error(`${label} is required`);
    if (text.length > 120) throw new Error(`${label} is too long`);
    return text;
}

function formatCustomerInputMessage(record, inputs) {
    const inputLines = inputs
        .map((input) =>
            [
                `${ICONS.game} ${escapeHtml(input.productName)}`,
                `${escapeHtml(input.label)}: ${telegramCode(input.value)}`,
            ].join("\n"),
        )
        .join("\n\n");

    return [
        `${ICONS.search} Customer info \u2014 ${escapeHtml(record.id)}`,
        `${ICONS.phone} WhatsApp: ${escapeHtml(formatTunisianPhone(record.customer_phone))}`,
        "",
        inputLines,
    ].join("\n");
}

async function handleCustomerInput(body, env, corsHeaders) {
    const orderId = normalizeOrderId(body.orderId);
    if (!/^HK-\d{6}$/.test(orderId)) {
        return jsonResponse({ error: "Enter a valid order ID" }, 400, corsHeaders);
    }

    const record = await getOrderByIdAndPhone(env, orderId, body.customerPhone);
    if (!record) {
        return jsonResponse({ error: "Order was not found. Check the order ID and WhatsApp number." }, 404, corsHeaders);
    }

    if (record.payment_status !== "verified") {
        return jsonResponse({ error: "Payment must be verified before sending delivery details." }, 400, corsHeaders);
    }

    if (record.delivery_status !== "waiting") {
        return jsonResponse({ error: "This order is not waiting for delivery details." }, 400, corsHeaders);
    }

    const items = await getOrderItems(env, record.id);
    const requirements = await getCustomerInputRequirements(env, record, items);
    if (!requirements.length) {
        return jsonResponse({ error: "This order does not need extra customer information." }, 400, corsHeaders);
    }

    const inputMap = new Map(
        (Array.isArray(body.inputs) ? body.inputs : []).map((input) => [
            getCustomerInputKey(String(input?.productId || "").trim(), String(input?.variationId || "").trim()),
            input,
        ]),
    );

    const validatedInputs = requirements.map((requirement) => {
        const submitted = inputMap.get(requirement.key);
        return {
            ...requirement,
            value: normalizeCustomerInputValue(submitted?.value, requirement.label),
        };
    });

    if (!env.TELEGRAM_ADMIN_CHAT_ID) {
        const error = new Error("Telegram admin chat ID is not configured");
        error.statusCode = 500;
        throw error;
    }

    const phone = normalizePhone(record.customer_phone);
    const contactButton = /^\d{8}$/.test(phone)
        ? {
              inline_keyboard: [
                  [
                      {
                          text: "WhatsApp customer",
                          url: `https://wa.me/216${phone}`,
                      },
                  ],
              ],
          }
        : undefined;

    await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatCustomerInputMessage(record, validatedInputs), contactButton);
    return jsonResponse({ ok: true, message: "Information sent for delivery." }, 200, corsHeaders);
}

async function handleAdminAction(body, request, env, corsHeaders) {
    requireAdmin(request, env);

    if (body.action === "admin-list-orders") {
        return jsonResponse({ ok: true, orders: await listAdminOrders(env, body.limit) }, 200, corsHeaders);
    }

    if (body.action === "admin-update-order") {
        return jsonResponse({ ok: true, order: await updateAdminOrder(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-save-delivery") {
        return jsonResponse({ ok: true, order: await saveAdminOrderDelivery(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-delete-order") {
        const result = await deleteAdminOrder(env, body);
        return jsonResponse({ ok: true, deleted: result.id }, 200, corsHeaders);
    }

    return jsonResponse({ error: "Unknown admin action" }, 400, corsHeaders);
}

function parseTelegramAction(data) {
    const parts = String(data || "").split("|");
    const [prefix, target] = parts;

    if (prefix !== "hk") {
        throw new Error("Unknown Telegram action");
    }

    if (target === "deliverycode") {
        const orderId = normalizeOrderId(parts[2]);
        if (!/^HK-\d{6}$/.test(orderId)) throw new Error("Unknown Telegram action");
        return {
            orderId,
            target,
        };
    }

    const [, , status, orderIdValue] = parts;
    const orderId = normalizeOrderId(orderIdValue);
    if (!["payment", "delivery"].includes(target) || !/^HK-\d{6}$/.test(orderId)) {
        throw new Error("Unknown Telegram action");
    }

    if (target === "payment" && !["pending", "verified", "rejected"].includes(status)) {
        throw new Error("Invalid payment status");
    }

    if (target === "delivery" && !["waiting", "delivered", "cancelled"].includes(status)) {
        throw new Error("Invalid delivery status");
    }

    return {
        orderId,
        target,
        status,
    };
}

async function handleTelegramDeliveryReply(message, env) {
    const chatId = message?.chat?.id;
    if (String(chatId || "") !== String(env.TELEGRAM_ADMIN_CHAT_ID || "")) return;

    const replyText = String(message.reply_to_message?.text || "");
    if (!replyText.includes("Delivery codes for")) return;

    const match = replyText.match(/HK-\d{6}/i);
    if (!match) return;

    const deliveryText = String(message.text || "").trim();
    if (!deliveryText) {
        await sendTelegramMessage(env, chatId, `${ICONS.warning} Send text delivery details or 0.`);
        return;
    }

    const orderId = normalizeOrderId(match[0]);
    await saveAdminOrderDelivery(env, { orderId, deliveryText });
    const savedText = deliveryText === "0" ? "Delivery details cleared" : "Delivery details saved";
    await sendTelegramMessage(env, chatId, `${ICONS.verify} ${savedText} for ${telegramCode(orderId)}.`);
}

async function handleTelegramWebhook(body, request, env, corsHeaders) {
    requireTelegramWebhook(request, env);

    const callbackQuery = body.callback_query;
    if (!callbackQuery) {
        if (body.message) {
            await handleTelegramDeliveryReply(body.message, env).catch((error) =>
                console.warn("Telegram delivery reply failed", error),
            );
        }
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    if (String(chatId || "") !== String(env.TELEGRAM_ADMIN_CHAT_ID || "")) {
        await answerTelegramCallback(env, callbackQuery.id, "This action is only available in the admin chat.", true).catch((error) =>
            console.warn("Telegram callback answer failed", error),
        );
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    let action;
    try {
        action = parseTelegramAction(callbackQuery.data);
    } catch (error) {
        await answerTelegramCallback(env, callbackQuery.id, error.message || "Unknown action", true).catch((answerError) =>
            console.warn("Telegram callback answer failed", answerError),
        );
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (action.target === "deliverycode") {
        try {
            const record = await getOrderById(env, action.orderId);
            if (!record) throw new Error("Order was not found");

            await answerTelegramCallback(env, callbackQuery.id, `Reply with delivery details for ${action.orderId}`);
            await sendTelegramMessage(
                env,
                chatId,
                [
                    `${ICONS.key} Delivery codes for ${telegramCode(action.orderId)}`,
                    "Reply to this message with delivery text.",
                    "Use Note: CODE for customer copy buttons.",
                    "Send 0 if no code should be delivered.",
                ].join("\n"),
                {
                    force_reply: true,
                    selective: true,
                },
            );
        } catch (error) {
            await answerTelegramCallback(env, callbackQuery.id, error.message || "Could not start delivery flow", true).catch((answerError) =>
                console.warn("Telegram callback answer failed", answerError),
            );
        }

        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    const updateBody = {
        orderId: action.orderId,
        ...(action.target === "payment" ? { paymentStatus: action.status } : { deliveryStatus: action.status }),
    };

    try {
        await updateAdminOrder(env, updateBody);
        const record = await getOrderById(env, action.orderId);
        const order = await getSavedOrderForNotification(env, record);
        const statusLabel = action.target === "payment" ? getPaymentStatusLabel(action.status) : getDeliveryStatusLabel(action.status);

        await answerTelegramCallback(env, callbackQuery.id, `${action.orderId}: ${statusLabel}`);

        if (chatId && messageId) {
            await editTelegramMessage(env, chatId, messageId, formatAdminMessage(order), getAdminOrderKeyboard(order)).catch((error) =>
                console.warn("Telegram message edit failed", error),
            );
        }
    } catch (error) {
        await answerTelegramCallback(env, callbackQuery.id, error.message || "Could not update order", true).catch((answerError) =>
            console.warn("Telegram callback answer failed", answerError),
        );
    }

    return jsonResponse({ ok: true }, 200, corsHeaders);
}

async function handleOrder(request, env, corsHeaders) {
    cleanupProcessedOrders();

    const body = await request.json();
    if (body.callback_query || body.message || body.update_id) {
        return handleTelegramWebhook(body, request, env, corsHeaders);
    }

    if (String(body.action || "").startsWith("admin-")) {
        return handleAdminAction(body, request, env, corsHeaders);
    }

    if (body.action === "order-status") {
        return handleOrderStatus(body, env, corsHeaders);
    }

    if (body.action === "customer-input") {
        return handleCustomerInput(body, env, corsHeaders);
    }

    const checkoutRequestId = String(body.checkoutRequestId || "").trim();
    if (!checkoutRequestId) return jsonResponse({ error: "Missing checkout request ID" }, 400, corsHeaders);

    if (processedOrders.has(checkoutRequestId)) {
        const existing = processedOrders.get(checkoutRequestId);
        if (existing.pending) return jsonResponse({ error: "Order is already being processed" }, 409, corsHeaders);
        return jsonResponse(existing.response, 200, corsHeaders);
    }

    const existingSavedOrder = await getOrderByCheckoutRequestId(env, checkoutRequestId);
    if (existingSavedOrder) {
        if (!existingSavedOrder.telegram_notified_at) {
            if (!env.TELEGRAM_ADMIN_CHAT_ID) {
                const error = new Error("Telegram admin chat ID is not configured");
                error.statusCode = 500;
                throw error;
            }
            const savedOrderForNotification = await getSavedOrderForNotification(env, existingSavedOrder);
            await sendTelegramMessage(
                env,
                env.TELEGRAM_ADMIN_CHAT_ID,
                formatAdminMessage(savedOrderForNotification),
                getAdminOrderKeyboard(savedOrderForNotification),
            );
            await markTelegramNotified(env, existingSavedOrder.id);
        }
        return jsonResponse(getResponsePayloadFromRecord(existingSavedOrder), 200, corsHeaders);
    }

    if (!env.TELEGRAM_ADMIN_CHAT_ID) {
        const error = new Error("Telegram admin chat ID is not configured");
        error.statusCode = 500;
        throw error;
    }

    const [database, settings] = await Promise.all([readDatabase(env), readSettings(env)]);
    const order = buildOrder(body, database, settings);

    processedOrders.set(checkoutRequestId, { createdAt: Date.now(), pending: true });
    const savedOrder = await saveOrderToDatabase(env, checkoutRequestId, order);
    if (savedOrder.duplicate) {
        if (savedOrder.record && !savedOrder.record.telegram_notified_at) {
            const savedOrderForNotification = await getSavedOrderForNotification(env, savedOrder.record);
            await sendTelegramMessage(
                env,
                env.TELEGRAM_ADMIN_CHAT_ID,
                formatAdminMessage(savedOrderForNotification),
                getAdminOrderKeyboard(savedOrderForNotification),
            );
            await markTelegramNotified(env, savedOrder.record.id);
        }
        processedOrders.set(checkoutRequestId, {
            createdAt: Date.now(),
            pending: false,
            response: savedOrder.response,
        });
        return jsonResponse(savedOrder.response, 200, corsHeaders);
    }

    try {
        await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatAdminMessage(order), getAdminOrderKeyboard(order));
        await markTelegramNotified(env, order.id);
    } catch (error) {
        processedOrders.delete(checkoutRequestId);
        throw error;
    }

    processedOrders.set(checkoutRequestId, {
        createdAt: Date.now(),
        pending: false,
        response: savedOrder.response,
    });

    return jsonResponse(savedOrder.response, 200, corsHeaders);
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
