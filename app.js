// Add, edit, hide, or remove products here. Products appear on the homepage,
// Products page, detail page, cart, and checkout by default.
// Set visible: false only when you want to hide a product from listings.
// Add variations with: variations: [{ id: "small", label: "Small", price: 10 }]
// The selected variation price will update on product.html and in the cart.
const PRODUCTS = {};

const CART_KEY = "hyperkey-cart";
const CHECKOUT_SESSION_KEY = "hyperkey-checkout-session";
const ORDER_STATUS_LOOKUP_KEY = "hyperkey-last-order-status-lookup";
const THEME_KEY = "hyperkey-theme-v2";
const LANGUAGE_KEY = "hyperkey-language";
let CURRENCY = "TND";
const ORDER_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const CATALOG_API_URL = ORDER_API_URL ? `${ORDER_API_URL.replace(/\/+$/, "")}/api` : "";
const SUPPORT_WHATSAPP_NUMBER = "21655159280";
const CART_VARIATION_SEPARATOR = "::";
const REFERRAL_KEY = "hyperkey-ref";
const SUPPORTED_LANGUAGES = ["en", "fr", "ar"];
const HOME_CATEGORY_PREVIEW_LIMIT = 4;
const HOME_FEATURED_PRODUCT_LIMIT = 4;
const LANGUAGE_LABELS = {
    en: "EN",
    fr: "FR",
    ar: "AR",
};
const LANGUAGE_NAMES = {
    en: "English",
    fr: "French",
    ar: "Arabic",
};
const LANGUAGE_FILES = {
    fr: "lang/fr.json",
    ar: "lang/ar.json",
};
let savedLanguage = localStorage.getItem(LANGUAGE_KEY);
let CURRENT_LANGUAGE = SUPPORTED_LANGUAGES.includes(savedLanguage) ? savedLanguage : "fr";
let TRANSLATIONS = {};
let REVERSE_TRANSLATIONS = {};
let checkoutSubmitting = false;
let paymentSubmitting = false;
let customerInputSubmitting = false;
const ART_CLASSES = [...new Set(Object.values(PRODUCTS).map((product) => product.art).filter(Boolean))];
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
    faq: [
        {
            question: "How do I receive my order?",
            answer: "After payment is reviewed, delivery appears on the Check Order page and we can also contact you on WhatsApp when needed.",
        },
        {
            question: "How long does delivery take?",
            answer: "Most orders are handled manually as soon as payment is verified. Some products can take longer depending on supplier availability.",
        },
        {
            question: "What payment methods are supported?",
            answer: "HyperKey Store supports D17 transfer, Flouci transfer, and Tunisie Telecom recharge cards when enabled.",
        },
        {
            question: "What if my payment is rejected?",
            answer: "Check the reason on the order status page, then contact support with your Order ID and payment proof.",
        },
        {
            question: "Do I need an account?",
            answer: "No account is required. Keep your Order ID and use the same WhatsApp number to check your order.",
        },
    ],
    payment: {
        d17: {
            enabled: true,
            label: "D17 transfer",
            instructions: "Send the shown amount by D17, then enter only the authorization number from your receipt.",
            recipientName: "",
            recipientValue: "97671058",
            recipientHint: "",
            proofLabel: "Authorization number",
            feePercent: 1,
            roundUpToDecimal: 1,
        },
        flouci: {
            enabled: true,
            label: "Flouci transfer",
            instructions: "Send the shown amount by Flouci, then enter only the transaction ID from your receipt.",
            recipientName: "",
            recipientValue: "97671058",
            recipientHint: "",
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
// Add a category here if you introduce a new product category in PRODUCTS.
const CATEGORIES = [];
const PRODUCT_ROUTES = {};

function refreshArtClasses() {
    ART_CLASSES.splice(
        0,
        ART_CLASSES.length,
        ...new Set(Object.values(PRODUCTS).map((product) => product.art).filter(Boolean)),
    );
}

function normalizeI18nKey(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function loadTranslationData() {
    await Promise.all(
        Object.entries(LANGUAGE_FILES).map(async ([language, url]) => {
            try {
                const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
                if (!response.ok) throw new Error(`Could not load ${url}`);
                TRANSLATIONS[language] = await response.json();
            } catch (error) {
                console.warn("Using English text fallback:", error);
                TRANSLATIONS[language] = {};
            }
        }),
    );

    REVERSE_TRANSLATIONS = {};
    Object.values(TRANSLATIONS).forEach((dictionary) => {
        Object.entries(dictionary || {}).forEach(([english, translated]) => {
            REVERSE_TRANSLATIONS[normalizeI18nKey(translated)] = english;
        });
    });
}

function getBaseText(value) {
    const key = normalizeI18nKey(value);
    return REVERSE_TRANSLATIONS[key] || key;
}

function t(value) {
    const base = getBaseText(value);
    if (!base) return "";
    if (CURRENT_LANGUAGE === "en") return base;
    return TRANSLATIONS[CURRENT_LANGUAGE]?.[base] || base;
}

function formatProductCount(count) {
    const value = Number(count) || 0;
    if (CURRENT_LANGUAGE === "ar") return `${value} ${value === 1 ? "\u0645\u0646\u062A\u062C" : "\u0645\u0646\u062A\u062C\u0627\u062A"}`;
    if (CURRENT_LANGUAGE === "fr") return `${value} produit${value === 1 ? "" : "s"}`;
    return `${value} product${value === 1 ? "" : "s"}`;
}

function localizeProductCountElements(root = document) {
    root.querySelectorAll("[data-product-count-value]").forEach((element) => {
        element.textContent = formatProductCount(element.dataset.productCountValue);
    });
}

function translateTextNode(node) {
    const value = node.nodeValue || "";
    const key = normalizeI18nKey(value);
    if (!key) return;

    const translated = t(key);
    if (!translated || translated === key) return;

    const leading = value.match(/^\s*/)?.[0] || "";
    const trailing = value.match(/\s*$/)?.[0] || "";
    node.nodeValue = `${leading}${translated}${trailing}`;
}

function translateElementAttributes(element) {
    ["placeholder", "aria-label", "title", "alt"].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const value = element.getAttribute(attribute);
        const translated = t(value);
        if (translated && translated !== normalizeI18nKey(value)) element.setAttribute(attribute, translated);
    });
}

function translateElement(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
            const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (!element) return NodeFilter.FILTER_REJECT;
            if (element.closest("script, style, textarea, code, [data-no-i18n], [data-policy-lang]")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    let node = walker.currentNode;
    while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateElementAttributes(node);
        }
        node = walker.nextNode();
    }
}

function updateLocalizedPolicyBlocks() {
    document.querySelectorAll("[data-policy-lang]").forEach((block) => {
        const isActive = block.dataset.policyLang === CURRENT_LANGUAGE;
        block.classList.toggle("d-none", !isActive);
        block.hidden = !isActive;
        block.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
}

function translatePage() {
    document.documentElement.lang = CURRENT_LANGUAGE;
    document.documentElement.dir = CURRENT_LANGUAGE === "ar" ? "rtl" : "ltr";
    updateLocalizedPolicyBlocks();
    translateElement(document.body);
    localizeProductCountElements(document.body);
    document.title = t(document.title);
    updateLanguageToggle();
}

function updateLanguageToggle() {
    document.querySelectorAll("[data-language-toggle]").forEach((button) => {
        const languageName = t(LANGUAGE_NAMES[CURRENT_LANGUAGE] || "English");
        button.innerHTML = `<i class="bi bi-translate"></i><span>${LANGUAGE_LABELS[CURRENT_LANGUAGE] || "EN"}</span>`;
        button.setAttribute("aria-label", `${t("Language")}: ${languageName}`);
        button.setAttribute("title", `${t("Language")}: ${languageName}`);
    });
}

function cycleLanguage() {
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(CURRENT_LANGUAGE);
    CURRENT_LANGUAGE = SUPPORTED_LANGUAGES[(currentIndex + 1) % SUPPORTED_LANGUAGES.length];
    localStorage.setItem(LANGUAGE_KEY, CURRENT_LANGUAGE);
    rerenderDynamicSections();
    translatePage();
}

function createLanguageToggle(className) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.dataset.languageToggle = "true";
    button.addEventListener("click", cycleLanguage);
    return button;
}

function setupLanguageToggle() {
    document.querySelectorAll(".navbar > .container").forEach((container) => {
        const toggler = container.querySelector(".navbar-toggler");
        if (!toggler || container.querySelector("[data-language-toggle-mobile]")) return;

        const button = createLanguageToggle("btn btn-outline-dark language-toggle language-toggle-mobile d-inline-flex d-lg-none ms-auto me-2");
        button.dataset.languageToggleMobile = "true";
        toggler.before(button);
    });

    const cartLinks = document.querySelectorAll('a[href="cart.html"][aria-label="Cart"]');
    cartLinks.forEach((cartLink) => {
        if (cartLink.parentElement?.querySelector("[data-language-toggle-desktop]")) return;

        const button = createLanguageToggle("btn btn-outline-dark language-toggle language-toggle-desktop d-none d-lg-inline-flex");
        button.dataset.languageToggleDesktop = "true";
        cartLink.before(button);
    });
    updateLanguageToggle();
}

async function loadProductDatabase() {
    const apiUrl = CATALOG_API_URL ? `${CATALOG_API_URL}/data` : "";
    let loaded = false;

    if (apiUrl) {
        try {
            const response = await fetch(`${apiUrl}?v=${Date.now()}`, { cache: "no-store" });
            if (response.ok) {
                const database = await response.json();
                if (database.products && typeof database.products === "object") {
                    Object.keys(PRODUCTS).forEach((id) => delete PRODUCTS[id]);
                    Object.assign(PRODUCTS, database.products);
                }
                if (database.currency) CURRENCY = database.currency;
                if (Array.isArray(database.categories)) {
                    CATEGORIES.splice(0, CATEGORIES.length, ...database.categories);
                }
                if (database.routes && typeof database.routes === "object") {
                    Object.keys(PRODUCT_ROUTES).forEach((id) => delete PRODUCT_ROUTES[id]);
                    Object.assign(PRODUCT_ROUTES, database.routes);
                }
                refreshArtClasses();
                loaded = true;
            }
        } catch (error) {
            console.warn("Could not load products from API, using built-in fallback:", error);
        }
    }
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-TN", {
        style: "currency",
        currency: CURRENCY,
    }).format(Number(amount) || 0);
}

function formatPlainTndAmount(amount) {
    const value = Number(amount) || 0;
    const formatted = value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
        useGrouping: false,
    });
    return `${formatted} TND`;
}

function normalizeTunisianPhoneInput(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("00216") && digits.length === 13) return digits.slice(5);
    if (digits.startsWith("216") && digits.length === 11) return digits.slice(3);
    if (digits.length === 8) return digits;
    return "";
}

function formatTunisianPhone(value) {
    const phone = normalizeTunisianPhoneInput(value);
    if (!phone) return String(value || "").trim();
    return `${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5)}`;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function captureReferralFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.trim()) {
        sessionStorage.setItem(REFERRAL_KEY, ref.trim().toLowerCase());
    }
}

function getReferralCode() {
    return sessionStorage.getItem(REFERRAL_KEY) || "";
}

function showReferralBadge() {
    const badge = document.getElementById("referralBadge");
    const display = document.getElementById("referralCodeDisplay");
    const code = getReferralCode();
    if (badge && display && code) {
        display.textContent = code;
        badge.classList.remove("d-none");
    }
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

async function loadPaymentSettings() {
    const apiUrl = CATALOG_API_URL ? `${CATALOG_API_URL}/settings` : "";
    if (apiUrl) {
        try {
            const response = await fetch(`${apiUrl}?v=${Date.now()}`, { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                if (data && typeof data === "object" && Object.keys(data).length) {
                    return mergePaymentSettings(data);
                }
            }
        } catch (error) {
            console.warn("Could not load settings from API, using defaults:", error);
        }
    }

    return clone(DEFAULT_PAYMENT_SETTINGS);
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
        throw new Error(t("This payment method is not available."));
    }

    if (method === "d17") {
        const amountDue = roundUpToDecimal(productTotal * (1 + Number(config.feePercent || 0) / 100), config.roundUpToDecimal ?? 1);
        return {
            method,
            label: config.label || "D17 transfer",
            instructions: config.instructions || DEFAULT_PAYMENT_SETTINGS.payment.d17.instructions,
            recipientName: config.recipientName || "",
            recipientValue: config.recipientValue || "",
            recipientHint: config.recipientHint || "",
            proofType: "reference",
            proofLabel: config.proofLabel || "Authorization number",
            amountDue,
        };
    }

    if (method === "flouci") {
        const fee = productTotal < 100 ? Number(config.feeUnder100 || 0) : Number(config.feeFrom100 || 0);
        return {
            method,
            label: config.label || "Flouci transfer",
            instructions: config.instructions || DEFAULT_PAYMENT_SETTINGS.payment.flouci.instructions,
            recipientName: config.recipientName || "",
            recipientValue: config.recipientValue || "",
            recipientHint: config.recipientHint || "",
            proofType: "reference",
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
            instructions: config.instructions || DEFAULT_PAYMENT_SETTINGS.payment["tt-card"].instructions,
            proofType: "tt-cards",
            amountDue,
            cardValue,
            cardCount: Math.max(1, Math.round(amountDue / cardValue)),
            codeLength: Number(config.codeLength || 15),
        };
    }

    throw new Error(t("Choose a supported payment method."));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getCatalogProducts() {
    return Object.entries(PRODUCTS).filter(([, product]) => product.visible !== false);
}

function getProductCategory(product) {
    return product.category || "Digital";
}

function slugify(value) {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function getCategories() {
    const existing = new Map(CATEGORIES.map((category) => [category.name, category]));

    getCatalogProducts().forEach(([, product]) => {
        const name = getProductCategory(product);
        if (existing.has(name)) return;

        existing.set(name, {
            name,
            id: slugify(name) || "digital",
            label: name,
            icon: product.icon || "bi-box",
            teaser: t("Digital products"),
            heading: name,
            description: t("Browse digital products."),
        });
    });

    return [...existing.values()];
}

function getCategoryPage(category) {
    const id = category.id || slugify(category.name) || "digital";
    return `category.html?category=${encodeURIComponent(id)}`;
}

function getProductDescription(product) {
    return product.description || getProductIntro(product);
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

function isVariationInStock(variation) {
    return !variation || (variation.visible !== false && variation.inStock !== false);
}

function getDefaultVariation(product) {
    const variations = getProductVariations(product);
    if (!variations.length) return null;
    const defaultVariation = getVariation(product, product.defaultVariation);
    if (isVariationInStock(defaultVariation)) return defaultVariation;
    return variations.find((variation) => isVariationInStock(variation)) || variations[0];
}

function getProductPrice(product) {
    return getDefaultVariation(product)?.price ?? product.price ?? 0;
}

function getProductDisplayName(product) {
    return product.name;
}

function getProductImage(product) {
    return typeof product.image === "string" ? product.image.trim() : "";
}

function isProductInStock(product) {
    return product?.inStock !== false;
}

function getVariationName(product, variation) {
    const productName = String(product?.name || "").trim();
    const variationName = String(variation?.label || variation?.name || "").trim();
    if (!variationName) return productName;
    if (!productName) return variationName;
    if (variationName.toLowerCase().includes(productName.toLowerCase())) return variationName;
    return `${productName} - ${variationName}`;
}

function makeCartKey(productId, variationId = "") {
    return variationId ? `${productId}${CART_VARIATION_SEPARATOR}${variationId}` : productId;
}

function parseCartKey(cartKey) {
    const [productId, variationId = ""] = String(cartKey).split(CART_VARIATION_SEPARATOR);
    return { productId, variationId };
}

function getCartLine(cartKey) {
    const { productId, variationId } = parseCartKey(cartKey);
    const product = PRODUCTS[productId];
    if (!product) return null;

    const variation = getVariation(product, variationId);
    return {
        productId,
        variationId,
        product,
        variation,
        name: getVariationName(product, variation),
        category: getProductCategory(product),
        price: variation?.price ?? product.price ?? 0,
        icon: product.icon || "bi-box",
        art: product.art || "gamekey-art",
        image: getProductImage(product),
        inStock: isProductInStock(product) && isVariationInStock(variation),
    };
}

function productCardTemplate(id, product) {
    const art = product.art || "gamekey-art";
    const icon = product.icon || "bi-box";
    const image = getProductImage(product);
    const category = getProductCategory(product);
    const hasVariations = getProductVariations(product).length > 0;
    const priceLabel = hasVariations ? `${t("From")} ${formatMoney(getProductPrice(product))}` : formatMoney(product.price ?? 0);
    const inStock = isProductInStock(product);

    return `
        <div class="col-6 col-md-6 col-xl-3">
            <article class="card product-card h-100">
                <a class="product-art ${art}" href="product.html?product=${encodeURIComponent(id)}" aria-label="View ${escapeHtml(product.name)}">
                    ${
                        image
                            ? `<img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
                            : `<i class="bi ${icon}"></i>`
                    }
                </a>
                <div class="card-body d-flex flex-column">
                    <div class="d-flex flex-wrap gap-2 mb-2">
                        <span class="badge text-bg-dark">${escapeHtml(category)}</span>
                        <span class="badge ${inStock ? "text-bg-success" : "text-bg-secondary"}">${t(inStock ? "Available" : "Out of stock")}</span>
                    </div>
                    <h2 class="h5">
                        <a class="product-title-link" href="product.html?product=${encodeURIComponent(id)}">${escapeHtml(getProductDisplayName(product))}</a>
                    </h2>
                    <p class="text-secondary flex-grow-1">${escapeHtml(getProductDescription(product))}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="price">${priceLabel}</strong>
                        <button class="btn btn-primary btn-sm" data-add-to-cart="${escapeHtml(id)}" ${inStock ? "" : "disabled"}>${t(inStock ? "Add" : "Unavailable")}</button>
                    </div>
                </div>
            </article>
        </div>
    `;
}

function categoryCardTemplate(category, count, extraClass = "catalog-category-card") {
    return `
        <div class="col-6 col-lg-3">
            <a class="category-card ${extraClass}" href="${getCategoryPage(category)}">
                ${category.photo ? `<img class="category-photo" src="${escapeHtml(category.photo)}" alt="${escapeHtml(category.label || category.name)}" />` : `<i class="bi ${category.icon}"></i>`}
                <span>${category.label}</span>
                ${category.teaser ? `<small>${category.teaser}</small>` : ""}
                ${extraClass ? `<strong>${formatProductCount(count)}</strong>` : ""}
            </a>
        </div>
    `;
}

function renderProductsPage(searchTerm = "") {
    const categoryGrid = document.getElementById("categoryGrid");
    const productSections = document.getElementById("productSections");
    if (!categoryGrid) return;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const catalogProducts = getCatalogProducts();

    const categories = getCategories();
    const selectedCategoryId = new URLSearchParams(window.location.search).get("category") || "";
    const selectedCategory = selectedCategoryId
        ? categories.find((category) => category.id === selectedCategoryId || slugify(category.name) === selectedCategoryId)
        : null;
    const visibleCategories = selectedCategory ? [selectedCategory] : categories;
    const productsHeading = document.getElementById("productsPageHeading");
    const productsDescription = document.getElementById("productsPageDescription");

    if (selectedCategory) {
        if (productsHeading) productsHeading.textContent = selectedCategory.label || selectedCategory.name;
        if (productsDescription) productsDescription.textContent = selectedCategory.description || t("Browse digital products.");
        document.title = `${selectedCategory.label || selectedCategory.name} | HyperKey Store`;
    }

    categoryGrid.innerHTML = categories.map((category) => {
        const count = catalogProducts.filter(([, product]) => getProductCategory(product) === category.name).length;
        return categoryCardTemplate(category, count);
    }).join("");

    if (!productSections) {
        translatePage();
        return;
    }

    if (!selectedCategory && !normalizedSearch) {
        productSections.innerHTML = "";
        translatePage();
        return;
    }

    productSections.innerHTML = visibleCategories.map((category) => {
        const products = catalogProducts.filter(([id, product]) => {
            const haystack = `${id} ${product.name} ${getProductCategory(product)} ${getProductDescription(product)}`.toLowerCase();
            return getProductCategory(product) === category.name && haystack.includes(normalizedSearch);
        });

        if (!products.length && normalizedSearch) return "";

        const productCards = products.map(([id, product]) => productCardTemplate(id, product)).join("");
        const emptyMessage = `
            <div class="col-12">
                <div class="content-panel">
                    <p class="text-secondary mb-0">No products in this category yet.</p>
                </div>
            </div>
        `;

        return `
            <div class="product-section-heading" id="${category.id}">
                <p class="eyebrow mb-2">${category.label}</p>
                <h2 class="h3 fw-black mb-1">${category.heading}</h2>
                <p class="text-secondary mb-0">${category.description}</p>
            </div>
            <div class="row g-4">
                ${productCards || emptyMessage}
            </div>
        `;
    }).join("") || `
        <div class="content-panel text-center">
            <h2 class="h4 fw-black">No matching products</h2>
            <p class="text-secondary mb-0">Try another search term or clear the search box.</p>
        </div>
    `;
    translatePage();
}

function setupProductSearch() {
    const searchInput = document.getElementById("productSearch");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        renderProductsPage(searchInput.value);
    });
}

function renderFeaturedProducts() {
    const featuredProducts = document.getElementById("featuredProducts");
    if (!featuredProducts) return;

    featuredProducts.innerHTML = getCatalogProducts()
        .slice(0, HOME_FEATURED_PRODUCT_LIMIT)
        .map(([id, product]) => productCardTemplate(id, product))
        .join("");
    translatePage();
}

async function renderFaqPage() {
    const faqList = document.getElementById("faqList");
    if (!faqList) return;

    const settings = await loadPaymentSettings();
    const faqs = Array.isArray(settings.faq) && settings.faq.length ? settings.faq : DEFAULT_PAYMENT_SETTINGS.faq;
    faqList.innerHTML = faqs
        .map(
            (item, index) => `
                <details class="content-panel faq-item" ${index === 0 ? "open" : ""}>
                    <summary>
                        <span>${escapeHtml(t(item.question || "Question"))}</span>
                        <i class="bi bi-chevron-down"></i>
                    </summary>
                    <p class="text-secondary mb-0">${escapeHtml(t(item.answer || ""))}</p>
                </details>
            `,
        )
        .join("");
}

function renderHomeCategories() {
    const homeCategoryGrid = document.getElementById("homeCategoryGrid");
    if (!homeCategoryGrid) return;

    homeCategoryGrid.innerHTML = getCategories()
        .slice(0, HOME_CATEGORY_PREVIEW_LIMIT)
        .map((category) => {
            const count = getCatalogProducts().filter(([, product]) => getProductCategory(product) === category.name).length;
            return categoryCardTemplate(category, count, "");
        })
        .join("");
    translatePage();
}

function renderCategoryPage() {
    const categoryProducts = document.getElementById("categoryProducts");
    if (!categoryProducts) return;

    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get("category");
    const currentPage = window.location.pathname.split("/").pop() || "";
    const category = categoryId
        ? getCategories().find((item) => item.id === categoryId || slugify(item.name) === categoryId)
        : getCategories().find((item) => item.page === currentPage);
    const categoryName = category?.name || "";
    const products = getCatalogProducts().filter(([, product]) => getProductCategory(product) === categoryName);
    const title = document.getElementById("categoryPageTitle");
    const description = document.getElementById("categoryPageDescription");

    if (category) {
        if (title) title.textContent = category.label;
        if (description) description.textContent = category.description;
        document.title = `${category.label} | HyperKey Store`;
    }

    categoryProducts.innerHTML = products.length
        ? products.map(([id, product]) => productCardTemplate(id, product)).join("")
        : `<div class="col-12">
            <div class="content-panel text-center">
                <h2 class="h4 fw-black">No products in this category</h2>
                <p class="text-secondary mb-0">Add products to this category in the admin panel.</p>
            </div>
        </div>`;
    translatePage();
}

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch {
        return {};
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function getCartTotal(cart) {
    return Object.entries(cart).reduce((total, [cartKey, qty]) => {
        const line = getCartLine(cartKey);
        return line && line.inStock ? total + line.price * qty : total;
    }, 0);
}

function getCartItemQuantity(cart) {
    return Object.values(cart).reduce((total, qty) => total + Math.max(0, Number(qty) || 0), 0);
}

function updateCartCount() {
    const cart = getCart();
    const count = Object.keys(cart).filter((k) => Number(cart[k]) > 0).length;
    document.querySelectorAll(".cart-count").forEach((item) => {
        const previousCount = item.textContent;
        item.textContent = count;
        if (previousCount !== String(count)) {
            item.classList.remove("cart-count-pop");
            void item.offsetWidth;
            item.classList.add("cart-count-pop");
        }
    });
}

function showToast(message = "Added to cart.") {
    const toastElement = document.getElementById("cartToast");
    if (!toastElement || !window.bootstrap) return;
    const toastBody = toastElement.querySelector(".toast-body");
    if (toastBody) toastBody.textContent = t(message);
    bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 1600 }).show();
}

function ensureCartPopup() {
    let popup = document.getElementById("cartAddPopup");
    if (popup) return popup;

    popup = document.createElement("div");
    popup.id = "cartAddPopup";
    popup.className = "cart-add-popup";
    popup.setAttribute("role", "status");
    popup.setAttribute("aria-live", "polite");
    popup.innerHTML = `
        <button class="cart-add-popup-close" type="button" aria-label="Close cart popup">
            <i class="bi bi-x-lg"></i>
        </button>
        <div class="cart-add-popup-icon">
            <i class="bi bi-bag-check"></i>
        </div>
        <div class="cart-add-popup-body">
            <strong>${t("Item added to cart")}</strong>
            <span>${t("Your cart was updated.")}</span>
            <div class="cart-add-popup-stats">
                <div>
                    <small>${t("Total items")}</small>
                    <b data-cart-popup-items>0</b>
                </div>
                <div>
                    <small>${t("Total price")}</small>
                    <b data-cart-popup-total>0 TND</b>
                </div>
            </div>
            <div class="cart-add-popup-actions">
                <a class="btn btn-outline-dark btn-sm" href="cart.html">${t("View cart")}</a>
                <a class="btn btn-primary btn-sm" href="checkout.html">${t("Checkout")}</a>
            </div>
        </div>
    `;
    document.body.append(popup);

    popup.querySelector(".cart-add-popup-close")?.addEventListener("click", () => {
        hideCartAddPopup();
    });

    return popup;
}

function hideCartAddPopup() {
    const popup = document.getElementById("cartAddPopup");
    if (!popup) return;

    popup.classList.add("is-hiding");
    popup.classList.remove("is-visible");
    window.setTimeout(() => {
        popup.classList.remove("is-hiding");
    }, 280);
}

function showCartAddPopup() {
    const cart = getCart();
    const popup = ensureCartPopup();
    const itemCount = getCartItemQuantity(cart);
    const total = getCartTotal(cart);

    const itemsElement = popup.querySelector("[data-cart-popup-items]");
    const totalElement = popup.querySelector("[data-cart-popup-total]");
    if (itemsElement) itemsElement.textContent = String(itemCount);
    if (totalElement) totalElement.textContent = formatMoney(total);

    popup.classList.remove("is-visible");
    popup.classList.remove("is-hiding");
    void popup.offsetWidth;
    popup.classList.add("is-visible");

    clearTimeout(showCartAddPopup.hideTimer);
    showCartAddPopup.hideTimer = setTimeout(() => {
        hideCartAddPopup();
    }, 5200);
}

function addToCart(id, variationId = "") {
    const product = PRODUCTS[id];
    if (!product) return;
    if (!isProductInStock(product)) {
        showToast("This product is currently out of stock.");
        return;
    }

    const selectedVariation = variationId || getDefaultVariation(product)?.id || "";
    if (!isVariationInStock(getVariation(product, selectedVariation))) {
        showToast("This option is currently out of stock.");
        return;
    }
    const cartKey = makeCartKey(id, selectedVariation);
    const cart = getCart();
    cart[cartKey] = (cart[cartKey] || 0) + 1;
    saveCart(cart);
    renderCartPage();
    renderCheckoutSummary();
    showCartAddPopup();
}

function changeQty(cartKey, amount) {
    const cart = getCart();
    cart[cartKey] = (cart[cartKey] || 0) + amount;
    if (cart[cartKey] <= 0) {
        delete cart[cartKey];
    }
    saveCart(cart);
    renderCartPage();
    renderCheckoutSummary();
}

function renderCartPage() {
    const cartItems = document.getElementById("cartItems");
    if (!cartItems) return;

    const cart = getCart();
    const entries = Object.entries(cart).filter(([cartKey]) => getCartLine(cartKey));
    const hasUnavailableItems = entries.some(([cartKey]) => getCartLine(cartKey)?.inStock === false);

    if (!entries.length) {
        cartItems.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-bag-x display-5 text-secondary"></i>
                <h2 class="h4 fw-black mt-3">Your cart is empty</h2>
                <p class="text-secondary">Add gift cards, top ups, or accounts to continue.</p>
                <a class="btn btn-primary" href="products.html">Shop products</a>
            </div>
        `;
    } else {
        cartItems.innerHTML = entries
            .map(([cartKey, qty]) => {
                const line = getCartLine(cartKey);
                return `
                    <div class="cart-item">
                        <div class="cart-thumb ${line.art}">
                            ${
                                line.image
                                    ? `<img class="cart-thumb-image" src="${escapeHtml(line.image)}" alt="${escapeHtml(line.name)}" />`
                                    : `<i class="bi ${line.icon}"></i>`
                            }
                        </div>
                        <div>
                            <p class="fw-black mb-1">${line.name}</p>
                            <p class="text-secondary mb-0">${line.category} - ${formatMoney(line.price)}</p>
                            ${line.inStock ? "" : '<span class="badge text-bg-secondary mt-2">Out of stock</span>'}
                        </div>
                        <div class="cart-actions text-md-end">
                            <div class="qty-control mb-2" aria-label="Quantity controls">
                                <button type="button" data-change-qty="${cartKey}" data-amount="-1" aria-label="Decrease quantity">
                                    <i class="bi bi-dash"></i>
                                </button>
                                <strong>${qty}</strong>
                                <button type="button" data-change-qty="${cartKey}" data-amount="1" aria-label="Increase quantity" ${line.inStock ? "" : "disabled"}>
                                    <i class="bi bi-plus"></i>
                                </button>
                            </div>
                            <p class="fw-black mb-0">${formatMoney(line.price * qty)}</p>
                        </div>
                    </div>
                `;
            })
            .join("");
        if (hasUnavailableItems) {
            cartItems.insertAdjacentHTML(
                "afterbegin",
                `<div class="alert alert-warning mb-3" role="alert">Remove out-of-stock products before checkout.</div>`,
            );
        }
    }

    const total = getCartTotal(cart);
    const subtotal = document.getElementById("cartSubtotal");
    const cartTotal = document.getElementById("cartTotal");
    if (subtotal) subtotal.textContent = formatMoney(total);
    if (cartTotal) cartTotal.textContent = formatMoney(total);
    updateContinueOrderWhatsAppLinks();
    translatePage();
}

function renderCheckoutSummary() {
    const summary = document.getElementById("checkoutSummary");
    if (!summary) return;

    const cart = getCart();
    const entries = Object.entries(cart).filter(([cartKey]) => getCartLine(cartKey));

    if (!entries.length) {
        summary.innerHTML = `
            <div class="empty-state py-3">
                <p class="text-secondary mb-3">Your cart is empty.</p>
                <a class="btn btn-outline-dark" href="products.html">Add products</a>
            </div>
        `;
    } else {
        summary.innerHTML = entries
            .map(([cartKey, qty]) => {
                const line = getCartLine(cartKey);
                return `
                    <div class="summary-line">
                        <span>${line.name} x ${qty}</span>
                        <strong>${line.inStock ? formatMoney(line.price * qty) : "Out of stock"}</strong>
                    </div>
                `;
            })
            .join("");
    }

    const checkoutTotal = document.getElementById("checkoutTotal");
    if (checkoutTotal) checkoutTotal.textContent = formatMoney(getCartTotal(cart));
    translatePage();
}

function getCheckoutRequestId() {
    return window.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCheckoutItems(cart) {
    return Object.entries(cart).map(([cartKey, qty]) => {
        const { productId, variationId } = parseCartKey(cartKey);
        return {
            productId,
            quantity: Number(qty),
            ...(variationId ? { variationId } : {}),
        };
    });
}

function saveCheckoutSession(session) {
    sessionStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(session));
}

function getCheckoutSession() {
    try {
        return JSON.parse(sessionStorage.getItem(CHECKOUT_SESSION_KEY)) || null;
    } catch {
        return null;
    }
}

function clearCheckoutSession() {
    sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
}

function setAlert(elementId, message = "") {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message ? t(message) : "";
    element.classList.toggle("d-none", !message);
}

function setHtmlAlert(elementId, html = "") {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = html;
    element.classList.toggle("d-none", !html);
    translateElement(element);
}

function setupCheckoutForm() {
    const form = document.getElementById("checkoutForm");
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        if (checkoutSubmitting) return;

        const cart = getCart();
        const validCart = Object.fromEntries(Object.entries(cart).filter(([cartKey, qty]) => getCartLine(cartKey) && Number(qty) > 0));
        const hasUnavailableItems = Object.keys(validCart).some((cartKey) => getCartLine(cartKey)?.inStock === false);
        if (hasUnavailableItems) {
            setAlert("checkoutError", "Remove out-of-stock products before checkout.");
            return;
        }
        if (!Object.keys(validCart).length) {
            setAlert("checkoutError", "Your cart is empty.");
            return;
        }

        const button = document.getElementById("placeOrderButton");
        const buttonText = button?.querySelector(".order-button-text");
        const checkoutRequestId = getCheckoutRequestId();
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "";
        const customerPhone = normalizeTunisianPhoneInput(document.getElementById("customerPhone")?.value || "");

        if (!customerPhone) {
            setAlert("checkoutError", "Enter a valid Tunisian WhatsApp number with 8 digits.");
            return;
        }

        checkoutSubmitting = true;
        if (button) button.disabled = true;
        if (buttonText) buttonText.textContent = t("Opening payment...");
        setAlert("checkoutSuccess", "");
        setAlert("checkoutError", "");

        saveCheckoutSession({
            checkoutRequestId,
            createdAt: new Date().toISOString(),
            cart: validCart,
            items: getCheckoutItems(validCart),
            customerPhone,
            paymentMethod,
            referredBy: getReferralCode(),
        });

        setAlert("checkoutSuccess", "Checkout saved. Opening payment page...");
        window.location.href = "payment.html";
    });
}

function renderPaymentOrderSummary(cart) {
    const summary = document.getElementById("paymentOrderSummary");
    if (!summary) return;

    const entries = Object.entries(cart || {}).filter(([cartKey]) => getCartLine(cartKey));
    summary.innerHTML = entries.length
        ? entries
              .map(([cartKey, qty]) => {
                  const line = getCartLine(cartKey);
                  return `
                    <div class="summary-line">
                        <span>${escapeHtml(line.name)} x ${Number(qty)}</span>
                        <strong>${formatPlainTndAmount(line.price * Number(qty))}</strong>
                    </div>
                `;
              })
              .join("")
        : `<p class="text-secondary mb-0">No products found in this checkout session.</p>`;
    translatePage();
}

function renderPaymentProofFields(details) {
    const proofFields = document.getElementById("paymentProofFields");
    if (!proofFields) return;

    if (details.proofType === "reference") {
        proofFields.innerHTML = `
            <label class="form-label" for="paymentReference">${escapeHtml(details.proofLabel)}</label>
            <input
                class="form-control"
                id="paymentReference"
                type="text"
                autocomplete="off"
                maxlength="80"
                placeholder="${escapeHtml(details.proofLabel)}"
                required
            />
        `;
        translatePage();
        return;
    }

    const count = Number(details.cardCount) || 1;
    const codeLength = Number(details.codeLength) || 15;
    proofFields.innerHTML = `
        <label class="form-label">Recharge card codes</label>
        <div class="payment-code-grid">
            ${Array.from({ length: count })
                .map(
                    (_, index) => `
                        <input
                            class="form-control"
                            type="text"
                            inputmode="numeric"
                            pattern="\\d{${codeLength}}"
                            maxlength="${codeLength}"
                            data-card-code
                            placeholder="${escapeHtml(`${t("Card")} ${index + 1} - ${codeLength} ${t("digits")}`)}"
                            required
                        />
                    `,
                )
                .join("")}
        </div>
    `;
    translatePage();
}

function renderPaymentRecipient(details) {
    const recipient = document.getElementById("paymentRecipientDetails");
    if (!recipient) return;

    if (details.proofType !== "reference") {
        recipient.innerHTML = "";
        recipient.classList.add("d-none");
        return;
    }

    const hasRecipient = Boolean(details.recipientValue || details.recipientHint);
    recipient.classList.remove("d-none");
    recipient.innerHTML = hasRecipient
        ? `
            <div class="payment-recipient-card">
                <div>
                    <span>${t("Send money to")}</span>
                    ${
                        details.recipientValue
                            ? `<code>${escapeHtml(details.recipientValue)}</code>`
                            : `<p class="text-warning mb-0">${t("Recipient details are not configured.")}</p>`
                    }
                    ${details.recipientHint ? `<p class="text-secondary mb-0">${escapeHtml(details.recipientHint)}</p>` : ""}
                </div>
                ${
                    details.recipientValue
                        ? `<button class="btn btn-outline-dark btn-sm" type="button" data-copy-text="${escapeHtml(details.recipientValue)}">
                            <i class="bi bi-clipboard me-1"></i>${t("Copy")}
                        </button>`
                        : ""
                }
            </div>
        `
        : `
            <div class="alert alert-warning mb-0" role="alert">
                ${t("Recipient details are not configured. Contact support before sending money.")}
            </div>
        `;
    translatePage();
}

function renderPaymentGuide(method) {
    const guide = document.getElementById("paymentGuide");
    if (!guide) return;

    const guides = {
        d17: {
            image: "assets/payment-d17-guide.svg",
            title: "Where to find the authorization number",
        },
        flouci: {
            image: "assets/payment-flouci-guide.svg",
            title: "Where to find the transaction ID",
        },
    };
    const config = guides[method];
    guide.classList.toggle("d-none", !config);
    guide.innerHTML = config
        ? `
            <p class="form-label mb-2">${escapeHtml(config.title)}</p>
            <img src="${escapeHtml(config.image)}" alt="${escapeHtml(config.title)}" loading="lazy" />
        `
        : "";
    translatePage();
}

function readPaymentProof(method) {
    if (method === "tt-card") {
        return {
            cardCodes: [...document.querySelectorAll("[data-card-code]")].map((input) => input.value.trim()),
        };
    }

    return {
        reference: document.getElementById("paymentReference")?.value.trim() || "",
    };
}

async function renderPaymentPage() {
    const page = document.getElementById("paymentPage");
    if (!page) return null;

    const button = document.getElementById("submitPaymentButton");
    const session = getCheckoutSession();
    if (!session) {
        if (button) button.disabled = true;
        setAlert("paymentError", "Checkout session was not found. Please return to checkout and choose a payment method.");
        return null;
    }

    const validCart = Object.fromEntries(
        Object.entries(session.cart || {}).filter(([cartKey, qty]) => getCartLine(cartKey)?.inStock && Number(qty) > 0),
    );
    if (!Object.keys(validCart).length) {
        if (button) button.disabled = true;
        setAlert("paymentError", "No available products were found in this checkout session. Return to cart and remove unavailable items.");
        renderPaymentOrderSummary({});
        return null;
    }

    try {
        const settings = await loadPaymentSettings();
        const productTotal = getCartTotal(validCart);
        const details = calculatePaymentDetails(productTotal, session.paymentMethod, settings);

        document.getElementById("paymentMethodTitle").textContent = t(details.label);
        document.getElementById("paymentInstructions").textContent = t(details.instructions);
        document.getElementById("paymentOriginalTotal").textContent = formatPlainTndAmount(productTotal);
        document.getElementById("paymentAmountDue").textContent = formatPlainTndAmount(details.amountDue);
        document.getElementById("paymentSummaryAmount").textContent = formatPlainTndAmount(details.amountDue);

        renderPaymentOrderSummary(validCart);
        renderPaymentRecipient(details);
        renderPaymentProofFields(details);
        renderPaymentGuide(details.method);
        const paymentContext = { session: { ...session, cart: validCart, items: getCheckoutItems(validCart) }, details };
        updateContinueOrderWhatsAppLinks(paymentContext);
        setAlert("paymentError", "");
        return paymentContext;
    } catch (error) {
        if (button) button.disabled = true;
        setAlert("paymentError", error.message || "Could not prepare payment.");
        renderPaymentOrderSummary(validCart);
        updateContinueOrderWhatsAppLinks();
        return null;
    }
}

async function submitPaymentOrder(session) {
    let response;
    try {
        response = await fetch(ORDER_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                checkoutRequestId: session.checkoutRequestId,
                items: session.items,
                paymentMethod: session.paymentMethod,
                paymentProof: readPaymentProof(session.paymentMethod),
                customerPhone: session.customerPhone,
                referredBy: session.referredBy || getReferralCode(),
            }),
        });
    } catch (networkError) {
        throw new Error("Could not reach checkout backend. Check the Worker URL in config.js and your network connection.");
    }

    const responseText = await response.text();
    let result = {};
    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error("Checkout backend did not return JSON. Check the Worker URL in config.js.");
    }

    if (!response.ok || !result.ok) {
        throw new Error(result.error || "Order could not be submitted.");
    }

    return result;
}

function renderPaymentSuccess(result) {
    const orderId = String(result.orderId || "");
    window.location.href = `order-received.html?order=${encodeURIComponent(orderId)}`;
}

function setupPaymentForm() {
    const form = document.getElementById("paymentForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }
        if (paymentSubmitting) return;

        const session = getCheckoutSession();
        if (!session) {
            setAlert("paymentError", "Checkout session was not found. Please return to checkout and try again.");
            return;
        }
        if (!ORDER_API_URL) {
            setAlert("paymentError", "Checkout backend is not configured. Paste your Cloudflare Worker URL into config.js.");
            return;
        }

        const button = document.getElementById("submitPaymentButton");
        const buttonText = button?.querySelector(".payment-button-text");

        paymentSubmitting = true;
        if (button) button.disabled = true;
        if (buttonText) buttonText.textContent = t("Submitting...");
        setAlert("paymentSuccess", "");
        setAlert("paymentError", "");

        try {
            const validCart = Object.fromEntries(
                Object.entries(session.cart || {}).filter(([cartKey, qty]) => getCartLine(cartKey)?.inStock && Number(qty) > 0),
            );
            if (!Object.keys(validCart).length) {
                throw new Error("No valid products were found in this checkout session.");
            }
            const currentSession = {
                ...session,
                cart: validCart,
                items: getCheckoutItems(validCart),
            };
            const result = await submitPaymentOrder(currentSession);
            localStorage.removeItem(CART_KEY);
            clearCheckoutSession();
            updateCartCount();
            form.reset();
            form.classList.remove("was-validated");
            renderPaymentSuccess(result);
        } catch (submitError) {
            setAlert("paymentError", submitError.message || "Order failed. Please try again.");
        } finally {
            paymentSubmitting = false;
            if (button) button.disabled = false;
            if (buttonText) buttonText.textContent = t("Submit order for review");
        }
    });
}

async function fetchOrderStatus(orderId, customerPhone) {
    if (!ORDER_API_URL) {
        throw new Error("Order status backend is not configured. Check config.js.");
    }

    const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "order-status",
            orderId,
            customerPhone,
        }),
    });

    const responseText = await response.text();
    let result = {};
    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error("Order status backend did not return JSON.");
    }

    if (!response.ok || !result.ok) {
        throw new Error(result.error || "Order could not be found.");
    }

    return result.order;
}

function getStatusTone(status, label = "") {
    const value = String(status || label || "").toLowerCase();
    if (["verified", "delivered"].some((item) => value.includes(item))) return "good";
    if (["rejected", "cancelled", "canceled"].some((item) => value.includes(item))) return "bad";
    if (["pending", "waiting", "manual"].some((item) => value.includes(item))) return "pending";
    return "neutral";
}

function statusBadge(label, status) {
    return `
        <strong class="status-badge status-${getStatusTone(status, label)}">
            <span class="status-dot" aria-hidden="true"></span>
            ${escapeHtml(label)}
        </strong>
    `;
}

function getDefaultSupportMessage() {
    if (CURRENT_LANGUAGE === "ar") return "\u0645\u0631\u062D\u0628\u0627 HyperKey Store\u060C \u0623\u062D\u062A\u0627\u062C \u0645\u0633\u0627\u0639\u062F\u0629 \u0641\u064A \u0637\u0644\u0628\u064A.";
    if (CURRENT_LANGUAGE === "fr") return "Bonjour HyperKey Store, j'ai besoin d'aide pour ma commande.";
    return "Hello HyperKey Store, I need help with my order.";
}

function getOrderSupportMessage(orderId) {
    if (CURRENT_LANGUAGE === "ar") return `\u0645\u0631\u062D\u0628\u0627 HyperKey Store\u060C \u0623\u062D\u062A\u0627\u062C \u0645\u0633\u0627\u0639\u062F\u0629 \u0641\u064A \u0627\u0644\u0637\u0644\u0628 ${orderId}.`;
    if (CURRENT_LANGUAGE === "fr") return `Bonjour HyperKey Store, j'ai besoin d'aide pour la commande ${orderId}.`;
    return `Hello HyperKey Store, I need help with order ${orderId}.`;
}

function getOrderStatusSupportMessage(order) {
    const orderId = order?.id || "";
    const status = t(getOrderCurrentStatus(order).label);
    if (CURRENT_LANGUAGE === "ar") {
        return [
            "\u0645\u0631\u062D\u0628\u0627 HyperKey Store\u060C \u0623\u062D\u062A\u0627\u062C \u0645\u0633\u0627\u0639\u062F\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628.",
            `Order ID: ${orderId}`,
            `Status: ${status}`,
        ].join("\n");
    }
    if (CURRENT_LANGUAGE === "fr") {
        return [
            "Bonjour HyperKey Store, j'ai besoin d'aide pour cette commande.",
            `Order ID: ${orderId}`,
            `Statut: ${status}`,
        ].join("\n");
    }
    return [
        "Hello HyperKey Store, I need help with this order.",
        `Order ID: ${orderId}`,
        `Status: ${status}`,
    ].join("\n");
}


function getProductAvailabilityMessage(productName) {
    if (CURRENT_LANGUAGE === "ar") return `\u0645\u0631\u062D\u0628\u0627 HyperKey Store\u060C \u0647\u0644 ${productName} \u0645\u062A\u0648\u0641\u0631\u061F`;
    if (CURRENT_LANGUAGE === "fr") return `Bonjour HyperKey Store, est-ce que ${productName} est disponible ?`;
    return `Hello HyperKey Store, is ${productName} available?`;
}

function getWhatsAppSupportUrl(message = "") {
    const text = message || getDefaultSupportMessage();
    return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function getValidCartEntries(cart) {
    return Object.entries(cart || {}).filter(([cartKey, qty]) => {
        const line = getCartLine(cartKey);
        return line && line.inStock !== false && Number(qty) > 0;
    });
}

function getValidCartTotal(cart) {
    return getValidCartEntries(cart).reduce((total, [cartKey, qty]) => {
        const line = getCartLine(cartKey);
        return total + line.price * Number(qty);
    }, 0);
}

function getCartSummaryLines(cart) {
    return getValidCartEntries(cart).map(([cartKey, qty]) => {
        const line = getCartLine(cartKey);
        const quantity = Number(qty);
        const quantityText = quantity > 1 ? `${quantity}x ` : "";
        return `- ${quantityText}${line.name} - ${formatPlainTndAmount(line.price * quantity)}`;
    });
}

function getCartWhatsAppMessage(cart) {
    const lines = getCartSummaryLines(cart);
    if (!lines.length) return getDefaultSupportMessage();

    const total = formatPlainTndAmount(getValidCartTotal(cart));
    if (CURRENT_LANGUAGE === "fr") {
        return ["Bonjour HyperKey Store, je veux continuer cette commande:", "", ...lines, "", `Total: ${total}`].join("\n");
    }
    if (CURRENT_LANGUAGE === "ar") {
        return ["\u0645\u0631\u062D\u0628\u0627 HyperKey Store\u060C \u0623\u0631\u064A\u062F \u0645\u062A\u0627\u0628\u0639\u0629 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628:", "", ...lines, "", `\u0627\u0644\u0645\u062C\u0645\u0648\u0639: ${total}`].join("\n");
    }
    return ["Hello HyperKey Store, I want to continue this order:", "", ...lines, "", `Total: ${total}`].join("\n");
}

function getPaymentWhatsAppMessage(session, details) {
    const cart = session?.cart || {};
    const lines = getCartSummaryLines(cart);
    if (!lines.length) return getDefaultSupportMessage();

    const productsTotal = formatPlainTndAmount(getValidCartTotal(cart));
    const amountDue = details?.amountDue ? formatPlainTndAmount(details.amountDue) : formatPlainTndAmount(getValidCartTotal(cart));
    const method = details?.label || session?.paymentMethod || "";
    const cardInfo = details?.method === "tt-card" && details.cardCount && details.cardValue
        ? `${details.cardCount} x ${formatPlainTndAmount(details.cardValue)}`
        : "";
    if (CURRENT_LANGUAGE === "fr") {
        return [
            "Bonjour HyperKey Store, je veux continuer mon paiement:",
            "",
            ...lines,
            "",
            method ? `Methode: ${method}` : "",
            `Total produits: ${productsTotal}`,
            `Montant a envoyer: ${amountDue}`,
            cardInfo ? `Cartes TT requises: ${cardInfo}` : "",
        ]
            .filter((line) => line !== "")
            .join("\n");
    }
    if (CURRENT_LANGUAGE === "ar") {
        return [
            "\u0645\u0631\u062D\u0628\u0627 HyperKey Store\u060C \u0623\u0631\u064A\u062F \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062F\u0641\u0639:",
            "",
            ...lines,
            "",
            method ? `\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639: ${method}` : "",
            `\u0645\u062C\u0645\u0648\u0639 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A: ${productsTotal}`,
            `\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u0637\u0644\u0648\u0628: ${amountDue}`,
            cardInfo ? `\u0628\u0637\u0627\u0642\u0627\u062A TT \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629: ${cardInfo}` : "",
        ]
            .filter((line) => line !== "")
            .join("\n");
    }
    return [
        "Hello HyperKey Store, I want to continue my payment:",
        "",
        ...lines,
        "",
        method ? `Payment method: ${method}` : "",
        `Products total: ${productsTotal}`,
        `Amount to send: ${amountDue}`,
        cardInfo ? `TT cards required: ${cardInfo}` : "",
    ]
        .filter((line) => line !== "")
        .join("\n");
}

function updateContinueOrderWhatsAppLinks(paymentContext = null) {
    document.querySelectorAll("[data-whatsapp-cart-button]").forEach((link) => {
        link.href = getWhatsAppSupportUrl(getCartWhatsAppMessage(getCart()));
    });

    document.querySelectorAll("[data-whatsapp-payment-button]").forEach((link) => {
        const session = paymentContext?.session || getCheckoutSession();
        link.href = getWhatsAppSupportUrl(getPaymentWhatsAppMessage(session, paymentContext?.details));
    });
}

function getOrderTimelineSteps(order) {
    const paymentStatus = String(order.paymentStatusCode || "").toLowerCase();
    const deliveryStatus = String(order.deliveryStatusCode || "").toLowerCase();
    const paymentVerified = paymentStatus === "verified";
    const paymentRejected = paymentStatus === "rejected";
    const delivered = deliveryStatus === "delivered";
    const cancelled = ["cancelled", "canceled"].includes(deliveryStatus);

    return [
        {
            label: "Order sent",
            status: "complete",
        },
        {
            label: "Payment check",
            status: paymentRejected ? "bad" : paymentVerified || delivered ? "complete" : "current",
        },
        {
            label: "Delivery info",
            status: cancelled ? "bad" : delivered ? "complete" : paymentVerified ? "current" : "waiting",
        },
        {
            label: "Delivered",
            status: delivered ? "complete" : "waiting",
        },
    ];
}

function renderOrderTimeline(order) {
    return `
        <div class="order-timeline mb-4">
            ${getOrderTimelineSteps(order)
                .map(
                    (step) => `
                        <div class="order-timeline-step timeline-${step.status}">
                            <span aria-hidden="true"></span>
                            <strong>${escapeHtml(step.label)}</strong>
                        </div>
                    `,
                )
                .join("")}
        </div>
    `;
}

function renderOrderProgressBar(order) {
    const steps = getOrderTimelineSteps(order);
    const activeIndex = Math.max(
        0,
        steps.findIndex((step) => ["current", "bad"].includes(step.status)) === -1
            ? steps.reduce((last, step, index) => (step.status === "complete" ? index : last), 0)
            : steps.findIndex((step) => ["current", "bad"].includes(step.status)),
    );
    const progressPercent = steps.length > 1 ? Math.round((activeIndex / (steps.length - 1)) * 100) : 0;

    return `
        <div class="order-progress-bar mb-4" aria-label="${escapeHtml(t("Order status"))}">
            <div class="order-progress-scroll">
                <div class="order-progress-inner">
                    <div class="order-progress-track" aria-hidden="true">
                        <span style="width: ${progressPercent}%"></span>
                    </div>
                    <div class="order-progress-steps">
                        ${steps
                            .map(
                                (step, index) => `
                                    <div class="order-progress-step progress-${escapeHtml(step.status)}">
                                        <span>${index + 1}</span>
                                        <strong>${escapeHtml(t(step.label))}</strong>
                                    </div>
                                `,
                            )
                            .join("")}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function isOrderDelivered(order) {
    return String(order?.deliveryStatusCode || "").toLowerCase() === "delivered";
}

function isOrderWaitingForRefresh(order) {
    const paymentStatus = String(order?.paymentStatusCode || "").toLowerCase();
    const deliveryStatus = String(order?.deliveryStatusCode || "").toLowerCase();
    const needsCustomerInput = Array.isArray(order?.customerInputs) && order.customerInputs.length > 0;
    if (["rejected"].includes(paymentStatus)) return false;
    if (["delivered", "cancelled", "canceled"].includes(deliveryStatus)) return false;
    if (paymentStatus === "verified" && needsCustomerInput) return false;
    return true;
}

function getOrderCurrentStatus(order) {
    const paymentStatus = String(order.paymentStatusCode || "").toLowerCase();
    const deliveryStatus = String(order.deliveryStatusCode || "").toLowerCase();
    const hasCustomerInputs = Array.isArray(order.customerInputs) && order.customerInputs.length > 0;
    const delivered = deliveryStatus === "delivered";
    const cancelled = deliveryStatus === "cancelled";
    const paymentVerified = paymentStatus === "verified";
    const paymentRejected = paymentStatus === "rejected";

    if (paymentRejected) {
        return {
            label: "Payment rejected",
            action: "Contact support to fix this order.",
            tone: "bad",
            icon: "bi-x-circle",
        };
    }

    if (cancelled) {
        return {
            label: "Delivery cancelled",
            action: "Contact support to fix this order.",
            tone: "bad",
            icon: "bi-x-circle",
        };
    }

    if (delivered) {
        return {
            label: "Delivered",
            action: "Copy your delivered item below.",
            tone: "good",
            icon: "bi-check-circle",
        };
    }

    if (paymentVerified && hasCustomerInputs) {
        return {
            label: "Delivery information needed",
            action: "Send the requested delivery information below.",
            tone: "pending",
            icon: "bi-controller",
        };
    }

    if (paymentVerified) {
        return {
            label: "Delivery waiting",
            action: "Your order is being prepared.",
            tone: "pending",
            icon: "bi-box-seam",
        };
    }

    return {
        label: "Payment review",
        action: "We are checking your payment. Refresh later.",
        tone: "pending",
        icon: "bi-hourglass-split",
    };
}

function getOrderStatusReason(order) {
    const paymentStatus = String(order.paymentStatusCode || "").toLowerCase();
    const deliveryStatus = String(order.deliveryStatusCode || "").toLowerCase();
    if (paymentStatus === "rejected") return order.paymentStatusReason || "";
    if (deliveryStatus === "cancelled" || deliveryStatus === "canceled") return order.deliveryStatusReason || "";
    return "";
}

function renderCurrentStatusPanel(order) {
    const current = getOrderCurrentStatus(order);
    const title = order.statusTitle || current.label;
    const message = order.statusMessage || current.action;
    const reason = getOrderStatusReason(order);
    return `
        <div class="current-status-panel status-${escapeHtml(current.tone)} mb-4">
            <div class="current-status-icon">
                <i class="bi ${escapeHtml(current.icon)}"></i>
            </div>
            <div class="current-status-content">
                <span>${t("Current status")}</span>
                <strong>${escapeHtml(t(title))}</strong>
                <p class="current-status-action">${escapeHtml(t(message))}</p>
                ${
                    reason
                        ? `<div class="status-reason-box mt-3">
                            <span>${t("Reason")}</span>
                            <b>${escapeHtml(reason)}</b>
                        </div>`
                        : ""
                }
            </div>
        </div>
    `;
}

function getDeliveryLines(order) {
    return (order.deliveries || []).flatMap((delivery) => (Array.isArray(delivery.lines) ? delivery.lines : []));
}

function renderDeliveryCodes(order) {
    const lines = getDeliveryLines(order);
    if (!lines.length) return "";

    return `
        <div class="order-delivery-box order-delivery-box-ready mt-4">
            <div class="order-delivery-header">
                <div>
                    <p class="eyebrow mb-1">${t("Delivered")}</p>
                    <h3 class="h5 fw-black mb-1"><i class="bi bi-key me-2"></i>${t("Delivery details")}</h3>
                    <p class="text-secondary mb-0">${t("Copy your code or delivery details and use them on the correct platform.")}</p>
                </div>
            </div>
            <div class="delivery-code-list">
                ${lines
                    .map((line, index) => {
                        const code = String(line.code || "").trim();
                        const note = String(line.note || "").trim() || `${t("Delivery code")} ${index + 1}`;
                        return `
                            <div class="delivery-code-row">
                                <div>
                                    <span>${escapeHtml(note)}</span>
                                    ${code ? `<code>${escapeHtml(code)}</code>` : ""}
                                </div>
                                ${
                                    code
                                        ? `<button class="btn btn-outline-dark btn-sm" type="button" data-copy-text="${escapeHtml(code)}">
                                            <i class="bi bi-clipboard me-1"></i>Copy
                                        </button>`
                                        : ""
                                }
                            </div>
                        `;
                    })
                    .join("")}
            </div>
        </div>
    `;
}

function renderOrderProducts(order, products) {
    if (!products) return `<p class="text-secondary mb-0">${t("No products found for this order.")}</p>`;

    const items = Array.isArray(order.items) ? order.items : [];
    const itemCount = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
    const total = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);

    return `
        <details class="order-products-details mb-4">
            <summary aria-label="${escapeHtml(t("Products in this order"))}">
                <span class="order-products-summary-copy">
                    <small>${t("Products in this order")}</small>
                    <strong class="order-products-summary-line">
                        <span data-product-count-value="${escapeHtml(itemCount)}">${escapeHtml(formatProductCount(itemCount))}</span>
                        <span aria-hidden="true">&bull;</span>
                        <span class="ltr-value">${escapeHtml(formatPlainTndAmount(total))}</span>
                    </strong>
                </span>
                <i class="bi bi-chevron-down"></i>
            </summary>
            <div class="order-products-details-body">
                ${products}
            </div>
        </details>
    `;
}

function renderCustomerInputForm(order) {
    const inputs = Array.isArray(order.customerInputs) ? order.customerInputs : [];
    if (!inputs.length) return "";

    return `
        <form class="customer-input-form mt-4" data-customer-input-form data-order-id="${escapeHtml(order.id)}">
            <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-controller"></i>
                <h3 class="h5 fw-black mb-0">${t("Delivery information needed")}</h3>
            </div>
            <p class="text-secondary mb-3">${t("Payment is verified. Send the details below so we can complete delivery.")}</p>
            <div class="customer-input-list">
                ${inputs
                    .map(
                        (input, index) => `
                            <div>
                                <label class="form-label" for="customerInput${index}">
                                    ${escapeHtml(t(input.label))} ${t("for")} ${escapeHtml(input.productName)}
                                </label>
                                <input
                                    class="form-control"
                                    id="customerInput${index}"
                                    type="text"
                                    maxlength="120"
                                    autocomplete="off"
                                    data-customer-input
                                    data-key="${escapeHtml(input.key || "")}"
                                    data-product-id="${escapeHtml(input.productId)}"
                                    data-variation-id="${escapeHtml(input.variationId || "")}"
                                    data-product-name="${escapeHtml(input.productName)}"
                                    data-label="${escapeHtml(input.label)}"
                                    required
                                />
                            </div>
                        `,
                    )
                    .join("")}
            </div>
            <button class="btn btn-primary mt-3" type="submit" data-customer-input-button>
                <span class="customer-input-button-text">${t("Send for delivery")}</span>
            </button>
            <div class="alert mt-3 d-none" data-customer-input-alert role="alert"></div>
        </form>
    `;
}

async function submitCustomerInput(form) {
    if (!ORDER_API_URL) throw new Error("Order backend is not configured. Check config.js.");

    const orderId = form.dataset.orderId || "";
    const customerPhone = normalizeTunisianPhoneInput(document.getElementById("statusCustomerPhone")?.value || "");
    if (!customerPhone) throw new Error("Enter the same Tunisian WhatsApp number used at checkout.");

    const inputs = [...form.querySelectorAll("[data-customer-input]")].map((input) => ({
        key: input.dataset.key || "",
        productId: input.dataset.productId || "",
        variationId: input.dataset.variationId || "",
        productName: input.dataset.productName || "",
        label: input.dataset.label || "",
        value: input.value.trim(),
    }));

    if (inputs.some((input) => !input.value)) throw new Error("Fill every delivery information field.");

    const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "customer-input",
            orderId,
            customerPhone,
            inputs,
        }),
    });

    const responseText = await response.text();
    let result = {};
    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error("Order backend did not return JSON.");
    }

    if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not send delivery information.");
    }

    return result;
}

function renderOrderStatusResult(order) {
    const result = document.getElementById("orderStatusResult");
    if (!result) return;

    const products = (order.items || [])
        .map(
            (item) => `
                <div class="summary-line">
                    <span>${escapeHtml(item.quantity > 1 ? `${item.quantity} x ` : "")}${escapeHtml(item.productName)}</span>
                    <strong>${formatPlainTndAmount(item.lineTotal)}</strong>
                </div>
            `,
        )
        .join("");
    const deliveryDetails = renderDeliveryCodes(order);
    const supportUrl = getWhatsAppSupportUrl(getOrderStatusSupportMessage(order));

    result.innerHTML = `
        <div class="content-panel order-status-card">
            <div class="order-status-header mb-4">
                <div>
                    <p class="eyebrow mb-2">${t("Order status")}</p>
                    <h2 class="h3 fw-black mb-0">${escapeHtml(order.id)}</h2>
                </div>
                <div class="order-status-actions">
                    <button class="btn btn-primary" type="button" data-refresh-order-status>
                        <i class="bi bi-arrow-clockwise me-1"></i>${t("Refresh status")}</button>
                </div>
            </div>
            ${renderCurrentStatusPanel(order)}
            ${renderOrderProgressBar(order)}
            ${renderOrderProducts(order, products)}
            ${deliveryDetails}
            ${renderCustomerInputForm(order)}
            <a class="btn btn-outline-dark w-100 mt-4" href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener">
                <i class="bi bi-whatsapp me-2"></i>${t("Contact support about this order")}</a>
            <p class="small text-secondary mt-3 mb-0">${t("Payment proofs and recharge card codes are hidden after submission.")}</p>
        </div>
    `;
    result.classList.remove("d-none");
    document.getElementById("orderStatusEmpty")?.classList.add("d-none");
    translatePage();
}

function getSavedOrderStatusLookup() {
    try {
        return JSON.parse(localStorage.getItem(ORDER_STATUS_LOOKUP_KEY)) || {};
    } catch {
        return {};
    }
}

function saveOrderStatusLookup(orderId, customerPhone) {
    localStorage.setItem(
        ORDER_STATUS_LOOKUP_KEY,
        JSON.stringify({
            orderId,
            customerPhone,
        }),
    );
}

function setupOrderStatusPage() {
    const form = document.getElementById("orderStatusForm");
    if (!form) return;

    let autoRefreshTimer = null;

    function clearAutoRefresh() {
        if (!autoRefreshTimer) return;
        window.clearTimeout(autoRefreshTimer);
        autoRefreshTimer = null;
    }

    function scheduleAutoRefresh(order) {
        clearAutoRefresh();
        if (!isOrderWaitingForRefresh(order)) return;
        autoRefreshTimer = window.setTimeout(() => {
            checkOrderStatus({ silent: true });
        }, 45000);
    }

    async function checkOrderStatus(options = {}) {
        const silent = Boolean(options.silent);
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const orderId = document.getElementById("statusOrderId")?.value.trim().toUpperCase() || "";
        const customerPhone = normalizeTunisianPhoneInput(document.getElementById("statusCustomerPhone")?.value || "");
        const button = document.getElementById("checkOrderButton");
        const buttonText = button?.querySelector(".check-order-button-text");
        const refreshButton = document.querySelector("[data-refresh-order-status]");

        if (!customerPhone) {
            setAlert("orderStatusError", "Enter the same Tunisian WhatsApp number used at checkout.");
            return;
        }

        clearAutoRefresh();
        if (!silent && button) button.disabled = true;
        if (refreshButton) refreshButton.disabled = true;
        if (!silent && buttonText) buttonText.textContent = t("Checking...");
        setAlert("orderStatusError", "");
        if (!silent) document.getElementById("orderStatusResult")?.classList.add("d-none");

        try {
            saveOrderStatusLookup(orderId, customerPhone);
            const order = await fetchOrderStatus(orderId, customerPhone);
            renderOrderStatusResult(order);
            scheduleAutoRefresh(order);
        } catch (error) {
            setAlert("orderStatusError", error.message || "Could not check this order.");
        } finally {
            if (button) button.disabled = false;
            if (refreshButton) refreshButton.disabled = false;
            if (buttonText) buttonText.textContent = t("Check order");
        }
    }

    document.getElementById("orderStatusResult")?.addEventListener("submit", async (event) => {
        const inputForm = event.target.closest("[data-customer-input-form]");
        if (!inputForm) return;

        event.preventDefault();
        if (customerInputSubmitting) return;
        if (!inputForm.checkValidity()) {
            inputForm.classList.add("was-validated");
            return;
        }

        const button = inputForm.querySelector("[data-customer-input-button]");
        const buttonText = inputForm.querySelector(".customer-input-button-text");
        const alert = inputForm.querySelector("[data-customer-input-alert]");

        customerInputSubmitting = true;
        clearAutoRefresh();
        if (button) button.disabled = true;
        if (buttonText) buttonText.textContent = "Sending...";
        if (alert) {
            alert.textContent = "";
            alert.className = "alert mt-3 d-none";
        }

        try {
            const result = await submitCustomerInput(inputForm);
            if (alert) {
                alert.textContent = t(result.message || "Information sent for delivery.");
                alert.className = "alert alert-success mt-3";
            }
            inputForm.querySelectorAll("input, button").forEach((control) => {
                control.disabled = true;
            });
        } catch (error) {
            if (alert) {
                alert.textContent = t(error.message || "Could not send delivery information.");
                alert.className = "alert alert-danger mt-3";
            }
            if (button) button.disabled = false;
        } finally {
            customerInputSubmitting = false;
            if (buttonText) buttonText.textContent = t("Send for delivery");
        }
    });

    document.getElementById("orderStatusResult")?.addEventListener("click", (event) => {
        const refreshButton = event.target.closest("[data-refresh-order-status]");
        if (!refreshButton) return;
        checkOrderStatus();
    });

    const params = new URLSearchParams(window.location.search);
    const savedLookup = getSavedOrderStatusLookup();
    const orderInput = document.getElementById("statusOrderId");
    const phoneInput = document.getElementById("statusCustomerPhone");
    if (orderInput && params.get("order")) {
        orderInput.value = params.get("order").toUpperCase();
    } else if (orderInput && savedLookup.orderId) {
        orderInput.value = String(savedLookup.orderId).toUpperCase();
    }
    if (phoneInput && savedLookup.customerPhone) {
        phoneInput.value = formatTunisianPhone(savedLookup.customerPhone);
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        checkOrderStatus();
    });
}


function setupOrderReceivedPage() {
    const panel = document.getElementById("orderReceivedPanel");
    if (!panel) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = String(params.get("order") || "").trim().toUpperCase();
    const missing = document.getElementById("orderReceivedMissing");

    if (!orderId) {
        panel.classList.add("d-none");
        missing?.classList.remove("d-none");
        return;
    }

    const display = document.getElementById("receivedOrderId");
    const exampleDisplay = document.getElementById("receivedExampleOrderId");
    const copyButton = document.getElementById("copyReceivedOrderId");
    const statusLink = document.getElementById("receivedStatusLink");
    const statusUrl = `order-status.html?order=${encodeURIComponent(orderId)}`;

    if (display) display.textContent = orderId;
    if (exampleDisplay) exampleDisplay.textContent = orderId;
    if (copyButton) copyButton.dataset.copyOrderId = orderId;
    if (statusLink) statusLink.href = statusUrl;
}

function updateProductDetailSelection(productId, variationId = "") {
    const product = PRODUCTS[productId];
    if (!product) return;

    const variation = getVariation(product, variationId) || getDefaultVariation(product);
    const inStock = isProductInStock(product) && isVariationInStock(variation);
    const displayName = getVariationName(product, variation);
    const displayPrice = variation?.price ?? product.price ?? 0;
    const priceElement = document.getElementById("selectedProductPrice");
    const pageTitleElement = document.getElementById("productPageTitle");
    const breadcrumbElement = document.getElementById("breadcrumbProductName");
    const cartButtons = document.querySelectorAll("[data-selected-product-target]");

    if (priceElement) priceElement.textContent = formatMoney(displayPrice);
    if (pageTitleElement) pageTitleElement.textContent = displayName;
    if (breadcrumbElement) breadcrumbElement.textContent = displayName;
    document.title = `${displayName} | HyperKey Store`;

    cartButtons.forEach((item) => {
        item.dataset.addToCart = productId;
        item.classList.toggle("disabled", !inStock);
        item.setAttribute("aria-disabled", String(!inStock));
        if ("disabled" in item) item.disabled = !inStock;
        if (variation) {
            item.dataset.productVariation = variation.id;
        } else {
            delete item.dataset.productVariation;
        }

        if (item.tagName === "A") {
            if (!item.dataset.originalHref) item.dataset.originalHref = item.getAttribute("href") || "checkout.html";
            item.setAttribute("href", inStock ? item.dataset.originalHref : "#");
            item.textContent = t(inStock ? "Buy now" : "Unavailable");
        } else {
            item.innerHTML = inStock ? `<i class="bi bi-bag-plus me-2"></i>${t("Add to cart")}` : t("Unavailable");
        }
    });

    document.querySelectorAll("[data-product-option]").forEach((button) => {
        const option = getVariation(product, button.dataset.productOption);
        const optionAvailable = isProductInStock(product) && isVariationInStock(option);
        const isActive = variation && button.dataset.productOption === variation.id;
        button.classList.toggle("active", isActive);
        button.classList.toggle("opacity-50", !optionAvailable);
        button.disabled = !optionAvailable;
        button.setAttribute("aria-pressed", String(isActive));
        button.setAttribute("aria-disabled", String(!optionAvailable));
    });
}

function setupProductOptions() {
    const optionContainer = document.getElementById("productVariationOptions");
    if (!optionContainer) return;

    optionContainer.addEventListener("click", (event) => {
        const button = event.target.closest("[data-product-option]");
        if (!button) return;
        if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
        updateProductDetailSelection(optionContainer.dataset.productId, button.dataset.productOption);
    });
}

function rerenderDynamicSections() {
    renderProductsPage(document.getElementById("productSearch")?.value || "");
    renderHomeCategories();
    renderFeaturedProducts();
    renderFaqPage().then(() => translatePage()).catch(() => {});
    renderCategoryPage();
    renderCartPage();
    renderCheckoutSummary();
    renderPaymentPage().then(() => translatePage()).catch(() => translatePage());
    setupProductDetailPage();
}

function getProductIntro(product) {
    if (product.description) return product.description;

    const intros = {
        "Game Top-Ups": "Fast in-game credit support for eligible accounts with manual payment review.",
        "Game Keys": "Digital game keys, wallet codes, and account products delivered after checkout.",
        "AI Subscriptions": "AI subscriptions and credits handled through manual payment review.",
        "Creative & Productivity Apps": "Creative and productivity app access delivered digitally.",
        "Streaming & Entertainment": "Streaming and entertainment subscriptions delivered through WhatsApp support.",
        "Software Licenses": "Software license keys and activation products delivered digitally.",
        "Social Media Services": "Social media services handled with manual review and WhatsApp support.",
    };

    return intros[getProductCategory(product)] || "Digital product handled through Telegram checkout.";
}

function getProductDetail(product) {
    if (product.detailDescription) return product.detailDescription;
    if (product.longDescription) return product.longDescription;
    if (product.description) return product.description;

    const details = {
        "Game Top-Ups":
            "This top-up is processed after payment review. Please confirm the game, region, and account information before placing the order.",
        "Game Keys":
            "This product includes a digital key, wallet code, or game account details. Confirm platform and region compatibility before purchase.",
        "AI Subscriptions":
            "This AI product is processed manually after payment review. Delivery details are sent through WhatsApp support.",
        "Creative & Productivity Apps":
            "This digital app product is delivered after payment review. Check account and platform compatibility before purchase.",
        "Streaming & Entertainment":
            "This subscription product is delivered after manual review. Keep your Order ID and WhatsApp number for support.",
        "Software Licenses":
            "This software license product is delivered digitally. Review platform, region, and activation requirements before purchase.",
        "Social Media Services":
            "This service is reviewed manually before processing. Delivery timing can depend on the selected platform and service type.",
    };

    return details[getProductCategory(product)] || "Your digital product will be processed after Telegram checkout.";
}

function setupProductDetailPage() {
    const productPrice = document.getElementById("selectedProductPrice");
    const productIcon = document.getElementById("selectedProductIcon");
    const productImage = document.getElementById("selectedProductImage");
    const productShowcase = document.getElementById("productShowcase");
    const productCategory = document.getElementById("selectedProductCategory");
    const productTitle = document.getElementById("productPageTitle");
    const productBadge = document.getElementById("productBadge");
    const productIntro = document.getElementById("productIntro");
    const productDetailDescription = document.getElementById("productDetailDescription");
    const productStockAlert = document.getElementById("productStockAlert");
    const breadcrumbProductName = document.getElementById("breadcrumbProductName");
    const productVariationSection = document.getElementById("productVariationSection");
    const productVariationOptions = document.getElementById("productVariationOptions");
    const cartButtons = document.querySelectorAll("[data-selected-product-target]");

    if (!productPrice || !productShowcase) return;

    const params = new URLSearchParams(window.location.search);
    const requestedProductId = params.get("product") || "";
    const route = PRODUCT_ROUTES[requestedProductId] || { productId: requestedProductId };
    const activeProductId = PRODUCTS[route.productId] ? route.productId : (Object.keys(PRODUCTS)[0] || "");
    const product = PRODUCTS[activeProductId];
    if (!product) return;
    const variations = getProductVariations(product);
    const selectedVariation =
        getVariation(product, params.get("variation")) ||
        getVariation(product, route.variationId) ||
        getDefaultVariation(product);
    const productArt = product.art || "gamekey-art";
    const productIconClass = product.icon || "bi-box";
    const productImageSrc = getProductImage(product);
    const productCategoryText = getProductCategory(product);
    const inStock = isProductInStock(product);

    if (productIcon) {
        productIcon.className = `bi ${productIconClass}`;
        productIcon.classList.toggle("d-none", Boolean(productImageSrc));
    }
    if (productImage) {
        if (productImageSrc) {
            productImage.src = productImageSrc;
            productImage.alt = product.name;
        } else {
            productImage.removeAttribute("src");
            productImage.alt = "";
        }
        productImage.classList.toggle("d-none", !productImageSrc);
    }
    if (productCategory) productCategory.textContent = productCategoryText;
    if (productBadge) {
        productBadge.textContent = t(inStock ? productCategoryText : "Out of stock");
        productBadge.classList.toggle("text-bg-dark", inStock);
        productBadge.classList.toggle("text-bg-secondary", !inStock);
    }
    if (productStockAlert) {
        productStockAlert.classList.toggle("d-none", inStock);
        productStockAlert.innerHTML = inStock
            ? ""
            : `${t("Currently unavailable.")} <a class="alert-link" href="${escapeHtml(
                  getWhatsAppSupportUrl(
                      getProductAvailabilityMessage(product.name),
                  ),
              )}" target="_blank" rel="noopener">${t("Contact support")}</a>.`;
    }
    if (productIntro) productIntro.textContent = getProductIntro(product);
    if (productDetailDescription) productDetailDescription.textContent = getProductDetail(product);

    productShowcase.classList.remove(...ART_CLASSES);
    productShowcase.classList.add(productArt);
    productShowcase.classList.toggle("has-image", Boolean(productImageSrc));

    if (productVariationSection && productVariationOptions) {
        productVariationSection.classList.toggle("d-none", !variations.length);
        productVariationOptions.dataset.productId = activeProductId;
        productVariationOptions.innerHTML = variations
            .map((variation) => `
                <button
                    class="product-variation-chip"
                    type="button"
                    data-product-option="${escapeHtml(variation.id)}"
                    aria-pressed="false"
                >
                    ${escapeHtml(variation.label || variation.name || formatMoney(variation.price))}
                </button>
            `)
            .join("");
    }

    updateProductDetailSelection(activeProductId, selectedVariation?.id || "");
    translatePage();
}

function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-bs-theme", nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        const isDark = nextTheme === "dark";
        button.innerHTML = `<i class="bi ${isDark ? "bi-sun" : "bi-moon-stars"}"></i>`;
        button.setAttribute("aria-label", t(`Switch to ${isDark ? "light" : "dark"} theme`));
        button.setAttribute("title", t(`Switch to ${isDark ? "light" : "dark"} theme`));
    });
}

function setupThemeToggle() {
    const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
    const cartLinks = document.querySelectorAll('a[href="cart.html"][aria-label="Cart"]');

    cartLinks.forEach((cartLink) => {
        if (cartLink.previousElementSibling?.matches("[data-theme-toggle]")) return;

        const button = document.createElement("button");
        button.className = "btn btn-outline-dark theme-toggle";
        button.type = "button";
        button.dataset.themeToggle = "true";
        button.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-bs-theme");
            applyTheme(currentTheme === "dark" ? "light" : "dark");
        });
        cartLink.before(button);
    });

    applyTheme(savedTheme);
}

function setupOrderStatusLinks() {
    const isStatusPage = window.location.pathname.toLowerCase().endsWith("order-status.html");
    document.querySelectorAll("#mainNavbar .navbar-nav").forEach((nav) => {
        if (nav.querySelector('a[href="order-status.html"]')) return;
        const item = document.createElement("li");
        item.className = "nav-item";
        item.innerHTML = `<a class="nav-link ${isStatusPage ? "active" : ""}" ${isStatusPage ? 'aria-current="page"' : ""} href="order-status.html">Check Order</a>`;
        nav.append(item);
    });
}

function setupSupportWhatsApp() {
    if (document.querySelector(".support-whatsapp")) return;

    const link = document.createElement("a");
    link.className = "support-whatsapp";
    link.href = getWhatsAppSupportUrl();
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", "Contact HyperKey Store on WhatsApp");
    link.innerHTML = `<i class="bi bi-whatsapp"></i><span>Support</span>`;
    document.body.append(link);
}

document.addEventListener("click", (event) => {
    const copyOrderButton = event.target.closest("[data-copy-order-id]");
    if (copyOrderButton) {
        const orderId = copyOrderButton.dataset.copyOrderId || "";
        const copyPromise = navigator.clipboard?.writeText(orderId);
        if (copyPromise) {
            copyPromise.then(() => {
                copyOrderButton.textContent = "Copied";
            }).catch(() => {
                copyOrderButton.textContent = orderId;
            });
        } else {
            copyOrderButton.textContent = orderId;
        }
    }

    const copyTextButton = event.target.closest("[data-copy-text]");
    if (copyTextButton) {
        const value = copyTextButton.dataset.copyText || "";
        const copyPromise = navigator.clipboard?.writeText(value);
        if (copyPromise) {
            copyPromise.then(() => {
                copyTextButton.textContent = "Copied";
            }).catch(() => {
                copyTextButton.textContent = value;
            });
        } else {
            copyTextButton.textContent = value;
        }
    }

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
        const product = PRODUCTS[addButton.dataset.addToCart];
        if (!isProductInStock(product)) {
            event.preventDefault();
            showToast("This product is currently out of stock.");
            return;
        }
        addToCart(addButton.dataset.addToCart, addButton.dataset.productVariation || "");
    }

    const qtyButton = event.target.closest("[data-change-qty]");
    if (qtyButton) {
        changeQty(qtyButton.dataset.changeQty, Number(qtyButton.dataset.amount));
    }
});

async function initSite() {
    captureReferralFromUrl();
    await loadTranslationData();
    setupOrderStatusLinks();
    setupLanguageToggle();
    setupThemeToggle();
    setupSupportWhatsApp();
    showReferralBadge();
    await loadProductDatabase();
    updateCartCount();
    renderProductsPage();
    setupProductSearch();
    renderHomeCategories();
    renderFeaturedProducts();
    await renderFaqPage();
    renderCategoryPage();
    renderCartPage();
    renderCheckoutSummary();
    setupCheckoutForm();
    await renderPaymentPage();
    setupPaymentForm();
    setupOrderStatusPage();
    setupOrderReceivedPage();
    setupProductDetailPage();
    setupProductOptions();
    translatePage();
}

initSite();

