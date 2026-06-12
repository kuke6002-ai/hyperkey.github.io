    const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
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

    async function readDatabase(env) {
        if (!env.PRODUCT_DATABASE_URL) {
            const error = new Error("PRODUCT_DATABASE_URL is not configured");
            error.statusCode = 500;
            throw error;
        }

        const separator = env.PRODUCT_DATABASE_URL.includes("?") ? "&" : "?";
        const databaseUrl = `${env.PRODUCT_DATABASE_URL}${separator}v=${Date.now()}`;
        const response = await fetch(databaseUrl, {
            headers: { Accept: "application/json" },
            cf: { cacheTtl: 0, cacheEverything: false },
        });
        if (!response.ok) {
            throw new Error(`Could not load product database: ${response.status}`);
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Product database did not return JSON");
        }
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

    function normalizePhone(value) {
        if (typeof value !== "string") return "";
        return value.trim().replace(/\s+/g, " ").slice(0, 40);
    }

    function validatePhone(value) {
        const phone = normalizePhone(value);
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 6 || digits.length > 15 || !/^[+\d][+\d\s().-]*$/.test(phone)) {
            throw new Error("A valid phone number is required");
        }
        return phone;
    }

    function normalizeTelegramUsername(value) {
        if (typeof value !== "string") return "";
        return value.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32);
    }

    function money(amount, currency) {
        return new Intl.NumberFormat("en-TN", {
            style: "currency",
            currency,
        }).format(Number(amount) || 0);
    }

    function buildOrder(body, database) {
        const products = database.products || {};
        const currency = database.currency || "TND";
        const lines = [];
        const items = body.items;

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

        const createdAt = new Date();
        return {
            id: `GV-${createdAt.getTime()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            createdAt: createdAt.toISOString(),
            currency,
            customerPhone: validatePhone(body.customerPhone),
            telegramUsername: normalizeTelegramUsername(body.telegramUsername),
            paymentMethod: normalizePaymentMethod(body.paymentMethod),
            paymentStatus: "Not verified - no online payment provider configured",
            lines,
            total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
        };
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatAdminMessage(order) {
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
            "<b>Customer contact</b>",
            `<b>Phone:</b> ${escapeHtml(order.customerPhone)}`,
            `<b>Telegram username:</b> ${escapeHtml(order.telegramUsername ? `@${order.telegramUsername}` : "Not provided")}`,
            "",
            "<b>Products</b>",
            products,
            "",
            `<b>Total:</b> ${escapeHtml(money(order.total, order.currency))}`,
            `<b>Payment status:</b> ${escapeHtml(order.paymentStatus)}`,
            `<b>Payment method:</b> ${escapeHtml(order.paymentMethod || "Not selected")}`,
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

        const database = await readDatabase(env);
        const order = buildOrder(body, database);
        const responsePayload = {
            ok: true,
            orderId: order.id,
            total: order.total,
            currency: order.currency,
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
