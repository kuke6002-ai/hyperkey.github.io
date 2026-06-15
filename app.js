// Add, edit, hide, or remove products here. Products appear on the homepage,
// Products page, detail page, cart, and checkout by default.
// Set visible: false only when you want to hide a product from listings.
// Add variations with: variations: [{ id: "small", label: "Small", price: 10 }]
// The selected variation price will update on product.html and in the cart.
const PRODUCTS = {
    "steam-wallet": {
        name: "Steam Wallet",
        category: "Gift card",
        price: 108.99,
        icon: "bi-steam",
        art: "steam-art",
        description: "Choose a Steam wallet value and receive a digital code for games and DLC.",
        defaultVariation: "steam-10",
        variations: [
            {
                id: "steam-10",
                label: "10 TND",
                name: "Steam Wallet 10 TND",
                price: 108.99,
            },
            {
                id: "steam-25",
                label: "25 TND",
                name: "Steam Wallet 25 TND",
                price: 258,
            },
            {
                id: "steam-50",
                label: "50 TND",
                name: "Steam Wallet 50 TND",
                price: 50,
            },
            {
                id: "steam-100",
                label: "100 TND",
                name: "Steam Wallet 100 TND",
                price: 100,
            },
        ],
    },
    "ss-10": {
        name: "SwdawdaND",
        category: "Gift card",
        price: 1808.8799,
        icon: "bi-steam",
        art: "steam-art",
        visible: false,
    },
    "steam-10": {
        name: "Steam Wassssllet 10 TND",
        category: "Gift card",
        price: 108.8799,
        icon: "bi-steam",
        art: "steam-art",
        visible: false,
    },
    "steam-25": {
        name: "Steam Wallwdet 25 TND",
        category: "Gift card",
        price: 258,
        icon: "bi-steam",
        art: "steam-art",
        visible: false,
    },
    "steam-50": {
        name: "Steam Wallet 50 TND",
        category: "Gift card",
        price: 50,
        icon: "bi-steam",
        art: "steam-art",
        description: "Global Steam wallet code for games and DLC.",
        visible: false,
    },
    "steam-100": {
        name: "Steam Wallet 100 TND",
        category: "Gift card",
        price: 100,
        icon: "bi-steam",
        art: "steam-art",
        visible: false,
    },
    "xbox-25": {
        name: "Xbox Gift Card 25 TND",
        category: "Gift card",
        price: 25,
        icon: "bi-xbox",
        art: "xbox-art",
        description: "Redeem for games, add-ons, movies, and subscriptions.",
    },
    "playstation-30": {
        name: "PlayStation Store 30 TND",
        category: "Gift card",
        price: 30,
        icon: "bi-playstation",
        art: "playstation-art",
        description: "Buy games, expansions, and wallet credit.",
    },
    "ml-diamonds-500": {
        name: "Mobile Legends 500 Diamonds",
        category: "Top up",
        price: 9.99,
        icon: "bi-gem",
        art: "topup-art",
        description: "Fast top up handled through Telegram order support.",
    },
    "free-fire-diamonds-100": {
        name: "Free Fire 100 Diamonds",
        category: "Top up",
        price: 3.5,
        icon: "bi-fire",
        art: "topup-art",
        description: "Free Fire 100 diamond top up handled through Telegram order support.",
        customerInput: {
            enabled: true,
            label: "Player ID",
        },
    },
    "fortnite-vbucks-1000": {
        name: "Fortnite 1,000 V-Bucks",
        category: "Top up",
        price: 7.99,
        icon: "bi-lightning-charge",
        art: "vbucks-art",
        description: "Add V-Bucks for outfits, emotes, and battle pass items.",
    },
    "valorant-2050": {
        name: "Valorant 2,050 Points",
        category: "Top up",
        price: 19.99,
        icon: "bi-crosshair",
        art: "valorant-art",
        description: "Wallet points for skins, bundles, and passes.",
    },
    "minecraft-java-key": {
        name: "Minecraft Java & Bedrock Key",
        category: "Game key",
        price: 29.99,
        icon: "bi-joystick",
        art: "gamekey-art",
        description: "Full game key with digital activation instructions.",
    },
    "starter-account": {
        name: "Starter Game Account",
        category: "Account",
        price: 39,
        icon: "bi-shield-check",
        art: "account-art",
        description: "Verified starter account with recovery guide included.",
    },
    "roblox-25": {
        name: "Roblox Gift Card 25 TND",
        category: "Gift card",
        price: 25,
        icon: "bi-box",
        art: "roblox-art",
        description: "Robux and premium credit delivered digitally.",
    },
};

const CART_KEY = "hyperkey-cart";
const CHECKOUT_SESSION_KEY = "hyperkey-checkout-session";
const THEME_KEY = "hyperkey-theme-v2";
const LANGUAGE_KEY = "hyperkey-language";
let CURRENCY = "TND";
const DATABASE_URL = "products.json";
const SETTINGS_URL = "settings.json";
const ORDER_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const SUPPORT_WHATSAPP_NUMBER = "21655159280";
const CART_VARIATION_SEPARATOR = "::";
const SUPPORTED_LANGUAGES = ["en", "fr", "ar"];
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
    payment: {
        d17: {
            enabled: true,
            label: "D17 transfer",
            instructions: "Send the shown amount by D17, then enter only the authorization number from your receipt.",
            recipientName: "",
            recipientValue: "",
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
            recipientValue: "",
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
const CATEGORIES = [
    {
        name: "Gift card",
        id: "gift-cards",
        label: "Gift Cards",
        icon: "bi-gift",
        teaser: "Steam, Xbox, PlayStation, Roblox",
        heading: "Platform wallet codes",
        description: "Digital gift cards handled through Telegram order support.",
    },
    {
        name: "Top up",
        id: "top-ups",
        label: "Top Ups",
        icon: "bi-gem",
        teaser: "Diamonds, points, V-Bucks",
        heading: "In-game credit and currency",
        description: "Top up orders handled through Telegram order support.",
    },
    {
        name: "Game key",
        id: "game-keys",
        label: "Game Keys",
        icon: "bi-joystick",
        teaser: "Activation keys and codes",
        heading: "Activation codes",
        description: "Buy game keys with redemption instructions included.",
    },
    {
        name: "Account",
        id: "accounts",
        label: "Accounts",
        icon: "bi-person-badge",
        teaser: "Verified starter accounts",
        heading: "Verified game accounts",
        description: "Starter accounts with access notes and recovery guidance.",
    },
];
const PRODUCT_ROUTES = {
    "steam-10": { productId: "steam-wallet", variationId: "steam-10" },
    "steam-25": { productId: "steam-wallet", variationId: "steam-25" },
    "steam-50": { productId: "steam-wallet", variationId: "steam-50" },
    "steam-100": { productId: "steam-wallet", variationId: "steam-100" },
};

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
    if (CURRENT_LANGUAGE === "ar") return `${count} منتج`;
    if (CURRENT_LANGUAGE === "fr") return `${count} produit${count === 1 ? "" : "s"}`;
    return `${count} product${count === 1 ? "" : "s"}`;
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
            if (element.closest("script, style, textarea, code, [data-no-i18n]")) return NodeFilter.FILTER_REJECT;
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

function translatePage() {
    document.documentElement.lang = CURRENT_LANGUAGE;
    document.documentElement.dir = CURRENT_LANGUAGE === "ar" ? "rtl" : "ltr";
    translateElement(document.body);
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
    try {
        const response = await fetch(`${DATABASE_URL}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${DATABASE_URL}`);

        const responseText = await response.text();
        let database = {};
        try {
            database = responseText ? JSON.parse(responseText) : {};
        } catch {
            throw new Error(`${DATABASE_URL} did not return JSON. Check that products.json exists on your GitHub Pages site.`);
        }

        if (database.products && typeof database.products === "object") {
            Object.keys(PRODUCTS).forEach((id) => delete PRODUCTS[id]);
            Object.assign(PRODUCTS, database.products);
        }

        if (database.currency) {
            CURRENCY = database.currency;
        }

        if (Array.isArray(database.categories)) {
            CATEGORIES.splice(0, CATEGORIES.length, ...database.categories);
        }

        if (database.routes && typeof database.routes === "object") {
            Object.keys(PRODUCT_ROUTES).forEach((id) => delete PRODUCT_ROUTES[id]);
            Object.assign(PRODUCT_ROUTES, database.routes);
        }

        refreshArtClasses();
    } catch (error) {
        console.warn("Using fallback product data:", error);
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

async function loadPaymentSettings() {
    try {
        const response = await fetch(`${SETTINGS_URL}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${SETTINGS_URL}`);
        return mergePaymentSettings(await response.json());
    } catch (error) {
        console.warn("Using fallback payment settings:", error);
        return clone(DEFAULT_PAYMENT_SETTINGS);
    }
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
    return category.page || `products.html?category=${encodeURIComponent(id)}`;
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

function getDefaultVariation(product) {
    const variations = getProductVariations(product);
    if (!variations.length) return null;
    return getVariation(product, product.defaultVariation) || variations[0];
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
    return variation?.name || product.name;
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
        inStock: isProductInStock(product),
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
        <div class="col-md-6 col-xl-3">
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
                <i class="bi ${category.icon}"></i>
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
        .map(([id, product]) => productCardTemplate(id, product))
        .join("");
    translatePage();
}

function renderHomeCategories() {
    const homeCategoryGrid = document.getElementById("homeCategoryGrid");
    if (!homeCategoryGrid) return;

    homeCategoryGrid.innerHTML = getCategories()
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

    const categoryName = document.body.dataset.category;
    const category = getCategories().find((item) => item.name === categoryName);
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
                <p class="text-secondary mb-0">Add products to this category in products.json.</p>
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

function updateCartCount() {
    const cart = getCart();
    const count = Object.values(cart).reduce((total, qty) => total + qty, 0);
    document.querySelectorAll(".cart-count").forEach((item) => {
        item.textContent = count;
    });
}

function showToast(message = "Added to cart.") {
    const toastElement = document.getElementById("cartToast");
    if (!toastElement || !window.bootstrap) return;
    const toastBody = toastElement.querySelector(".toast-body");
    if (toastBody) toastBody.textContent = t(message);
    bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 1600 }).show();
}

function addToCart(id, variationId = "") {
    const product = PRODUCTS[id];
    if (!product) return;
    if (!isProductInStock(product)) {
        showToast("This product is currently out of stock.");
        return;
    }

    const selectedVariation = variationId || getDefaultVariation(product)?.id || "";
    const cartKey = makeCartKey(id, selectedVariation);
    const cart = getCart();
    cart[cartKey] = (cart[cartKey] || 0) + 1;
    saveCart(cart);
    renderCartPage();
    renderCheckoutSummary();
    showToast();
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
        const paymentMethod = document.getElementById("paymentMethod")?.value || "";
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

    const hasRecipient = Boolean(details.recipientName || details.recipientValue || details.recipientHint);
    recipient.classList.remove("d-none");
    recipient.innerHTML = hasRecipient
        ? `
            <div class="payment-recipient-card">
                <div>
                    <span>${t("Send money to")}</span>
                    <strong>${escapeHtml(details.recipientName || details.label)}</strong>
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

        document.getElementById("paymentMethodTitle").textContent = details.label;
        document.getElementById("paymentInstructions").textContent = details.instructions;
        document.getElementById("paymentOriginalTotal").textContent = formatPlainTndAmount(productTotal);
        document.getElementById("paymentAmountDue").textContent = formatPlainTndAmount(details.amountDue);
        document.getElementById("paymentSummaryAmount").textContent = formatPlainTndAmount(details.amountDue);

        renderPaymentOrderSummary(validCart);
        renderPaymentRecipient(details);
        renderPaymentProofFields(details);
        renderPaymentGuide(details.method);
        setAlert("paymentError", "");
        return { session: { ...session, cart: validCart, items: getCheckoutItems(validCart) }, details };
    } catch (error) {
        if (button) button.disabled = true;
        setAlert("paymentError", error.message || "Could not prepare payment.");
        renderPaymentOrderSummary(validCart);
        return null;
    }
}

async function submitPaymentOrder(session) {
    const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            checkoutRequestId: session.checkoutRequestId,
            items: session.items,
            paymentMethod: session.paymentMethod,
            paymentProof: readPaymentProof(session.paymentMethod),
            customerPhone: session.customerPhone,
        }),
    });

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
    const statusUrl = `order-status.html?order=${encodeURIComponent(orderId)}`;
    setHtmlAlert(
        "paymentSuccess",
        `
            <div class="order-success-box">
                <p class="eyebrow mb-2">Order received</p>
                <p class="mb-2">Copy and save this Order ID. You will need it later to check your order status.</p>
                <div class="order-id-display">${escapeHtml(orderId)}</div>
                <div class="d-flex flex-wrap gap-2 mt-3">
                    <button class="btn btn-dark btn-sm" type="button" data-copy-order-id="${escapeHtml(orderId)}">
                        <i class="bi bi-clipboard me-1"></i>Copy Order ID
                    </button>
                    <a class="btn btn-outline-dark btn-sm" href="${escapeHtml(statusUrl)}">
                        <i class="bi bi-search me-1"></i>Check status
                    </a>
                </div>
            </div>
        `,
    );
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
    if (CURRENT_LANGUAGE === "ar") return "مرحبا HyperKey Store، أحتاج مساعدة في طلبي.";
    if (CURRENT_LANGUAGE === "fr") return "Bonjour HyperKey Store, j'ai besoin d'aide pour ma commande.";
    return "Hello HyperKey Store, I need help with my order.";
}

function getOrderSupportMessage(orderId) {
    if (CURRENT_LANGUAGE === "ar") return `مرحبا HyperKey Store، أحتاج مساعدة في الطلب ${orderId}.`;
    if (CURRENT_LANGUAGE === "fr") return `Bonjour HyperKey Store, j'ai besoin d'aide pour la commande ${orderId}.`;
    return `Hello HyperKey Store, I need help with order ${orderId}.`;
}

function getProductAvailabilityMessage(productName) {
    if (CURRENT_LANGUAGE === "ar") return `مرحبا HyperKey Store، هل ${productName} متوفر؟`;
    if (CURRENT_LANGUAGE === "fr") return `Bonjour HyperKey Store, est-ce que ${productName} est disponible ?`;
    return `Hello HyperKey Store, is ${productName} available?`;
}

function getWhatsAppSupportUrl(message = "") {
    const text = message || getDefaultSupportMessage();
    return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function getOrderTimelineSteps(order) {
    const paymentStatus = String(order.paymentStatusCode || "").toLowerCase();
    const deliveryStatus = String(order.deliveryStatusCode || "").toLowerCase();
    const paymentVerified = paymentStatus === "verified";
    const paymentRejected = paymentStatus === "rejected";
    const delivered = deliveryStatus === "delivered";
    const cancelled = deliveryStatus === "cancelled";

    return [
        {
            label: "Order received",
            status: "complete",
        },
        {
            label: paymentRejected ? "Payment rejected" : "Payment review",
            status: paymentRejected ? "bad" : paymentVerified ? "complete" : "current",
        },
        {
            label: "Payment verified",
            status: paymentVerified ? "complete" : "waiting",
        },
        {
            label: cancelled ? "Delivery cancelled" : "Delivery waiting",
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

function getDeliveryLines(order) {
    return (order.deliveries || []).flatMap((delivery) => (Array.isArray(delivery.lines) ? delivery.lines : []));
}

function renderDeliveryCodes(order) {
    const lines = getDeliveryLines(order);
    if (!lines.length) return "";

    return `
        <div class="order-delivery-box mt-4">
            <div class="d-flex align-items-center gap-2 mb-3">
                <i class="bi bi-key"></i>
                <h3 class="h5 fw-black mb-0">${t("Delivery details")}</h3>
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
    const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("en-TN") : "Not available";
    const supportUrl = getWhatsAppSupportUrl(getOrderSupportMessage(order.id));

    result.innerHTML = `
        <div class="content-panel order-status-card">
            <div class="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
                <div>
                    <p class="eyebrow mb-2">Order status</p>
                    <h2 class="h3 fw-black mb-0">${escapeHtml(order.id)}</h2>
                </div>
                <button class="btn btn-outline-dark align-self-start" type="button" data-copy-order-id="${escapeHtml(order.id)}">
                    <i class="bi bi-clipboard me-1"></i>Copy
                </button>
            </div>
            ${renderOrderTimeline(order)}
            <div class="status-grid mb-4">
                <div>
                    <span>WhatsApp</span>
                    <strong>${escapeHtml(order.customerPhone)}</strong>
                </div>
                <div>
                    <span>Created</span>
                    <strong>${escapeHtml(createdAt)}</strong>
                </div>
            </div>
            <h3 class="h5 fw-black mb-3">${t("Products")}</h3>
            ${products || '<p class="text-secondary mb-0">No products found for this order.</p>'}
            <div class="summary-line total mt-3">
                <span>Amount to verify</span>
                <strong>${formatPlainTndAmount(order.amountDue)}</strong>
            </div>
            ${renderDeliveryCodes(order)}
            ${renderCustomerInputForm(order)}
            <a class="btn btn-outline-dark w-100 mt-4" href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener">
                <i class="bi bi-whatsapp me-2"></i>${t("Contact support about this order")}
            </a>
            <p class="small text-secondary mt-3 mb-0">${t("Payment proofs and recharge card codes are hidden after submission.")}</p>
        </div>
    `;
    result.classList.remove("d-none");
    document.getElementById("orderStatusEmpty")?.classList.add("d-none");
    translatePage();
}

function setupOrderStatusPage() {
    const form = document.getElementById("orderStatusForm");
    if (!form) return;

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

    const params = new URLSearchParams(window.location.search);
    const orderInput = document.getElementById("statusOrderId");
    if (orderInput && params.get("order")) {
        orderInput.value = params.get("order").toUpperCase();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const orderId = document.getElementById("statusOrderId")?.value.trim().toUpperCase() || "";
        const customerPhone = normalizeTunisianPhoneInput(document.getElementById("statusCustomerPhone")?.value || "");
        const button = document.getElementById("checkOrderButton");
        const buttonText = button?.querySelector(".check-order-button-text");

        if (!customerPhone) {
            setAlert("orderStatusError", "Enter the same Tunisian WhatsApp number used at checkout.");
            return;
        }

        if (button) button.disabled = true;
        if (buttonText) buttonText.textContent = t("Checking...");
        setAlert("orderStatusError", "");
        document.getElementById("orderStatusResult")?.classList.add("d-none");

        try {
            const order = await fetchOrderStatus(orderId, customerPhone);
            renderOrderStatusResult(order);
        } catch (error) {
            setAlert("orderStatusError", error.message || "Could not check this order.");
        } finally {
            if (button) button.disabled = false;
            if (buttonText) buttonText.textContent = t("Check order");
        }
    });
}

function updateProductDetailSelection(productId, variationId = "") {
    const product = PRODUCTS[productId];
    if (!product) return;

    const inStock = isProductInStock(product);
    const variation = getVariation(product, variationId) || getDefaultVariation(product);
    const displayName = getVariationName(product, variation);
    const displayPrice = variation?.price ?? product.price ?? 0;
    const priceElement = document.getElementById("selectedProductPrice");
    const titleElement = document.getElementById("selectedProductName");
    const pageTitleElement = document.getElementById("productPageTitle");
    const breadcrumbElement = document.getElementById("breadcrumbProductName");
    const cartButtons = document.querySelectorAll("[data-selected-product-target]");

    if (priceElement) priceElement.textContent = formatMoney(displayPrice);
    if (titleElement) titleElement.textContent = displayName;
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
        const isActive = variation && button.dataset.productOption === variation.id;
        button.classList.toggle("btn-dark", isActive);
        button.classList.toggle("btn-outline-dark", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function setupProductOptions() {
    const optionContainer = document.getElementById("productVariationOptions");
    if (!optionContainer) return;

    optionContainer.addEventListener("click", (event) => {
        const button = event.target.closest("[data-product-option]");
        if (!button) return;
        updateProductDetailSelection(optionContainer.dataset.productId, button.dataset.productOption);
    });
}

function rerenderDynamicSections() {
    renderProductsPage(document.getElementById("productSearch")?.value || "");
    renderHomeCategories();
    renderFeaturedProducts();
    renderCategoryPage();
    renderCartPage();
    renderCheckoutSummary();
    renderPaymentPage().then(() => translatePage()).catch(() => translatePage());
    setupProductDetailPage();
}

function getProductIntro(product) {
    if (product.description) return product.description;

    const intros = {
        "Gift card": "Redeem this digital gift card for wallet credit, games, add-ons, and platform content.",
        "Top up": "Fast in-game credit support for eligible accounts through Telegram checkout.",
        "Game key": "Activate this digital game key with the included redemption instructions.",
        Account: "Receive verified account access details and recovery guidance after checkout.",
    };

    return intros[getProductCategory(product)] || "Digital product handled through Telegram checkout.";
}

function getProductDetail(product) {
    if (product.detailDescription) return product.detailDescription;
    if (product.longDescription) return product.longDescription;
    if (product.description) return product.description;

    const details = {
        "Gift card":
            "This digital wallet code is ideal for gamers who want quick account credit without waiting for physical delivery. Confirm your account region before purchase because digital codes may have region limitations.",
        "Top up":
            "This top up is processed after the order is reviewed. Please confirm the product region and platform before placing the order.",
        "Game key":
            "This product includes a digital activation key and redemption steps. Make sure your platform account meets the region and age requirements before purchase.",
        Account:
            "This account product includes access details and a recovery guide. Change credentials after receiving access and review all account notes before using it.",
    };

    return details[getProductCategory(product)] || "Your digital product will be processed after Telegram checkout.";
}

function setupProductDetailPage() {
    const productName = document.getElementById("selectedProductName");
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

    if (!productName || !productPrice || !productShowcase) return;

    const params = new URLSearchParams(window.location.search);
    const requestedProductId = params.get("product") || "steam-wallet";
    const route = PRODUCT_ROUTES[requestedProductId] || { productId: requestedProductId };
    const activeProductId = PRODUCTS[route.productId] ? route.productId : "steam-wallet";
    const product = PRODUCTS[activeProductId] || PRODUCTS["steam-wallet"];
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
                    class="btn btn-outline-dark"
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

    document.querySelectorAll(".site-footer .d-flex").forEach((footer) => {
        if (footer.querySelector('a[href="order-status.html"]')) return;
        const link = document.createElement("a");
        link.href = "order-status.html";
        link.textContent = "Check order status";
        footer.append(link);
    });
}

function setupFooterUtilityLinks() {
    document.querySelectorAll(".site-footer .d-flex").forEach((footer) => {
        [
            ["payment-guide.html", "Payment guide"],
            ["terms.html", "Terms"],
        ].forEach(([href, label]) => {
            if (footer.querySelector(`a[href="${href}"]`)) return;
            const link = document.createElement("a");
            link.href = href;
            link.textContent = label;
            footer.append(link);
        });
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
    await loadTranslationData();
    setupOrderStatusLinks();
    setupFooterUtilityLinks();
    setupLanguageToggle();
    setupThemeToggle();
    setupSupportWhatsApp();
    await loadProductDatabase();
    updateCartCount();
    renderProductsPage();
    setupProductSearch();
    renderHomeCategories();
    renderFeaturedProducts();
    renderCategoryPage();
    renderCartPage();
    renderCheckoutSummary();
    setupCheckoutForm();
    await renderPaymentPage();
    setupPaymentForm();
    setupOrderStatusPage();
    setupProductDetailPage();
    setupProductOptions();
    translatePage();
}

initSite();
