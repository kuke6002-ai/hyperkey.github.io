const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const MAX_QUANTITY = 99;
const processedOrders = new Map();
const pendingDeliveryOrders = new Map();
let customerInputTableReady = false;
let orderSchemaReady = false;

const loginAttempts = new Map();
function checkLoginRateLimit(key) {
    const now = Date.now();
    const windowMs = 10_000;
    const maxAttempts = 5;
    const entry = loginAttempts.get(key);
    if (entry) {
        if (now - entry.start > windowMs) {
            loginAttempts.set(key, { start: now, count: 1 });
            return true;
        }
        if (entry.count >= maxAttempts) return false;
        entry.count++;
        return true;
    }
    loginAttempts.set(key, { start: now, count: 1 });
    return true;
}

const DEFAULT_PAYMENT_SETTINGS = {
    store: {
        name: "HyperKey Store",
        logo: "assets/hyperlogo.png",
        supportWhatsApp: "97671058",
        deliveryMessage: "Delivery is handled through WhatsApp after manual payment review.",
    },
    statusMessages: {
        paymentReview: {
            title: "Payment review",
            message: "We are checking your payment. Refresh later.",
        },
        paymentRejected: {
            title: "Payment rejected",
            message: "Your payment proof could not be verified. Contact support with your Order ID.",
        },
        customerInfoNeeded: {
            title: "Delivery information needed",
            message: "Payment is verified. Send the requested delivery information below.",
        },
        deliveryWaiting: {
            title: "Delivery waiting",
            message: "Your order is being prepared.",
        },
        delivered: {
            title: "Delivered",
            message: "Copy your delivered item below.",
        },
        cancelled: {
            title: "Order cancelled",
            message: "This order was cancelled. Contact support with your Order ID if you need help.",
        },
    },
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
    affiliate: {
        minimumWithdrawal: 10,
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
    link: "\uD83D\uDD17",
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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function getCatalogDb(env) {
    if (!env.product_db) {
        const error = new Error("D1 database binding product_db is not configured");
        error.statusCode = 500;
        throw error;
    }
    return env.product_db;
}

async function ensureOrderSchema(env) {
    if (orderSchemaReady) return;

    const db = getOrderDb(env);
    const migrations = [
        "ALTER TABLE orders ADD COLUMN payment_status_reason TEXT",
        "ALTER TABLE orders ADD COLUMN delivery_status_reason TEXT",
        "ALTER TABLE orders ADD COLUMN updated_at TEXT",
    ];

    for (const migration of migrations) {
        try {
            await db.prepare(migration).run();
        } catch (error) {
            const message = String(error?.message || "");
            if (!/duplicate column|already exists/i.test(message)) throw error;
        }
    }

    await ensureAffiliateSchema(env);
    await ensureSellerSchema(env);

    orderSchemaReady = true;
}

async function ensureAffiliateSchema(env) {
    const db = getOrderDb(env);
    const affiliateMigrations = [
        "ALTER TABLE orders ADD COLUMN referred_by TEXT",
    ];

    for (const migration of affiliateMigrations) {
        try {
            await db.prepare(migration).run();
        } catch (error) {
            const message = String(error?.message || "");
            if (!/duplicate column|already exists/i.test(message)) throw error;
        }
    }

    const tableMigrations = [
        `CREATE TABLE IF NOT EXISTS affiliates (
            ref_code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            total_earnings REAL NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS referral_commissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            ref_code TEXT NOT NULL,
            product_id TEXT,
            commission_amount REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            paid_at TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS affiliate_payouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref_code TEXT NOT NULL,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            recipient_detail TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'requested',
            created_at TEXT NOT NULL,
            updated_at TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS affiliate_sessions (
            token TEXT PRIMARY KEY,
            ref_code TEXT NOT NULL,
            created_at TEXT NOT NULL
        )`,
    ];

    for (const migration of tableMigrations) {
        try {
            await db.prepare(migration).run();
        } catch (error) {
            const message = String(error?.message || "");
            if (/already exists/i.test(message)) continue;
            throw error;
        }
    }
}

async function ensureSellerSchema(env) {
    const db = getOrderDb(env);
    const migrations = [
        "ALTER TABLE order_items ADD COLUMN seller_id TEXT",
        "ALTER TABLE order_items ADD COLUMN seller_status TEXT DEFAULT 'pending'",
    ];

    for (const migration of migrations) {
        try {
            await db.prepare(migration).run();
        } catch (error) {
            const message = String(error?.message || "");
            if (!/duplicate column|already exists/i.test(message)) throw error;
        }
    }

    const tables = [
        `CREATE TABLE IF NOT EXISTS sellers (
            id TEXT PRIMARY KEY,
            store_name TEXT NOT NULL,
            email TEXT,
            phone TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            commission_percent REAL NOT NULL DEFAULT 0,
            balance REAL NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            approved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS seller_sessions (
            token TEXT PRIMARY KEY,
            seller_id TEXT NOT NULL,
            created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS seller_payouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id TEXT NOT NULL,
            amount REAL NOT NULL,
            method TEXT NOT NULL,
            recipient_detail TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'requested',
            created_at TEXT NOT NULL,
            updated_at TEXT
        )`,
        `CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id)`,
        `CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller_id ON seller_payouts(seller_id)`,
    ];

    for (const sql of tables) {
        try {
            await db.prepare(sql).run();
        } catch (error) {
            const message = String(error?.message || "");
            if (/already exists/i.test(message)) continue;
            throw error;
        }
    }
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

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergePaymentSettings(settings = {}) {
    const merged = clone(DEFAULT_PAYMENT_SETTINGS);
    if (settings.store && typeof settings.store === "object") {
        merged.store = {
            ...merged.store,
            ...settings.store,
        };
    }

    if (settings.statusMessages && typeof settings.statusMessages === "object") {
        merged.statusMessages = {
            ...merged.statusMessages,
            ...settings.statusMessages,
        };
    }

    if (Array.isArray(settings.faq)) {
        merged.faq = settings.faq;
    }

    const incomingPayment = settings.payment && typeof settings.payment === "object" ? settings.payment : {};

    Object.entries(incomingPayment).forEach(([method, config]) => {
        const key = method === "ttCard" ? "tt-card" : method;
        if (!merged.payment[key] || !config || typeof config !== "object") return;
        merged.payment[key] = {
            ...merged.payment[key],
            ...config,
        };
    });

    if (settings.affiliate && typeof settings.affiliate === "object") {
        merged.affiliate = {
            ...merged.affiliate,
            ...settings.affiliate,
        };
    }

    return merged;
}

let catalogSchemaReady = false;

async function ensureCatalogSchema(env) {
    if (catalogSchemaReady) return;

    const db = getCatalogDb(env);
    const statements = [
        db.prepare(`CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            label TEXT,
            page TEXT,
            photo TEXT DEFAULT 'assets/hyperlogo.png',
            icon TEXT DEFAULT 'bi-box',
            teaser TEXT,
            heading TEXT,
            description TEXT,
            visible INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            commission_percent REAL NOT NULL DEFAULT 0
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            category TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS store_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)"),
    ];

    await db.batch(statements);

    const catalogMigrations = [
        "ALTER TABLE categories ADD COLUMN commission_percent REAL NOT NULL DEFAULT 0",
        "ALTER TABLE categories ADD COLUMN seller_id TEXT",
        "ALTER TABLE products ADD COLUMN seller_id TEXT",
        "ALTER TABLE products ADD COLUMN approved INTEGER DEFAULT 0",
    ];

    for (const migration of catalogMigrations) {
        try {
            await db.prepare(migration).run();
        } catch (error) {
            const message = String(error?.message || "");
            if (!/duplicate column|already exists/i.test(message)) throw error;
        }
    }

    try {
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)").run();
    } catch { /* ignore */ }
    try {
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_products_approved ON products(approved)").run();
    } catch { /* ignore */ }
    try {
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_categories_seller_id ON categories(seller_id)").run();
    } catch { /* ignore */ }

    catalogSchemaReady = true;
}

async function readAllProducts(env) {
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);
    const rows = await getAllResults(db.prepare("SELECT id, data, seller_id, approved FROM products").bind());
    const products = {};

    const sellerNames = {};
    try {
        const sdb = getOrderDb(env);
        const sellerRows = await getAllResults(sdb.prepare("SELECT id, store_name FROM sellers").bind());
        for (const sr of sellerRows) {
            sellerNames[sr.id] = sr.store_name;
        }
    } catch { /* order DB may not exist yet */ }

    rows.forEach((row) => {
        try {
            products[row.id] = JSON.parse(row.data);
            products[row.id].seller_id = row.seller_id;
            products[row.id].approved = row.approved === 1;
            if (row.seller_id && sellerNames[row.seller_id]) {
                products[row.id].sellerStoreName = sellerNames[row.seller_id];
            }
        } catch {
            products[row.id] = {};
        }
    });
    return products;
}

async function readAllCategories(env) {
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);
    const rows = await getAllResults(
        db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, name ASC").bind(),
    );
    return rows.map((row) => ({
        name: row.name,
        id: row.id,
        page: row.page,
        label: row.label,
        icon: row.icon,
        teaser: row.teaser,
        heading: row.heading,
        description: row.description,
        photo: row.photo,
        visible: row.visible !== 0,
        commissionPercent: Number(row.commission_percent) || 0,
    }));
}

async function readStoreConfig(env) {
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);
    const rows = await getAllResults(db.prepare("SELECT key, value FROM store_config").bind());
    const config = {};
    rows.forEach((row) => {
        try {
            config[row.key] = JSON.parse(row.value);
        } catch {
            config[row.key] = row.value;
        }
    });
    return config;
}

async function readPaymentSettings(env) {
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'payment_settings'").first();
    if (!row) return null;
    try {
        return JSON.parse(row.value);
    } catch {
        return null;
    }
}

async function getCatalogData(env) {
    const [products, categories, config] = await Promise.all([
        readAllProducts(env),
        readAllCategories(env),
        readStoreConfig(env),
    ]);

    return {
        products,
        categories,
        currency: config.currency || "TND",
        routes: config.routes || {},
    };
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

function getProductOptionName(productName, optionLabel) {
    const product = String(productName || "").trim();
    const option = String(optionLabel || "").trim();
    if (!option) return product;
    if (!product) return option;
    if (option.toLowerCase().includes(product.toLowerCase())) return option;
    return `${product} - ${option}`;
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

function normalizeStatusReason(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function getDefaultStatusReason(target, status) {
    if (target === "payment" && status === "rejected") {
        return "Payment proof could not be verified. Contact support with your Order ID.";
    }
    if (target === "delivery" && status === "cancelled") {
        return "Order was cancelled. Contact support with your Order ID.";
    }
    return "";
}

function getStatusMessageKey(record, customerInputs = []) {
    const payment = String(record.payment_status || "").toLowerCase();
    const delivery = String(record.delivery_status || "").toLowerCase();
    if (payment === "rejected") return "paymentRejected";
    if (delivery === "cancelled" || delivery === "canceled") return "cancelled";
    if (delivery === "delivered") return "delivered";
    if (payment === "verified" && Array.isArray(customerInputs) && customerInputs.length) return "customerInfoNeeded";
    if (payment === "verified") return "deliveryWaiting";
    return "paymentReview";
}

function getStatusCopy(settings, record, customerInputs = []) {
    const key = getStatusMessageKey(record, customerInputs);
    const copy = settings?.statusMessages?.[key] || DEFAULT_PAYMENT_SETTINGS.statusMessages[key] || {};
    return {
        key,
        title: copy.title || DEFAULT_PAYMENT_SETTINGS.statusMessages[key]?.title || getPaymentStatusLabel(record.payment_status),
        message: copy.message || DEFAULT_PAYMENT_SETTINGS.statusMessages[key]?.message || "",
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
            throw new Error(`Invalid product: ${productId}. Make sure the product exists in the D1 catalog database.`);
        }
        if (product.visible === false) throw new Error(`Product is hidden: ${productId}`);
        if (product.inStock === false) throw new Error(`Product is out of stock: ${productId}`);

        const variations = getProductVariations(product);
        let variation = null;
        if (variations.length) {
            if (!variationId) throw new Error(`Missing selected option for product: ${productId}`);
            variation = getVariation(product, variationId);
            if (!variation) throw new Error(`Invalid selected option for product: ${productId}`);
            if (variation.visible === false || variation.inStock === false) {
                throw new Error(`Selected option is unavailable: ${productId}`);
            }
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
            name: product.name || productId,
            optionLabel: variation?.label || variation?.name || "",
            category: product.category || "Digital",
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
            sellerId: product.seller_id || null,
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
        referredBy: typeof body.referredBy === "string" ? body.referredBy.trim().toLowerCase() : "",
        database,
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
                payment_status_reason,
                delivery_status_reason,
                updated_at,
                telegram_notified_at,
                referred_by
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
                delivery_status,
                payment_status_reason,
                delivery_status_reason,
                updated_at,
                referred_by
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
                payment_status_reason,
                delivery_status_reason,
                updated_at,
                telegram_notified_at,
                referred_by
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

async function ensureCustomerInputsTable(env) {
    if (customerInputTableReady) return;

    const db = getOrderDb(env);
    await db.batch([
        db.prepare(
            `CREATE TABLE IF NOT EXISTS order_customer_inputs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                variation_id TEXT,
                product_name TEXT NOT NULL,
                input_label TEXT NOT NULL,
                input_value TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            )`,
        ),
        db.prepare("CREATE INDEX IF NOT EXISTS idx_order_customer_inputs_order_id ON order_customer_inputs(order_id)"),
    ]);
    customerInputTableReady = true;
}

async function getOrderCustomerInputs(env, orderId) {
    await ensureCustomerInputsTable(env);
    const db = getOrderDb(env);
    return getAllResults(
        db
            .prepare(
                `SELECT
                    id,
                    product_id,
                    variation_id,
                    product_name,
                    input_label,
                    input_value,
                    created_at
                FROM order_customer_inputs
                WHERE order_id = ?
                ORDER BY id`,
            )
            .bind(orderId),
    );
}

function formatCustomerInputPayload(inputs) {
    return inputs.map((input) => ({
        id: input.id,
        key: getCustomerInputKey(input.product_id, input.variation_id || "", input.input_label || ""),
        productId: input.product_id,
        variationId: input.variation_id || "",
        productName: input.product_name || "",
        label: input.input_label || "Delivery info",
        value: input.input_value || "",
        createdAt: input.created_at,
    }));
}

async function saveOrderCustomerInputs(env, orderId, inputs) {
    await ensureCustomerInputsTable(env);
    const db = getOrderDb(env);
    const now = new Date().toISOString();
    const statements = [db.prepare("DELETE FROM order_customer_inputs WHERE order_id = ?").bind(orderId)];

    inputs.forEach((input) => {
        statements.push(
            db
                .prepare(
                    `INSERT INTO order_customer_inputs (
                        order_id,
                        product_id,
                        variation_id,
                        product_name,
                        input_label,
                        input_value,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                    orderId,
                    input.productId,
                    input.variationId || "",
                    input.productName,
                    input.label,
                    input.value,
                    now,
                ),
        );
    });

    await db.batch(statements);
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
                    line_total,
                    seller_id,
                    seller_status
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

function getCustomerInputConfigs(product) {
    const config = product?.customerInput;
    if (!config || config.enabled === false) return [];

    const labels = Array.isArray(config.labels) && config.labels.length ? config.labels : [config.label || "Player ID"];
    const uniqueLabels = [...new Set(labels.map((label) => String(label || "Player ID").trim().slice(0, 80)).filter(Boolean))];

    return (uniqueLabels.length ? uniqueLabels : ["Player ID"]).map((label) => ({
        enabled: true,
        label,
    }));
}

function getCustomerInputKey(productId, variationId, label = "") {
    return `${productId}::${variationId || ""}::${slugify(label || "delivery-info")}`;
}
async function getCustomerInputRequirements(env, record, items, savedInputs = null) {
    if (record.payment_status !== "verified" || record.delivery_status !== "waiting") return [];

    let products = {};
    try {
        products = await readAllProducts(env);
    } catch (error) {
        console.warn("Could not load product database for customer input requirements", error);
        return [];
    }

    const existingInputs = Array.isArray(savedInputs) ? savedInputs : await getOrderCustomerInputs(env, record.id);
    const savedKeys = new Set(
        existingInputs.map((input) =>
            getCustomerInputKey(input.product_id || input.productId, input.variation_id || input.variationId || "", input.input_label || input.label || ""),
        ),
    );

    return items
        .flatMap((item) => {
            const product = products[item.product_id];
            const customerInputs = getCustomerInputConfigs(product);
            if (!customerInputs.length) return [];

            return customerInputs
                .map((customerInput) => {
                    const key = getCustomerInputKey(item.product_id, item.variation_id || "", customerInput.label);
                    if (savedKeys.has(key)) return null;

                    return {
                        key,
                        productId: item.product_id,
                        variationId: item.variation_id || "",
                        productName: getProductOptionName(item.product_name, item.option_label),
                        optionLabel: item.option_label || "",
                        label: customerInput.label,
                    };
                })
                .filter(Boolean);
        })
        .filter(Boolean);
}
async function getSavedOrderForNotification(env, record) {
    const [items, proofs, deliveries] = await Promise.all([
        getOrderItems(env, record.id),
        getPaymentProofs(env, record.id),
        getOrderDeliveries(env, record.id),
    ]);
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
        paymentStatusReason: record.payment_status_reason || "",
        deliveryStatus: record.delivery_status,
        deliveryStatusLabel: getDeliveryStatusLabel(record.delivery_status),
        deliveryStatusReason: record.delivery_status_reason || "",
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
        referredBy: record.referred_by || "",
        deliveryText: deliveries.map((d) => d.delivery_text).join("\n"),
    };
}

async function getOrderStatusPayload(env, record) {
    const [items, deliveries, savedInputs, settings] = await Promise.all([
        getOrderItems(env, record.id),
        getOrderDeliveries(env, record.id),
        getOrderCustomerInputs(env, record.id),
        readPaymentSettings(env).then((s) => (s ? mergePaymentSettings(s) : clone(DEFAULT_PAYMENT_SETTINGS))),
    ]);
    const customerInputs = await getCustomerInputRequirements(env, record, items, savedInputs);
    const statusCopy = getStatusCopy(settings, record, customerInputs);
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
            paymentStatusReason: record.payment_status_reason || "",
            deliveryStatusCode: record.delivery_status,
            deliveryStatus: getDeliveryStatusLabel(record.delivery_status),
            deliveryStatusReason: record.delivery_status_reason || "",
            statusMessageKey: statusCopy.key,
            statusTitle: statusCopy.title,
            statusMessage: statusCopy.message,
            items: items.map((item) => ({
                productId: item.product_id,
                variationId: item.variation_id || "",
                productName: getProductOptionName(item.product_name, item.option_label),
                optionLabel: item.option_label || "",
                quantity: Number(item.quantity),
                unitPrice: Number(item.unit_price),
                lineTotal: Number(item.line_total),
            })),
            deliveries: record.payment_status === "verified" ? formatDeliveryPayload(deliveries) : [],
            customerInputs,
            referredBy: record.referred_by || "",
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
    const [items, proofs, deliveries, savedInputs] = await Promise.all([
        getOrderItems(env, record.id),
        getPaymentProofs(env, record.id),
        getOrderDeliveries(env, record.id),
        getOrderCustomerInputs(env, record.id),
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
        paymentStatusReason: record.payment_status_reason || "",
        deliveryStatus: record.delivery_status,
        deliveryStatusLabel: getDeliveryStatusLabel(record.delivery_status),
        deliveryStatusReason: record.delivery_status_reason || "",
        telegramNotifiedAt: record.telegram_notified_at,
        referredBy: record.referred_by || "",
        items: items.map((item) => ({
            productId: item.product_id,
            variationId: item.variation_id || "",
            productName: getProductOptionName(item.product_name, item.option_label),
            optionLabel: item.option_label || "",
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            lineTotal: Number(item.line_total),
        })),
        proofs: formatAdminProofs(proofs),
        deliveries: formatDeliveryPayload(deliveries),
        customerInputs: formatCustomerInputPayload(savedInputs),
        customerInputRequirements: await getCustomerInputRequirements(env, record, items, savedInputs),
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
                    payment_status_reason,
                    delivery_status_reason,
                    updated_at,
                    telegram_notified_at,
                    referred_by
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

        const reason = normalizeStatusReason(body.paymentStatusReason);
        updates.push("payment_status_reason = ?");
        values.push(body.paymentStatus === "rejected" ? reason || getDefaultStatusReason("payment", body.paymentStatus) : "");
    }

    if (typeof body.deliveryStatus === "string" && body.deliveryStatus) {
        if (!allowedDelivery.has(body.deliveryStatus)) throw new Error("Invalid delivery status");
        updates.push("delivery_status = ?");
        values.push(body.deliveryStatus);

        const reason = normalizeStatusReason(body.deliveryStatusReason);
        updates.push("delivery_status_reason = ?");
        values.push(body.deliveryStatus === "cancelled" ? reason || getDefaultStatusReason("delivery", body.deliveryStatus) : "");
    }

    if (!updates.length) throw new Error("No status update was provided");
    updates.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(orderId);

    const db = getOrderDb(env);
    await db.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

    const record = await getOrderById(env, orderId);
    if (!record) throw new Error("Order was not found");

    if (body.deliveryStatus === "delivered") {
        if (record.referred_by) {
            await calculateAndSaveCommissions(env, record);
        }
        const sellerItems = await getAllResults(
            db.prepare("SELECT id, seller_id, line_total FROM order_items WHERE order_id = ? AND seller_id IS NOT NULL AND seller_status != 'delivered'").bind(orderId)
        );
        if (sellerItems.length) {
            const sellerEarnings = {};
            for (const item of sellerItems) {
                const seller = await db.prepare("SELECT id, commission_percent FROM sellers WHERE id = ?").bind(item.seller_id).first();
                if (seller) {
                    const commissionPercent = Number(seller.commission_percent) || 0;
                    const itemTotal = Number(item.line_total || 0);
                    const earning = Number((itemTotal * (100 - commissionPercent) / 100).toFixed(3));
                    if (earning > 0) {
                        sellerEarnings[item.seller_id] = (sellerEarnings[item.seller_id] || 0) + earning;
                    }
                }
            }
            const batchStatements = sellerItems.map((item) =>
                db.prepare("UPDATE order_items SET seller_status = 'delivered' WHERE id = ?").bind(item.id)
            );
            Object.entries(sellerEarnings).forEach(([sellerId, amount]) => {
                batchStatements.push(
                    db.prepare("UPDATE sellers SET balance = balance + ? WHERE id = ?").bind(amount, sellerId)
                );
            });
            await db.batch(batchStatements);
        }
    }

    if (body.paymentStatus === "verified" && record.telegram_username) {
        sendCustomerTelegramNotification(env, record, "payment_verified").catch((err) =>
            console.warn("Customer Telegram notification failed", err),
        );
    }

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
            await db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").bind(new Date().toISOString(), orderId).run();
        } else {
            const now = new Date().toISOString();
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
                    .bind(orderId, deliveryText, now),
                db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").bind(now, orderId),
            ]);
        }
    } catch (error) {
        if (/no such table/i.test(String(error?.message || ""))) {
            throw new Error("order_deliveries table is missing. Run schema.sql in Cloudflare D1.");
        }
        throw error;
    }

    if (deliveryText && deliveryText !== "0" && record.telegram_username) {
        sendCustomerTelegramNotification(env, record, "delivery", deliveryText).catch((err) =>
            console.warn("Customer Telegram notification failed", err),
        );
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
            db.prepare("DELETE FROM order_customer_inputs WHERE order_id = ?").bind(orderId),
            db.prepare("DELETE FROM payment_proofs WHERE order_id = ?").bind(orderId),
            db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(orderId),
            db.prepare("DELETE FROM referral_commissions WHERE order_id = ?").bind(orderId),
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
                    delivery_status,
                    payment_status_reason,
                    delivery_status_reason,
                    updated_at,
                    referred_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                "",
                "",
                order.createdAt,
                order.referredBy || null,
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
                        line_total,
                        seller_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    line.sellerId || null,
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
    const result = await db
        .prepare("UPDATE orders SET telegram_notified_at = ? WHERE id = ? AND telegram_notified_at IS NULL")
        .bind(new Date().toISOString(), orderId)
        .run();
    return (result.changes || 0) > 0;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function truncateLines(lines, maxLen = 3800) {
    const result = [];
    let total = 0;
    for (const line of lines) {
        const len = line.length + 1;
        if (total + len > maxLen) {
            result.push(`...and ${lines.length - result.length} more`);
            break;
        }
        result.push(line);
        total += len;
    }
    return result;
}

function telegramCode(value) {
    return `<code>${escapeHtml(value)}</code>`;
}

function formatProofLines(order) {
    if (order.paymentProof.type === "tt-card") {
        const codes = order.paymentProof.cardCodes.map((code, index) => `${index + 1}. ${telegramCode(code)}`);
        const truncated = truncateLines(codes, 1500);
        return [
            `${ICONS.ticket} Cards: ${order.paymentProof.cardCodes.length} x ${escapeHtml(formatTndAmount(order.paymentDetails.cardValue))}`,
            "Codes:",
            ...truncated,
        ];
    }

    return [
        `${ICONS.search} ${escapeHtml(order.paymentProof.label)}: ${telegramCode(order.paymentProof.reference)}`,
    ];
}

function formatAdminMessage(order) {
    const productLines = order.lines.map((line) => {
        const quantity = Number(line.quantity) > 1 ? `${line.quantity}\u00D7 ` : "";
        const productLabel = getProductOptionName(line.name, line.optionLabel);
        return `  \u2022 ${escapeHtml(quantity)}${escapeHtml(productLabel)}  \u2014 <code>${escapeHtml(formatTndAmount(line.lineTotal))}</code>`;
    });
    const products = truncateLines(productLines, 2000).join("\n");
    const itemCount = order.lines.reduce((sum, l) => sum + Number(l.quantity), 0);

    const lines = [
        `${ICONS.cart} <b>${escapeHtml(order.id)}</b>`,
        "\u2501".repeat(21),
        `${ICONS.phone} <code>${escapeHtml(formatTunisianPhone(order.customerPhone))}</code>`,
    ];

    if (order.referredBy) {
        lines.push(`${ICONS.link} <code>${escapeHtml(order.referredBy)}</code>`);
    }

    lines.push(
        "",
        `<b>${escapeHtml(formatTndAmount(order.total))}</b> \u2014 ${itemCount} item${itemCount !== 1 ? "s" : ""}`,
        products,
        "",
        `<b>Payment:</b> <code>${escapeHtml(formatTndAmount(order.total))}</code> via ${escapeHtml(order.paymentMethodLabel)}`,
        ...formatProofLines(order).map((l) => `   ${l}`),
        `   Status:  ${order.paymentStatus === "verified" ? ICONS.verify : ICONS.warning} ${escapeHtml(order.paymentStatusLabel)}`,
    );

    if (order.paymentStatusReason) {
        lines.push(`   Reason: ${escapeHtml(order.paymentStatusReason)}`);
    }

    lines.push(
        "",
        `<b>Delivery:</b> ${ICONS.delivery} ${escapeHtml(order.deliveryStatusLabel || getDeliveryStatusLabel(order.deliveryStatus || "waiting"))}`,
    );

    if (order.deliveryStatusReason) {
        lines.push(`   Reason: ${escapeHtml(order.deliveryStatusReason)}`);
    }

    if (order.deliveryText) {
        const deliveryLines = order.deliveryText.split("\n").map((l) => l.trim()).filter(Boolean);
        if (deliveryLines.length) {
            lines.push(`${ICONS.key} ${deliveryLines.join("\n   ")}`);
        }
    }

    return lines.filter((line) => line !== "").join("\n");
}

function getAdminOrderKeyboard(order) {
    const phone = normalizePhone(order.customerPhone);
    const paymentStatus = String(order.paymentStatus || "").toLowerCase();
    const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
    const keyboard = [];

    if (deliveryStatus === "delivered") {
        keyboard.push([
            {
                text: "\u21A9\uFE0F Undo delivery",
                callback_data: `hk|delivery|waiting|${order.id}`,
            },
        ]);
    } else if (paymentStatus === "verified") {
        keyboard.push(
            [
                {
                    text: "\uD83D\uDE9A Delivered",
                    callback_data: `hk|delivery|delivered|${order.id}`,
                },
                {
                    text: "\u23F3 Not delivered",
                    callback_data: `hk|delivery|waiting|${order.id}`,
                },
            ],
            [
                {
                    text: "\uD83D\uDD11 Add delivery keys / note",
                    callback_data: `hk|deliverycode|${order.id}`,
                },
            ],
        );
    } else {
        keyboard.push([
            {
                text: "\u2705 Verify payment",
                callback_data: `hk|payment|verified|${order.id}`,
            },
            {
                text: "\u274C Reject payment",
                callback_data: `hk|payment|rejected|${order.id}`,
            },
        ]);
    }

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
        inline_keyboard: keyboard,
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

async function deleteTelegramMessage(env, chatId, messageId) {
    await callTelegramApi(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function sendCustomerTelegramNotification(env, record, type, extraText) {
    const username = String(record.telegram_username || "").replace(/^@/, "").trim();
    if (!username) return;

    const orderId = record.id;
    let text;

    if (type === "payment_verified") {
        text = `${ICONS.verify} Your order ${escapeHtml(orderId)} payment has been verified. We will process it shortly. Thank you!`;
    } else if (type === "delivery") {
        text = `${ICONS.key} Delivery details for ${escapeHtml(orderId)}:\n${extraText || ""}\n\nThank you for shopping with us!`;
    } else {
        return;
    }

    await sendTelegramMessage(env, `@${username}`, text);
}

function cleanupProcessedOrders() {
    const now = Date.now();
    for (const [key, value] of processedOrders.entries()) {
        if (now - value.createdAt > IDEMPOTENCY_TTL_MS) processedOrders.delete(key);
    }
}

async function handleOrderStatus(body, env, corsHeaders) {
    await ensureOrderSchema(env);
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
    await ensureOrderSchema(env);
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
            String(
                input?.key ||
                    getCustomerInputKey(
                        String(input?.productId || "").trim(),
                        String(input?.variationId || "").trim(),
                        String(input?.label || "").trim(),
                    ),
            ),
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

    await saveOrderCustomerInputs(env, record.id, validatedInputs);
    await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatCustomerInputMessage(record, validatedInputs), contactButton);
    return jsonResponse({ ok: true, message: "Information sent for delivery." }, 200, corsHeaders);
}

async function listAdminAffiliates(env) {
    await ensureOrderSchema(env);
    const db = getOrderDb(env);
    const rows = await getAllResults(db.prepare("SELECT ref_code, name, phone, total_earnings, active, created_at FROM affiliates ORDER BY created_at DESC").bind());
    return rows.map((r) => ({
        refCode: r.ref_code,
        name: r.name,
        phone: r.phone,
        totalEarnings: Number(r.total_earnings),
        active: !!r.active,
        createdAt: r.created_at,
    }));
}

async function createAdminAffiliate(env, body) {
    await ensureOrderSchema(env);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim().replace(/\D/g, "");
    const password = String(body.password || "").trim();
    if (!name) throw new Error("Affiliate name is required");
    if (!phone) throw new Error("Affiliate phone is required");
    if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    let refCode = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!refCode) throw new Error("Could not generate affiliate code from name");

    const db = getOrderDb(env);
    let existing = await db.prepare("SELECT ref_code FROM affiliates WHERE ref_code = ?").bind(refCode).first();
    let suffix = 2;
    const originalCode = refCode;
    while (existing) {
        refCode = `${originalCode}-${suffix}`;
        suffix++;
        existing = await db.prepare("SELECT ref_code FROM affiliates WHERE ref_code = ?").bind(refCode).first();
    }

    const now = new Date().toISOString();
    await db.prepare(
        "INSERT INTO affiliates (ref_code, name, phone, password_hash, total_earnings, active, created_at) VALUES (?, ?, ?, ?, 0, 1, ?)"
    ).bind(refCode, name, phone, hashHex, now).run();

    return { refCode, name, phone };
}

async function toggleAdminAffiliate(env, body) {
    await ensureOrderSchema(env);
    const refCode = String(body.refCode || "").trim().toLowerCase();
    if (!refCode) throw new Error("Affiliate code is required");
    const db = getOrderDb(env);
    const affiliate = await db.prepare("SELECT active FROM affiliates WHERE ref_code = ?").bind(refCode).first();
    if (!affiliate) throw new Error("Affiliate not found");
    const newActive = affiliate.active ? 0 : 1;
    await db.prepare("UPDATE affiliates SET active = ? WHERE ref_code = ?").bind(newActive, refCode).run();
    return { refCode, active: !!newActive };
}

async function deleteAdminAffiliate(env, body) {
    await ensureOrderSchema(env);
    const refCode = String(body.refCode || "").trim().toLowerCase();
    if (!refCode) throw new Error("Affiliate code is required");
    const db = getOrderDb(env);
    await db.batch([
        db.prepare("DELETE FROM referral_commissions WHERE ref_code = ?").bind(refCode),
        db.prepare("DELETE FROM affiliate_payouts WHERE ref_code = ?").bind(refCode),
        db.prepare("DELETE FROM affiliates WHERE ref_code = ?").bind(refCode),
    ]);
}

async function getAdminAffiliateDetail(env, body) {
    await ensureOrderSchema(env);
    const refCode = String(body.refCode || "").trim().toLowerCase();
    if (!refCode) throw new Error("Affiliate code is required");
    const db = getOrderDb(env);

    const affiliate = await db.prepare("SELECT ref_code, name, phone, total_earnings, active, created_at FROM affiliates WHERE ref_code = ?").bind(refCode).first();
    if (!affiliate) throw new Error("Affiliate not found");

    const [commissions, payouts] = await Promise.all([
        getAllResults(db.prepare("SELECT id, order_id, product_id, commission_amount, status, created_at, paid_at FROM referral_commissions WHERE ref_code = ? ORDER BY created_at DESC LIMIT 100").bind(refCode)),
        getAllResults(db.prepare("SELECT id, amount, method, recipient_detail, status, created_at, updated_at FROM affiliate_payouts WHERE ref_code = ? ORDER BY created_at DESC LIMIT 50").bind(refCode)),
    ]);

    const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const pendingCommissions = commissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + Number(c.commission_amount), 0);
    const totalOrders = new Set(commissions.map((c) => c.order_id)).size;

    return {
        affiliate: {
            refCode: affiliate.ref_code,
            name: affiliate.name,
            phone: affiliate.phone,
            totalEarnings: Number(affiliate.total_earnings),
            active: !!affiliate.active,
            createdAt: affiliate.created_at,
        },
        stats: {
            totalOrders,
            totalCommissions,
            pendingCommissions,
            paidCommissions: totalCommissions - pendingCommissions,
        },
        commissions: commissions.map((c) => ({
            id: c.id,
            orderId: c.order_id,
            productId: c.product_id || "",
            amount: Number(c.commission_amount),
            status: c.status,
            createdAt: c.created_at,
            paidAt: c.paid_at || "",
        })),
        payouts: payouts.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            recipientDetail: p.recipient_detail,
            status: p.status,
            createdAt: p.created_at,
            updatedAt: p.updated_at || "",
        })),
    };
}

async function changeAdminAffiliatePassword(env, body) {
    await ensureOrderSchema(env);
    const refCode = String(body.refCode || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (!refCode) throw new Error("Affiliate code is required");
    if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const db = getOrderDb(env);
    const result = await db.prepare("UPDATE affiliates SET password_hash = ? WHERE ref_code = ?").bind(hashHex, refCode).run();
    if (!result.meta?.changes) throw new Error("Affiliate not found");
}

async function listAdminPayouts(env) {
    await ensureOrderSchema(env);
    const db = getOrderDb(env);
    const rows = await getAllResults(db.prepare("SELECT id, ref_code, amount, method, recipient_detail, status, created_at, updated_at FROM affiliate_payouts ORDER BY created_at DESC LIMIT 50").bind());
    return rows.map((r) => ({
        id: r.id,
        refCode: r.ref_code,
        amount: Number(r.amount),
        method: r.method,
        recipientDetail: r.recipient_detail,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at || "",
    }));
}

async function approveAdminPayout(env, body) {
    await ensureOrderSchema(env);
    const id = Number(body.id);
    const newStatus = String(body.status || "").trim();
    if (!id || !["paid", "rejected"].includes(newStatus)) throw new Error("Invalid payout status");
    const db = getOrderDb(env);
    const payout = await db.prepare("SELECT id, ref_code, amount, status FROM affiliate_payouts WHERE id = ?").bind(id).first();
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "requested") throw new Error("Payout already processed");

    const now = new Date().toISOString();
    if (newStatus === "paid") {
        await db.batch([
            db.prepare("UPDATE affiliate_payouts SET status = 'paid', updated_at = ? WHERE id = ?").bind(now, id),
            db.prepare("UPDATE referral_commissions SET status = 'paid', paid_at = ? WHERE ref_code = ? AND status = 'pending'").bind(now, payout.ref_code),
        ]);
    } else {
        await db.prepare("UPDATE affiliate_payouts SET status = 'rejected', updated_at = ? WHERE id = ?").bind(now, id).run();
        await db.prepare("UPDATE affiliates SET total_earnings = total_earnings - ? WHERE ref_code = ?").bind(payout.amount, payout.ref_code).run();
    }

    return { id, status: newStatus };
}

async function listAdminSellers(env) {
    await ensureOrderSchema(env);
    const db = getOrderDb(env);
    const rows = await getAllResults(db.prepare("SELECT id, store_name, email, phone, commission_percent, balance, active, approved, created_at FROM sellers ORDER BY created_at DESC").bind());
    return rows.map((r) => ({
        id: r.id,
        storeName: r.store_name,
        email: r.email || "",
        phone: r.phone,
        commissionPercent: Number(r.commission_percent),
        balance: Number(r.balance),
        active: !!r.active,
        approved: !!r.approved,
        createdAt: r.created_at,
    }));
}

async function createAdminSeller(env, body) {
    await ensureOrderSchema(env);
    const storeName = String(body.storeName || "").trim();
    const phone = String(body.phone || "").trim().replace(/\D/g, "");
    const password = String(body.password || "").trim();
    const commissionPercent = Number(body.commissionPercent) || 0;
    if (!storeName) throw new Error("Store name is required");
    if (!phone) throw new Error("Phone is required");
    if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    let sellerId = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!sellerId) throw new Error("Could not generate seller ID from store name");

    const db = getOrderDb(env);
    let existing = await db.prepare("SELECT id FROM sellers WHERE id = ?").bind(sellerId).first();
    let suffix = 2;
    const originalId = sellerId;
    while (existing) {
        sellerId = `${originalId}-${suffix}`;
        suffix++;
        existing = await db.prepare("SELECT id FROM sellers WHERE id = ?").bind(sellerId).first();
    }

    const now = new Date().toISOString();
    await db.prepare(
        "INSERT INTO sellers (id, store_name, email, phone, password_hash, commission_percent, balance, active, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 1, ?)"
    ).bind(sellerId, storeName, body.email || "", phone, hashHex, commissionPercent, now).run();

    return { id: sellerId, storeName, phone, commissionPercent };
}

async function toggleAdminSeller(env, body) {
    await ensureOrderSchema(env);
    const id = String(body.id || "").trim().toLowerCase();
    if (!id) throw new Error("Seller ID is required");
    const db = getOrderDb(env);
    const seller = await db.prepare("SELECT active FROM sellers WHERE id = ?").bind(id).first();
    if (!seller) throw new Error("Seller not found");
    const newActive = seller.active ? 0 : 1;
    await db.prepare("UPDATE sellers SET active = ? WHERE id = ?").bind(newActive, id).run();
    return { id, active: !!newActive };
}

async function approveAdminSeller(env, body) {
    await ensureOrderSchema(env);
    const id = String(body.id || "").trim().toLowerCase();
    if (!id) throw new Error("Seller ID is required");
    const db = getOrderDb(env);
    const seller = await db.prepare("SELECT id FROM sellers WHERE id = ?").bind(id).first();
    if (!seller) throw new Error("Seller not found");
    await db.prepare("UPDATE sellers SET approved = 1 WHERE id = ?").bind(id).run();
    return { id, approved: true };
}

async function changeAdminSellerPassword(env, body) {
    await ensureOrderSchema(env);
    const id = String(body.id || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (!id) throw new Error("Seller ID is required");
    if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const db = getOrderDb(env);
    const result = await db.prepare("UPDATE sellers SET password_hash = ? WHERE id = ?").bind(hashHex, id).run();
    if (!result.meta?.changes) throw new Error("Seller not found");
}

async function deleteAdminSeller(env, body) {
    await ensureOrderSchema(env);
    const id = String(body.id || "").trim().toLowerCase();
    if (!id) throw new Error("Seller ID is required");
    const db = getOrderDb(env);
    await db.batch([
        db.prepare("DELETE FROM seller_payouts WHERE seller_id = ?").bind(id),
        db.prepare("DELETE FROM seller_sessions WHERE seller_id = ?").bind(id),
        db.prepare("DELETE FROM sellers WHERE id = ?").bind(id),
    ]);
}

async function adminListSellerPayouts(env) {
    await ensureOrderSchema(env);
    const db = getOrderDb(env);
    const rows = await getAllResults(db.prepare("SELECT sp.id, sp.seller_id, sp.amount, sp.method, sp.recipient_detail, sp.status, sp.created_at, sp.updated_at, s.store_name FROM seller_payouts sp LEFT JOIN sellers s ON s.id = sp.seller_id ORDER BY sp.created_at DESC LIMIT 50").bind());
    return rows.map((r) => ({
        id: r.id,
        sellerId: r.seller_id,
        storeName: r.store_name || r.seller_id,
        amount: Number(r.amount),
        method: r.method,
        recipientDetail: r.recipient_detail,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at || "",
    }));
}

async function adminApproveSellerPayout(env, body) {
    await ensureOrderSchema(env);
    const id = Number(body.id);
    const newStatus = String(body.status || "").trim();
    if (!id || !["paid", "rejected"].includes(newStatus)) throw new Error("Invalid payout status");
    const db = getOrderDb(env);
    const payout = await db.prepare("SELECT id, seller_id, amount, status FROM seller_payouts WHERE id = ?").bind(id).first();
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "requested") throw new Error("Payout already processed");

    const now = new Date().toISOString();
    if (newStatus === "paid") {
        await db.batch([
            db.prepare("UPDATE seller_payouts SET status = 'paid', updated_at = ? WHERE id = ?").bind(now, id),
            db.prepare("UPDATE sellers SET balance = balance - ? WHERE id = ?").bind(payout.amount, payout.seller_id),
        ]);
    } else {
        await db.prepare("UPDATE seller_payouts SET status = 'rejected', updated_at = ? WHERE id = ?").bind(now, id).run();
    }

    return { id, status: newStatus };
}

async function adminListPendingProducts(env) {
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);
    const rows = await getAllResults(db.prepare("SELECT id, data, category, seller_id, created_at, updated_at FROM products WHERE seller_id IS NOT NULL AND approved = 0 ORDER BY created_at DESC").bind());
    return rows.map((r) => ({
        id: r.id,
        data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
        category: r.category || "",
        sellerId: r.seller_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}

async function adminApproveProduct(env, body) {
    await ensureCatalogSchema(env);
    const productId = String(body.id || "").trim();
    const approve = body.approve !== false;
    if (!productId) throw new Error("Product ID is required");
    const db = getCatalogDb(env);
    const product = await db.prepare("SELECT id, seller_id FROM products WHERE id = ?").bind(productId).first();
    if (!product) throw new Error("Product not found");
    if (!product.seller_id) throw new Error("Cannot approve store-owned products");
    if (approve) {
        await db.prepare("UPDATE products SET approved = 1, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), productId).run();
    } else {
        await db.prepare("DELETE FROM products WHERE id = ? AND seller_id IS NOT NULL").bind(productId).run();
    }
    return { id: productId, approved: approve };
}

async function handleAdminAction(body, request, env, corsHeaders) {
    requireAdmin(request, env);
    await ensureOrderSchema(env);

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

    if (body.action === "admin-save-data") {
        return jsonResponse(await handleAdminSaveData(body, request, env, corsHeaders), 200, corsHeaders);
    }

    if (body.action === "admin-save-settings") {
        return jsonResponse(await handleAdminSaveSettings(body, request, env, corsHeaders), 200, corsHeaders);
    }

    if (body.action === "admin-upload-image") {
        return jsonResponse(await handleAdminUploadImage(body, env), 200, corsHeaders);
    }

    if (body.action === "admin-verify") {
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (body.action === "admin-list-affiliates") {
        return jsonResponse({ ok: true, affiliates: await listAdminAffiliates(env) }, 200, corsHeaders);
    }

    if (body.action === "admin-create-affiliate") {
        return jsonResponse({ ok: true, affiliate: await createAdminAffiliate(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-toggle-affiliate") {
        return jsonResponse({ ok: true, affiliate: await toggleAdminAffiliate(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-delete-affiliate") {
        await deleteAdminAffiliate(env, body);
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (body.action === "admin-change-affiliate-password") {
        await changeAdminAffiliatePassword(env, body);
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (body.action === "admin-affiliate-detail") {
        return jsonResponse({ ok: true, ...await getAdminAffiliateDetail(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-list-payouts") {
        return jsonResponse({ ok: true, payouts: await listAdminPayouts(env) }, 200, corsHeaders);
    }

    if (body.action === "admin-approve-payout") {
        return jsonResponse({ ok: true, payout: await approveAdminPayout(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-list-sellers") {
        return jsonResponse({ ok: true, sellers: await listAdminSellers(env) }, 200, corsHeaders);
    }

    if (body.action === "admin-create-seller") {
        return jsonResponse({ ok: true, seller: await createAdminSeller(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-toggle-seller") {
        return jsonResponse({ ok: true, seller: await toggleAdminSeller(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-approve-seller") {
        return jsonResponse({ ok: true, seller: await approveAdminSeller(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-change-seller-password") {
        await changeAdminSellerPassword(env, body);
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (body.action === "admin-delete-seller") {
        await deleteAdminSeller(env, body);
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (body.action === "admin-list-seller-payouts") {
        return jsonResponse({ ok: true, payouts: await adminListSellerPayouts(env) }, 200, corsHeaders);
    }

    if (body.action === "admin-approve-seller-payout") {
        return jsonResponse({ ok: true, payout: await adminApproveSellerPayout(env, body) }, 200, corsHeaders);
    }

    if (body.action === "admin-list-pending-products") {
        return jsonResponse({ ok: true, products: await adminListPendingProducts(env) }, 200, corsHeaders);
    }

    if (body.action === "admin-approve-product") {
        return jsonResponse({ ok: true, result: await adminApproveProduct(env, body) }, 200, corsHeaders);
    }

    return jsonResponse({ error: "Unknown admin action" }, 400, corsHeaders);
}

async function handleAdminSaveData(body, request, env, corsHeaders) {
    requireAdmin(request, env);
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);
    const now = new Date().toISOString();
    const statements = [];

    if (body.categories && Array.isArray(body.categories)) {
        statements.push(db.prepare("DELETE FROM categories").bind());
        body.categories.forEach((cat, index) => {
            const commissionPercent = Number(cat.commissionPercent) || 0;
            console.log(`[admin-save] Category "${cat.name}" commissionPercent=${commissionPercent} (raw: "${cat.commissionPercent}")`);
            statements.push(
                db
                    .prepare(
                        `INSERT INTO categories (id, name, label, page, photo, icon, teaser, heading, description, visible, sort_order, commission_percent)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        cat.id || `cat-${index}`,
                        cat.name || "",
                        cat.label || cat.name || "",
                        cat.page || "",
                        cat.photo || "assets/hyperlogo.png",
                        cat.icon || "bi-box",
                        cat.teaser || "",
                        cat.heading || cat.label || cat.name || "",
                        cat.description || "",
                        cat.visible !== false ? 1 : 0,
                        index,
                        commissionPercent,
                    ),
            );
        });
    }

    if (body.products && typeof body.products === "object") {
        statements.push(db.prepare("DELETE FROM products").bind());
        Object.entries(body.products).forEach(([id, product]) => {
            statements.push(
                db
                    .prepare("INSERT INTO products (id, data, category, seller_id, approved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                    .bind(id, JSON.stringify(product), product.category || "Digital", product.seller_id || null, product.seller_id ? 1 : 0, now, now),
            );
        });
    }

    if (body.currency) {
        statements.push(
            db
                .prepare("INSERT OR REPLACE INTO store_config (key, value) VALUES (?, ?)")
                .bind("currency", JSON.stringify(body.currency)),
        );
    }

    if (body.routes && typeof body.routes === "object") {
        statements.push(
            db
                .prepare("INSERT OR REPLACE INTO store_config (key, value) VALUES (?, ?)")
                .bind("routes", JSON.stringify(body.routes)),
        );
    }

    if (!statements.length) return { ok: true };

    const batchResults = await db.batch(statements);

    const errors = batchResults
        .map((r, i) => (r.error ? `Statement ${i}: ${r.error}` : null))
        .filter(Boolean);
    if (errors.length) {
        const errorMsg = errors.join("; ");
        console.error("[admin-save] D1 batch errors:", errorMsg);
        return { ok: false, error: errorMsg };
    }

    console.log(`[admin-save] Successfully saved ${statements.length} statements (${body.categories?.length || 0} categories, ${body.products ? Object.keys(body.products).length : 0} products)`);
    return { ok: true };
}

async function handleAdminSaveSettings(body, request, env, corsHeaders) {
    requireAdmin(request, env);
    await ensureCatalogSchema(env);
    const db = getCatalogDb(env);

    if (body.settings && typeof body.settings === "object") {
        const result = await db
            .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
            .bind("payment_settings", JSON.stringify(body.settings))
            .run();
        if (!result.success) {
            console.error("D1 run error:", result.error);
            return { ok: false, error: result.error || "Failed to save settings" };
        }
    }

    return { ok: true };
}

async function handleAdminUploadImage(body, env) {
    const fileName = String(body.fileName || "").trim();
    const base64 = String(body.base64 || "").trim();
    if (!fileName || !base64) {
        return { error: "Missing fileName or base64" };
    }

    const token = env.GITHUB_TOKEN;
    const owner = env.GITHUB_OWNER || "kuke6002-ai";
    const repo = env.GITHUB_REPO || "hyperkey.github.io";
    const branch = env.GITHUB_BRANCH || "main";

    if (!token) {
        return { error: "GITHUB_TOKEN is not configured on the server" };
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(fileName)}`;

    let sha = null;
    try {
        const checkRes = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, "User-Agent": "hyperkey-worker" },
        });
        if (checkRes.ok) {
            const existing = await checkRes.json();
            sha = existing.sha;
        }
    } catch {}

    const putBody = {
        message: sha ? `Update ${fileName}` : `Upload ${fileName}`,
        content: base64,
        branch,
    };
    if (sha) putBody.sha = sha;

    const res = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "hyperkey-worker",
        },
        body: JSON.stringify(putBody),
    });

    const result = await res.json();

    if (!res.ok) {
        const msg = result.message || `GitHub API returned ${res.status}`;
        if (result.errors && result.errors.length) {
            return { error: `${msg}: ${result.errors.map((e) => e.message).join("; ")}` };
        }
        return { error: msg };
    }

    return { ok: true, path: fileName };
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
    if (String(chatId || "") !== String(env.TELEGRAM_ADMIN_CHAT_ID || "")) return false;

    const key = String(chatId);
    const entry = pendingDeliveryOrders.get(key);
    if (!entry) return false;

    const deliveryText = String(message.text || "").trim();
    if (!deliveryText) {
        await sendTelegramMessage(env, chatId, `${ICONS.warning} Send text delivery details or 0.`);
        return true;
    }

    const { orderId, messageId: orderMsgId } = entry;
    pendingDeliveryOrders.delete(key);

    try {
        await saveAdminOrderDelivery(env, { orderId, deliveryText });
        const record = await getOrderById(env, orderId);
        const order = await getSavedOrderForNotification(env, record);
        await editTelegramMessage(env, chatId, orderMsgId, formatAdminMessage(order), getAdminOrderKeyboard(order));
        await deleteTelegramMessage(env, chatId, message.message_id).catch((err) =>
            console.warn("Telegram delete reply failed", err),
        );
    } catch (error) {
        await sendTelegramMessage(env, chatId, `${ICONS.warning} Delivery save failed: ${error.message}`);
    }
    return true;
}

async function handleTelegramWebhook(body, request, env, corsHeaders) {
    requireTelegramWebhook(request, env);
    await ensureOrderSchema(env);

    const callbackQuery = body.callback_query;
    if (!callbackQuery) {
        if (body.message) {
            const wasDeliveryReply = await handleTelegramDeliveryReply(body.message, env).catch((error) => {
                console.warn("Telegram delivery reply failed", error);
                return false;
            });
            const msgChatId = body.message.chat?.id;
            if (!wasDeliveryReply && String(msgChatId || "") === String(env.TELEGRAM_ADMIN_CHAT_ID || "")) {
                await sendTelegramMessage(env, msgChatId, "Use the inline buttons on order notifications to manage orders. Tap 'Add delivery keys' then type the delivery text.").catch((err) =>
                    console.warn("Telegram help message failed", err),
                );
            }
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

            pendingDeliveryOrders.set(String(chatId), { orderId: action.orderId, messageId });
            await answerTelegramCallback(env, callbackQuery.id, "Reply with delivery text.");
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
    if (action.target === "payment" && action.status === "rejected") {
        updateBody.paymentStatusReason = getDefaultStatusReason("payment", "rejected");
    }
    if (action.target === "delivery" && action.status === "cancelled") {
        updateBody.deliveryStatusReason = getDefaultStatusReason("delivery", "cancelled");
    }

    try {
        await updateAdminOrder(env, updateBody);
        const record = await getOrderById(env, action.orderId);
        const order = await getSavedOrderForNotification(env, record);
        const statusLabel = action.target === "payment" ? getPaymentStatusLabel(action.status) : getDeliveryStatusLabel(action.status);

        await answerTelegramCallback(env, callbackQuery.id, `${action.orderId}: ${statusLabel}`);

        if (chatId && messageId) {
            await editTelegramMessage(env, chatId, messageId, formatAdminMessage(order), getAdminOrderKeyboard(order)).catch((error) => {
                console.warn("Telegram message edit failed", error);
                sendTelegramMessage(env, chatId, formatAdminMessage(order), getAdminOrderKeyboard(order)).catch((err) =>
                    console.warn("Telegram fallback message also failed", err),
                );
            });
        }
    } catch (error) {
        await answerTelegramCallback(env, callbackQuery.id, error.message || "Could not update order", true).catch((answerError) =>
            console.warn("Telegram callback answer failed", answerError),
        );
    }

    return jsonResponse({ ok: true }, 200, corsHeaders);
}

async function calculateAndSaveCommissions(env, record) {
    if (!record.referred_by) {
        console.log(`[commission] Order ${record.id}: no referred_by, skipping`);
        return;
    }
    const db = getOrderDb(env);
    const items = await getOrderItems(env, record.id);
    if (!items.length) {
        console.log(`[commission] Order ${record.id}: no items, skipping`);
        return;
    }

    await ensureAffiliateSchema(env);

    const affiliate = await db.prepare("SELECT ref_code, total_earnings FROM affiliates WHERE ref_code = ? AND active = 1").bind(record.referred_by).first();
    if (!affiliate) {
        console.log(`[commission] Order ${record.id}: affiliate "${record.referred_by}" not found or inactive`);
        return;
    }
    console.log(`[commission] Order ${record.id}: found active affiliate "${record.referred_by}" (earnings: ${affiliate.total_earnings})`);

    const [allProducts, allCategories] = await Promise.all([
        readAllProducts(env),
        readAllCategories(env),
    ]);
    const catMap = {};
    for (const cat of allCategories) {
        catMap[cat.name] = cat.commissionPercent;
    }
    console.log(`[commission] catMap:`, JSON.stringify(catMap));

    const commissions = [];
    const now = new Date().toISOString();

    for (const item of items) {
        if (item.seller_id) {
            console.log(`[commission] Order ${record.id}: item "${item.product_id}" belongs to seller "${item.seller_id}", skipping affiliate commission`);
            continue;
        }
        const product = allProducts[item.product_id];
        if (!product) {
            console.log(`[commission] Order ${record.id}: item product_id="${item.product_id}" not found in products`);
            continue;
        }
        const commissionPercent = catMap[product.category] || 0;
        console.log(`[commission] Order ${record.id}: item="${item.product_id}" product.category="${product.category}" commissionPercent=${commissionPercent} line_total=${item.line_total}`);
        if (commissionPercent <= 0) {
            console.log(`[commission] Order ${record.id}: skipping item "${item.product_id}" — commissionPercent is 0`);
            continue;
        }
        const lineTotal = Number(item.line_total);
        const amount = (lineTotal * commissionPercent) / 100;
        if (amount <= 0) {
            console.log(`[commission] Order ${record.id}: skipping item "${item.product_id}" — calculated amount is 0`);
            continue;
        }
        commissions.push({
            order_id: record.id,
            ref_code: record.referred_by,
            product_id: item.product_id,
            commission_amount: amount,
            created_at: now,
        });
        console.log(`[commission] Order ${record.id}: will create commission for "${item.product_id}" amount=${amount}`);
    }

    if (!commissions.length) {
        console.log(`[commission] Order ${record.id}: no commissions to create (all skipped)`);
        return;
    }

    const insertStmt = db.prepare(
        `INSERT INTO referral_commissions (order_id, ref_code, product_id, commission_amount, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`
    );

    const earningsSum = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
    console.log(`[commission] Order ${record.id}: creating ${commissions.length} commission(s), total earnings increase: ${earningsSum}`);
    const updateEarningsStmt = db.prepare(
        "UPDATE affiliates SET total_earnings = total_earnings + ? WHERE ref_code = ?"
    );

    const batchResults = await db.batch([
        ...commissions.map((c) =>
            insertStmt.bind(c.order_id, c.ref_code, c.product_id, c.commission_amount, c.created_at)
        ),
        updateEarningsStmt.bind(earningsSum, record.referred_by),
    ]);

    const errors = batchResults
        .map((r, i) => (r.error ? `Statement ${i}: ${r.error}` : null))
        .filter(Boolean);
    if (errors.length) {
        console.error("[commission] D1 batch errors in calculateAndSaveCommissions:", errors.join("; "));
    } else {
        console.log(`[commission] Order ${record.id}: batch write successful (${commissions.length + 1} statements)`);
    }
}

async function getAffiliateByToken(env, token) {
    if (!token) return null;
    const db = getOrderDb(env);
    const session = await db.prepare("SELECT ref_code FROM affiliate_sessions WHERE token = ?").bind(token).first();
    if (!session) return null;
    return db.prepare("SELECT ref_code, name, phone, total_earnings, active FROM affiliates WHERE ref_code = ?").bind(session.ref_code).first();
}

async function getSellerByToken(env, token) {
    if (!token) return null;
    const db = getOrderDb(env);
    const session = await db.prepare("SELECT seller_id FROM seller_sessions WHERE token = ?").bind(token).first();
    if (!session) return null;
    return db.prepare("SELECT id, store_name, email, phone, commission_percent, balance, active, approved FROM sellers WHERE id = ?").bind(session.seller_id).first();
}

async function handleSellerAction(body, request, env, corsHeaders) {
    const action = body.action;

    if (action === "seller-login") {
        const sellerId = String(body.sellerId || "").trim().toLowerCase();
        const password = String(body.password || "").trim();
        if (!sellerId || !password) {
            return jsonResponse({ error: "Enter seller ID and password" }, 400, corsHeaders);
        }
        const db = getOrderDb(env);
        const seller = await db.prepare("SELECT id, store_name, email, phone, password_hash, commission_percent, balance, active, approved FROM sellers WHERE id = ?").bind(sellerId).first();
        if (!seller) {
            return jsonResponse({ error: "Seller not found" }, 404, corsHeaders);
        }
        if (!seller.active) {
            return jsonResponse({ error: "Seller account is inactive" }, 403, corsHeaders);
        }
        if (!seller.approved) {
            return jsonResponse({ error: "Seller account is not yet approved" }, 403, corsHeaders);
        }
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        if (hashHex !== seller.password_hash) {
            return jsonResponse({ error: "Invalid password" }, 401, corsHeaders);
        }
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        const now = new Date().toISOString();
        await db.prepare("INSERT INTO seller_sessions (token, seller_id, created_at) VALUES (?, ?, ?)").bind(token, seller.id, now).run();
        return jsonResponse({ ok: true, token, seller: { id: seller.id, storeName: seller.store_name, email: seller.email || "", phone: seller.phone, commissionPercent: Number(seller.commission_percent), balance: Number(seller.balance) } }, 200, corsHeaders);
    }

    if (action === "seller-logout") {
        const token = String(body.token || "").trim();
        if (token) {
            await getOrderDb(env).prepare("DELETE FROM seller_sessions WHERE token = ?").bind(token).run();
        }
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (action === "seller-stats") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const db = getOrderDb(env);
        const pdb = getCatalogDb(env);

        const [sellerOrders, payouts, products] = await Promise.all([
            getAllResults(db.prepare("SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.line_total, oi.seller_status, o.created_at FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = ? ORDER BY o.created_at DESC LIMIT 100").bind(seller.id)),
            getAllResults(db.prepare("SELECT id, amount, method, recipient_detail, status, created_at, updated_at FROM seller_payouts WHERE seller_id = ? ORDER BY created_at DESC LIMIT 50").bind(seller.id)),
            getAllResults(pdb.prepare("SELECT id, data, category, approved, created_at FROM products WHERE seller_id = ? ORDER BY created_at DESC").bind(seller.id)),
        ]);

        const totalSales = sellerOrders.reduce((sum, o) => sum + Number(o.line_total), 0);
        const totalOrders = new Set(sellerOrders.map((o) => o.order_id)).size;
        const deliveredItems = sellerOrders.filter((o) => o.seller_status === "delivered").length;
        const pendingItems = sellerOrders.filter((o) => o.seller_status === "pending").length;
        const totalPayouts = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
        const pendingProducts = products.filter((p) => !p.approved).length;

        return jsonResponse({
            ok: true,
            seller: {
                id: seller.id,
                storeName: seller.store_name,
                email: seller.email || "",
                phone: seller.phone,
                commissionPercent: Number(seller.commission_percent),
                balance: Number(seller.balance),
            },
            stats: {
                totalOrders,
                totalSales,
                deliveredItems,
                pendingItems,
                totalPayouts,
                pendingProducts,
            },
            orders: sellerOrders.map((o) => ({
                id: o.id,
                orderId: o.order_id,
                productId: o.product_id,
                productName: o.product_name,
                quantity: o.quantity,
                unitPrice: Number(o.unit_price),
                lineTotal: Number(o.line_total),
                status: o.seller_status,
                createdAt: o.created_at,
            })),
            payouts: payouts.map((p) => ({
                id: p.id,
                amount: Number(p.amount),
                method: p.method,
                recipientDetail: p.recipient_detail,
                status: p.status,
                createdAt: p.created_at,
                updatedAt: p.updated_at || "",
            })),
            products: products.map((p) => ({
                id: p.id,
                data: (() => { try { return JSON.parse(p.data); } catch { return {}; } })(),
                category: p.category || "",
                approved: !!p.approved,
                createdAt: p.created_at,
            })),
        }, 200, corsHeaders);
    }

    if (action === "seller-list-products") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const pdb = getCatalogDb(env);
        const rows = await getAllResults(pdb.prepare("SELECT id, data, category, approved, created_at, updated_at FROM products WHERE seller_id = ? ORDER BY created_at DESC").bind(seller.id));
        const products = rows.map((r) => ({
            id: r.id,
            data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
            category: r.category || "",
            approved: !!r.approved,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
        return jsonResponse({ ok: true, products }, 200, corsHeaders);
    }

    if (action === "seller-create-product") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        await ensureCatalogSchema(env);
        const name = String(body.name || "").trim();
        const price = Number(body.price);
        const category = String(body.category || "").trim();
        const description = String(body.description || "").trim();
        const photo = String(body.photo || "assets/hyperlogo.png").trim();
        const icon = String(body.icon || "bi-box").trim();

        if (!name || !Number.isFinite(price) || price <= 0) {
            return jsonResponse({ error: "Product name and a valid price are required" }, 400, corsHeaders);
        }

        const pdb = getCatalogDb(env);
        const productId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + Date.now().toString(36);

        const productData = { name, price, description, photo, icon, variations: [] };
        const now = new Date().toISOString();

        await pdb.prepare(
            "INSERT INTO products (id, data, category, seller_id, approved, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
        ).bind(productId, JSON.stringify(productData), category, seller.id, now, now).run();

        return jsonResponse({ ok: true, product: { id: productId, data: productData, category, approved: false, createdAt: now } }, 200, corsHeaders);
    }

    if (action === "seller-update-product") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const productId = String(body.productId || "").trim();
        if (!productId) return jsonResponse({ error: "Product ID is required" }, 400, corsHeaders);

        const pdb = getCatalogDb(env);
        const existing = await pdb.prepare("SELECT id, data, seller_id FROM products WHERE id = ?").bind(productId).first();
        if (!existing) return jsonResponse({ error: "Product not found" }, 404, corsHeaders);
        if (existing.seller_id !== seller.id) return jsonResponse({ error: "Not your product" }, 403, corsHeaders);

        let currentData = {};
        try { currentData = JSON.parse(existing.data); } catch { /* ignore */ }

        if (body.name !== undefined) currentData.name = String(body.name).trim();
        if (body.price !== undefined) currentData.price = Number(body.price);
        if (body.description !== undefined) currentData.description = String(body.description).trim();
        if (body.photo !== undefined) currentData.photo = String(body.photo).trim();
        if (body.icon !== undefined) currentData.icon = String(body.icon).trim();
        if (body.variations !== undefined) currentData.variations = body.variations;

        const category = body.category !== undefined ? String(body.category).trim() : (existing.category || "");
        const now = new Date().toISOString();

        await pdb.prepare(
            "UPDATE products SET data = ?, category = ?, updated_at = ? WHERE id = ?"
        ).bind(JSON.stringify(currentData), category, now, productId).run();

        return jsonResponse({ ok: true, product: { id: productId, data: currentData, category, approved: !!existing.approved, updatedAt: now } }, 200, corsHeaders);
    }

    if (action === "seller-delete-product") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const productId = String(body.productId || "").trim();
        if (!productId) return jsonResponse({ error: "Product ID is required" }, 400, corsHeaders);

        const pdb = getCatalogDb(env);
        const existing = await pdb.prepare("SELECT id, seller_id FROM products WHERE id = ?").bind(productId).first();
        if (!existing) return jsonResponse({ error: "Product not found" }, 404, corsHeaders);
        if (existing.seller_id !== seller.id) return jsonResponse({ error: "Not your product" }, 403, corsHeaders);

        await pdb.prepare("DELETE FROM products WHERE id = ? AND seller_id = ?").bind(productId, seller.id).run();
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (action === "seller-list-orders") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const db = getOrderDb(env);
        const rows = await getAllResults(db.prepare(
            "SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.option_label, oi.quantity, oi.unit_price, oi.line_total, oi.seller_status, o.customer_phone, o.created_at FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = ? AND o.payment_status = 'paid' ORDER BY o.created_at DESC LIMIT 100"
        ).bind(seller.id));

        return jsonResponse({
            ok: true,
            orders: rows.map((r) => ({
                id: r.id,
                orderId: r.order_id,
                productId: r.product_id,
                productName: r.product_name,
                optionLabel: r.option_label || "",
                quantity: r.quantity,
                unitPrice: Number(r.unit_price),
                lineTotal: Number(r.line_total),
                status: r.seller_status,
                customerPhone: r.customer_phone,
                createdAt: r.created_at,
            })),
        }, 200, corsHeaders);
    }

    if (action === "seller-deliver-item") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const itemId = Number(body.itemId);
        if (!itemId) return jsonResponse({ error: "Item ID is required" }, 400, corsHeaders);

        const db = getOrderDb(env);
        const item = await db.prepare("SELECT id, seller_id, seller_status FROM order_items WHERE id = ?").bind(itemId).first();
        if (!item) return jsonResponse({ error: "Item not found" }, 404, corsHeaders);
        if (item.seller_id !== seller.id) return jsonResponse({ error: "Not your item" }, 403, corsHeaders);
        if (item.seller_status === "delivered") return jsonResponse({ error: "Already delivered" }, 400, corsHeaders);

        const now = new Date().toISOString();
        await db.prepare("UPDATE order_items SET seller_status = 'delivered' WHERE id = ? AND seller_id = ?").bind(itemId, seller.id).run();

        const commissionPercent = Number(seller.commission_percent) || 0;
        const itemTotal = Number(item.line_total || 0);
        const sellerEarning = Number((itemTotal * (100 - commissionPercent) / 100).toFixed(3));
        if (sellerEarning > 0) {
            await db.prepare("UPDATE sellers SET balance = balance + ? WHERE id = ?").bind(sellerEarning, seller.id).run();
        }

        return jsonResponse({ ok: true, earning: sellerEarning }, 200, corsHeaders);
    }

    if (action === "seller-request-payout") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const seller = await getSellerByToken(env, token);
        if (!seller) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);

        const amount = Number(body.amount);
        const method = String(body.method || "").trim() || "d17";
        const recipientDetail = String(body.recipientDetail || seller.phone || "").trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            return jsonResponse({ error: "Enter a valid amount" }, 400, corsHeaders);
        }

        const available = Number(seller.balance);
        if (amount > available) {
            return jsonResponse({ error: `Insufficient balance. Available: ${available.toFixed(3)} TND` }, 400, corsHeaders);
        }

        const db = getOrderDb(env);
        const now = new Date().toISOString();
        await db.prepare(
            "INSERT INTO seller_payouts (seller_id, amount, method, recipient_detail, status, created_at) VALUES (?, ?, ?, ?, 'requested', ?)"
        ).bind(seller.id, amount, method, recipientDetail, now).run();

        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    return jsonResponse({ error: "Unknown seller action" }, 400, corsHeaders);
}

async function handleAffiliateAction(body, request, env, corsHeaders) {
    await ensureOrderSchema(env);

    const action = body.action;

    if (action === "affiliate-login") {
        const refCode = String(body.refCode || "").trim().toLowerCase();
        const password = String(body.password || "").trim();
        if (!refCode || !password) {
            return jsonResponse({ error: "Enter affiliate code and password" }, 400, corsHeaders);
        }
        const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
        if (!checkLoginRateLimit("aff-login-" + clientIp)) {
            return jsonResponse({ error: "Too many login attempts. Try again later." }, 429, corsHeaders);
        }
        const db = getOrderDb(env);
        const affiliate = await db.prepare("SELECT ref_code, name, phone, password_hash, total_earnings, active FROM affiliates WHERE ref_code = ?").bind(refCode).first();
        if (!affiliate) {
            return jsonResponse({ error: "Affiliate not found" }, 404, corsHeaders);
        }
        if (!affiliate.active) {
            return jsonResponse({ error: "Affiliate account is inactive" }, 403, corsHeaders);
        }
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", passwordBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        if (hashHex !== affiliate.password_hash) {
            return jsonResponse({ error: "Invalid password" }, 401, corsHeaders);
        }
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        const now = new Date().toISOString();
        await db.prepare("INSERT INTO affiliate_sessions (token, ref_code, created_at) VALUES (?, ?, ?)").bind(token, affiliate.ref_code, now).run();
        return jsonResponse({ ok: true, token, affiliate: { refCode: affiliate.ref_code, name: affiliate.name, phone: affiliate.phone, totalEarnings: affiliate.total_earnings } }, 200, corsHeaders);
    }

    if (action === "affiliate-logout") {
        const token = String(body.token || "").trim();
        if (token) {
            await getOrderDb(env).prepare("DELETE FROM affiliate_sessions WHERE token = ?").bind(token).run();
        }
        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    if (action === "affiliate-stats") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const affiliate = await getAffiliateByToken(env, token);
        if (!affiliate) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);
        if (!affiliate.active) return jsonResponse({ error: "Affiliate account is inactive" }, 403, corsHeaders);
        const db = getOrderDb(env);

        const [commissions, payouts] = await Promise.all([
            getAllResults(db.prepare("SELECT id, order_id, product_id, commission_amount, status, created_at, paid_at FROM referral_commissions WHERE ref_code = ? ORDER BY created_at DESC LIMIT 50").bind(affiliate.ref_code)),
            getAllResults(db.prepare("SELECT id, amount, method, recipient_detail, status, created_at, updated_at FROM affiliate_payouts WHERE ref_code = ? ORDER BY created_at DESC LIMIT 20").bind(affiliate.ref_code)),
        ]);

        const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
        const pendingCommissions = commissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + Number(c.commission_amount), 0);
        const totalOrders = new Set(commissions.map((c) => c.order_id)).size;

        const paymentSettings = await readPaymentSettings(env);
        const minimumWithdrawal = paymentSettings.affiliate?.minimumWithdrawal ?? 10;

        return jsonResponse({
            ok: true,
            affiliate: {
                refCode: affiliate.ref_code,
                name: affiliate.name,
                phone: affiliate.phone,
                totalEarnings: affiliate.total_earnings,
            },
            stats: {
                totalOrders,
                totalCommissions,
                pendingCommissions,
                paidCommissions: totalCommissions - pendingCommissions,
            },
            minimumWithdrawal,
            commissions: commissions.map((c) => ({
                id: c.id,
                orderId: c.order_id,
                productId: c.product_id || "",
                amount: Number(c.commission_amount),
                status: c.status,
                createdAt: c.created_at,
                paidAt: c.paid_at || "",
            })),
            payouts: payouts.map((p) => ({
                id: p.id,
                amount: Number(p.amount),
                method: p.method,
                recipientDetail: p.recipient_detail,
                status: p.status,
                createdAt: p.created_at,
                updatedAt: p.updated_at || "",
            })),
        }, 200, corsHeaders);
    }

    if (action === "affiliate-request-payout") {
        const token = String(body.token || "").trim();
        if (!token) return jsonResponse({ error: "Authentication required" }, 401, corsHeaders);
        const affiliate = await getAffiliateByToken(env, token);
        if (!affiliate) return jsonResponse({ error: "Invalid session" }, 401, corsHeaders);
        if (!affiliate.active) return jsonResponse({ error: "Affiliate account is inactive" }, 403, corsHeaders);
        const db = getOrderDb(env);

        const amount = Number(body.amount);
        const method = String(body.method || "").trim() || "d17";
        const recipientDetail = String(body.recipientDetail || affiliate.phone || "").trim();

        if (!Number.isFinite(amount) || amount <= 0) {
            return jsonResponse({ error: "Enter a valid amount" }, 400, corsHeaders);
        }

        const paymentSettings = await readPaymentSettings(env);
        const minimumWithdrawal = paymentSettings.affiliate?.minimumWithdrawal ?? 10;
        if (amount < minimumWithdrawal) {
            return jsonResponse({ error: `Minimum withdrawal is TND ${Number(minimumWithdrawal).toFixed(3)}` }, 400, corsHeaders);
        }

        const pendingCommissions = await getAllResults(
            db.prepare("SELECT SUM(commission_amount) as total FROM referral_commissions WHERE ref_code = ? AND status = 'pending'").bind(affiliate.ref_code)
        );
        const available = Number(pendingCommissions[0]?.total || 0);
        if (amount > available) {
            return jsonResponse({ error: `Insufficient pending commissions. Available: ${available.toFixed(3)} TND` }, 400, corsHeaders);
        }

        const now = new Date().toISOString();
        await db.prepare(
            "INSERT INTO affiliate_payouts (ref_code, amount, method, recipient_detail, status, created_at) VALUES (?, ?, ?, ?, 'requested', ?)"
        ).bind(affiliate.ref_code, amount, method, recipientDetail, now).run();

        return jsonResponse({ ok: true }, 200, corsHeaders);
    }

    return jsonResponse({ error: "Unknown affiliate action" }, 400, corsHeaders);
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

    if (String(body.action || "").startsWith("affiliate-")) {
        return handleAffiliateAction(body, request, env, corsHeaders);
    }

    if (String(body.action || "").startsWith("seller-")) {
        return handleSellerAction(body, request, env, corsHeaders);
    }

    if (body.action === "order-status") {
        return handleOrderStatus(body, env, corsHeaders);
    }

    if (body.action === "customer-input") {
        return handleCustomerInput(body, env, corsHeaders);
    }

    const checkoutRequestId = String(body.checkoutRequestId || "").trim();
    if (!checkoutRequestId) return jsonResponse({ error: "Missing checkout request ID" }, 400, corsHeaders);

    await ensureOrderSchema(env);

    if (processedOrders.has(checkoutRequestId)) {
        const existing = processedOrders.get(checkoutRequestId);
        if (existing.pending) return jsonResponse({ error: "Order is already being processed" }, 409, corsHeaders);
        return jsonResponse(existing.response, 200, corsHeaders);
    }

    const existingSavedOrder = await getOrderByCheckoutRequestId(env, checkoutRequestId);
    if (existingSavedOrder) {
        if (!existingSavedOrder.telegram_notified_at && env.TELEGRAM_ADMIN_CHAT_ID) {
            try {
                const savedOrderForNotification = await getSavedOrderForNotification(env, existingSavedOrder);
                await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatAdminMessage(savedOrderForNotification), getAdminOrderKeyboard(savedOrderForNotification));
                await markTelegramNotified(env, existingSavedOrder.id);
            } catch (err) {
                console.warn("Telegram notification for existing order failed", err);
            }
        }
        return jsonResponse(getResponsePayloadFromRecord(existingSavedOrder), 200, corsHeaders);
    }

    await ensureCatalogSchema(env);
    const [allProducts, config, paymentSettings] = await Promise.all([
        readAllProducts(env),
        readStoreConfig(env),
        readPaymentSettings(env),
    ]);
    const database = {
        products: allProducts,
        currency: config.currency || "TND",
        routes: config.routes || {},
    };
    const settings = paymentSettings ? mergePaymentSettings(paymentSettings) : clone(DEFAULT_PAYMENT_SETTINGS);
    const order = buildOrder(body, database, settings);

    processedOrders.set(checkoutRequestId, { createdAt: Date.now(), pending: true });
    const savedOrder = await saveOrderToDatabase(env, checkoutRequestId, order);
    if (savedOrder.duplicate) {
        if (savedOrder.record && env.TELEGRAM_ADMIN_CHAT_ID) {
            try {
                const savedOrderForNotification = await getSavedOrderForNotification(env, savedOrder.record);
                await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatAdminMessage(savedOrderForNotification), getAdminOrderKeyboard(savedOrderForNotification));
                await markTelegramNotified(env, savedOrder.record.id);
            } catch (err) {
                console.warn("Telegram notification for duplicate order failed", err);
            }
        }
        processedOrders.set(checkoutRequestId, {
            createdAt: Date.now(),
            pending: false,
            response: savedOrder.response,
        });
        return jsonResponse(savedOrder.response, 200, corsHeaders);
    }

    if (env.TELEGRAM_ADMIN_CHAT_ID) {
        try {
            await sendTelegramMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, formatAdminMessage(order), getAdminOrderKeyboard(order));
            await markTelegramNotified(env, order.id);
        } catch (err) {
            console.warn("Telegram admin notification failed", err);
        }
    }

    processedOrders.set(checkoutRequestId, {
        createdAt: Date.now(),
        pending: false,
        response: savedOrder.response,
    });

    return jsonResponse(savedOrder.response, 200, corsHeaders);
}

function parseUrlPath(request) {
    try {
        return new URL(request.url).pathname;
    } catch {
        return "/";
    }
}

export default {
    async fetch(request, env) {
        const corsHeaders = getCorsHeaders(request);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const urlPath = parseUrlPath(request);

        if (request.method === "GET") {
            try {
                if (urlPath === "/api/data") {
                    const data = await getCatalogData(env);
                    return jsonResponse(data, 200, corsHeaders);
                }

                if (urlPath === "/api/settings") {
                    const settings = await readPaymentSettings(env);
                    return jsonResponse(settings || {}, 200, corsHeaders);
                }

                return jsonResponse({ error: "Not found" }, 404, corsHeaders);
            } catch (error) {
                console.error(error);
                return jsonResponse({ error: error.message || "API error" }, error.statusCode || 500, corsHeaders);
            }
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
