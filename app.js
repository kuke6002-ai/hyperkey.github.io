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
let CURRENCY = "TND";
const DATABASE_URL = "products.json";
const SETTINGS_URL = "settings.json";
const ORDER_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const SUPPORT_WHATSAPP_NUMBER = "21655159280";
const CART_VARIATION_SEPARATOR = "::";
let checkoutSubmitting = false;
let paymentSubmitting = false;
const ART_CLASSES = [...new Set(Object.values(PRODUCTS).map((product) => product.art).filter(Boolean))];
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
        throw new Error("This payment method is not available.");
    }

    if (method === "d17") {
        const amountDue = roundUpToDecimal(productTotal * (1 + Number(config.feePercent || 0) / 100), config.roundUpToDecimal ?? 1);
        return {
            method,
            label: config.label || "D17 transfer",
            instructions: config.instructions || DEFAULT_PAYMENT_SETTINGS.payment.d17.instructions,
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

    throw new Error("Choose a supported payment method.");
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
            teaser: "Digital products",
            heading: name,
            description: `Browse ${name.toLowerCase()} products.`,
        });
    });

    return [...existing.values()];
}

function getCategoryPage(category) {
    return category.page || `products.html#${category.id || `category-${slugify(category.name) || "digital"}`}`;
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
    };
}

function productCardTemplate(id, product) {
    const art = product.art || "gamekey-art";
    const icon = product.icon || "bi-box";
    const image = getProductImage(product);
    const category = getProductCategory(product);
    const hasVariations = getProductVariations(product).length > 0;
    const priceLabel = hasVariations ? `From ${formatMoney(getProductPrice(product))}` : formatMoney(product.price ?? 0);

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
                    <span class="badge text-bg-dark align-self-start mb-2">${escapeHtml(category)}</span>
                    <h2 class="h5">
                        <a class="product-title-link" href="product.html?product=${encodeURIComponent(id)}">${escapeHtml(getProductDisplayName(product))}</a>
                    </h2>
                    <p class="text-secondary flex-grow-1">${escapeHtml(getProductDescription(product))}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="price">${priceLabel}</strong>
                        <button class="btn btn-primary btn-sm" data-add-to-cart="${escapeHtml(id)}">Add</button>
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
                ${extraClass ? `<strong>${count} product${count === 1 ? "" : "s"}</strong>` : ""}
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

    categoryGrid.innerHTML = categories.map((category) => {
        const count = catalogProducts.filter(([, product]) => getProductCategory(product) === category.name).length;
        return categoryCardTemplate(category, count);
    }).join("");

    if (!productSections) return;

    productSections.innerHTML = categories.map((category) => {
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
        return line ? total + line.price * qty : total;
    }, 0);
}

function updateCartCount() {
    const cart = getCart();
    const count = Object.values(cart).reduce((total, qty) => total + qty, 0);
    document.querySelectorAll(".cart-count").forEach((item) => {
        item.textContent = count;
    });
}

function showToast() {
    const toastElement = document.getElementById("cartToast");
    if (!toastElement || !window.bootstrap) return;
    bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 1600 }).show();
}

function addToCart(id, variationId = "") {
    const product = PRODUCTS[id];
    if (!product) return;

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
                        </div>
                        <div class="cart-actions text-md-end">
                            <div class="qty-control mb-2" aria-label="Quantity controls">
                                <button type="button" data-change-qty="${cartKey}" data-amount="-1" aria-label="Decrease quantity">
                                    <i class="bi bi-dash"></i>
                                </button>
                                <strong>${qty}</strong>
                                <button type="button" data-change-qty="${cartKey}" data-amount="1" aria-label="Increase quantity">
                                    <i class="bi bi-plus"></i>
                                </button>
                            </div>
                            <p class="fw-black mb-0">${formatMoney(line.price * qty)}</p>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    const total = getCartTotal(cart);
    const subtotal = document.getElementById("cartSubtotal");
    const cartTotal = document.getElementById("cartTotal");
    if (subtotal) subtotal.textContent = formatMoney(total);
    if (cartTotal) cartTotal.textContent = formatMoney(total);
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
                        <strong>${formatMoney(line.price * qty)}</strong>
                    </div>
                `;
            })
            .join("");
    }

    const checkoutTotal = document.getElementById("checkoutTotal");
    if (checkoutTotal) checkoutTotal.textContent = formatMoney(getCartTotal(cart));
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
    element.textContent = message;
    element.classList.toggle("d-none", !message);
}

function setHtmlAlert(elementId, html = "") {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = html;
    element.classList.toggle("d-none", !html);
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
        if (buttonText) buttonText.textContent = "Opening payment...";
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
                            placeholder="Card ${index + 1} - ${codeLength} digits"
                            required
                        />
                    `,
                )
                .join("")}
        </div>
    `;
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

    const validCart = Object.fromEntries(Object.entries(session.cart || {}).filter(([cartKey, qty]) => getCartLine(cartKey) && Number(qty) > 0));
    if (!Object.keys(validCart).length) {
        if (button) button.disabled = true;
        setAlert("paymentError", "No valid products were found in this checkout session.");
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
        if (buttonText) buttonText.textContent = "Submitting...";
        setAlert("paymentSuccess", "");
        setAlert("paymentError", "");

        try {
            const validCart = Object.fromEntries(Object.entries(session.cart || {}).filter(([cartKey, qty]) => getCartLine(cartKey) && Number(qty) > 0));
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
            if (buttonText) buttonText.textContent = "Submit order for review";
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
            <div class="status-grid mb-4">
                <div>
                    <span>Payment</span>
                    <strong>${escapeHtml(order.paymentStatus)}</strong>
                </div>
                <div>
                    <span>Delivery</span>
                    <strong>${escapeHtml(order.deliveryStatus)}</strong>
                </div>
                <div>
                    <span>WhatsApp</span>
                    <strong>${escapeHtml(order.customerPhone)}</strong>
                </div>
                <div>
                    <span>Created</span>
                    <strong>${escapeHtml(createdAt)}</strong>
                </div>
            </div>
            <h3 class="h5 fw-black mb-3">Products</h3>
            ${products || '<p class="text-secondary mb-0">No products found for this order.</p>'}
            <div class="summary-line total mt-3">
                <span>Amount to verify</span>
                <strong>${formatPlainTndAmount(order.amountDue)}</strong>
            </div>
            <p class="small text-secondary mt-3 mb-0">Payment proofs and recharge card codes are hidden after submission.</p>
        </div>
    `;
    result.classList.remove("d-none");
    document.getElementById("orderStatusEmpty")?.classList.add("d-none");
}

function setupOrderStatusPage() {
    const form = document.getElementById("orderStatusForm");
    if (!form) return;

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
        if (buttonText) buttonText.textContent = "Checking...";
        setAlert("orderStatusError", "");
        document.getElementById("orderStatusResult")?.classList.add("d-none");

        try {
            const order = await fetchOrderStatus(orderId, customerPhone);
            renderOrderStatusResult(order);
        } catch (error) {
            setAlert("orderStatusError", error.message || "Could not check this order.");
        } finally {
            if (button) button.disabled = false;
            if (buttonText) buttonText.textContent = "Check order";
        }
    });
}

function updateProductDetailSelection(productId, variationId = "") {
    const product = PRODUCTS[productId];
    if (!product) return;

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
        if (variation) {
            item.dataset.productVariation = variation.id;
        } else {
            delete item.dataset.productVariation;
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
    if (productBadge) productBadge.textContent = productCategoryText;
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
}

function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-bs-theme", nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        const isDark = nextTheme === "dark";
        button.innerHTML = `<i class="bi ${isDark ? "bi-sun" : "bi-moon-stars"}"></i>`;
        button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
        button.setAttribute("title", `Switch to ${isDark ? "light" : "dark"} theme`);
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

function setupSupportWhatsApp() {
    if (document.querySelector(".support-whatsapp")) return;

    const link = document.createElement("a");
    link.className = "support-whatsapp";
    link.href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
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

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
        addToCart(addButton.dataset.addToCart, addButton.dataset.productVariation || "");
    }

    const qtyButton = event.target.closest("[data-change-qty]");
    if (qtyButton) {
        changeQty(qtyButton.dataset.changeQty, Number(qtyButton.dataset.amount));
    }
});

async function initSite() {
    setupOrderStatusLinks();
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
}

initSite();
