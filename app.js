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

const CART_KEY = "gamevault-cart";
const THEME_KEY = "gamevault-theme";
let CURRENCY = "TND";
const DATABASE_URL = "products.json";
const ORDER_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const CART_VARIATION_SEPARATOR = "::";
let checkoutSubmitting = false;
const ART_CLASSES = [...new Set(Object.values(PRODUCTS).map((product) => product.art).filter(Boolean))];
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
    return category.page || `${category.id || slugify(category.name)}.html`;
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
    };
}

function productCardTemplate(id, product) {
    const art = product.art || "gamekey-art";
    const icon = product.icon || "bi-box";
    const category = getProductCategory(product);
    const hasVariations = getProductVariations(product).length > 0;
    const priceLabel = hasVariations ? `From ${formatMoney(getProductPrice(product))}` : formatMoney(product.price ?? 0);

    return `
        <div class="col-md-6 col-xl-3">
            <article class="card product-card h-100">
                <a class="product-art ${art}" href="product.html?product=${encodeURIComponent(id)}" aria-label="View ${escapeHtml(product.name)}">
                    <i class="bi ${icon}"></i>
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
        document.title = `${category.label} | GameVault`;
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
                            <i class="bi ${line.icon}"></i>
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

function getTelegramInitData() {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
    return webApp?.initData || "";
}

function setupCheckoutForm() {
    const form = document.getElementById("checkoutForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        if (checkoutSubmitting) return;

        const cart = getCart();
        if (!Object.keys(cart).length) {
            const error = document.getElementById("checkoutError");
            if (error) {
                error.textContent = "Your cart is empty.";
                error.classList.remove("d-none");
            }
            return;
        }

        const button = document.getElementById("placeOrderButton");
        const buttonText = button?.querySelector(".order-button-text");
        const success = document.getElementById("checkoutSuccess");
        const error = document.getElementById("checkoutError");
        const checkoutRequestId = getCheckoutRequestId();
        const paymentMethod = document.getElementById("paymentMethod")?.value || "";

        checkoutSubmitting = true;
        if (button) button.disabled = true;
        if (buttonText) buttonText.textContent = "Placing order...";
        success?.classList.add("d-none");
        error?.classList.add("d-none");

        try {
            if (!ORDER_API_URL) {
                throw new Error("Checkout backend is not configured. Paste your Cloudflare Worker URL into config.js.");
            }

            const telegramInitData = getTelegramInitData();
            if (!telegramInitData) {
                throw new Error(
                    "Telegram session is missing. Open the store from your bot's Mini App button, not as a normal browser link.",
                );
            }

            const response = await fetch(ORDER_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    checkoutRequestId,
                    items: getCheckoutItems(cart),
                    paymentMethod,
                    telegramInitData,
                }),
            });

            const responseText = await response.text();
            let result = {};
            try {
                result = responseText ? JSON.parse(responseText) : {};
            } catch {
                throw new Error(
                    "Checkout backend did not return JSON. Set GAMEVAULT_ORDER_API_URL in config.js to your Cloudflare Worker URL.",
                );
            }

            if (!response.ok || !result.ok) {
                throw new Error(result.error || "Order could not be placed.");
            }

            localStorage.removeItem(CART_KEY);
            updateCartCount();
            renderCheckoutSummary();
            form.reset();
            form.classList.remove("was-validated");
            if (success) {
                success.textContent = `Order placed successfully. Order ID: ${result.orderId}. Payment status: ${result.paymentStatus || "Not verified"}.`;
                success.classList.remove("d-none");
            }
        } catch (submitError) {
            if (error) {
                error.textContent = submitError.message || "Order failed. Please try again.";
                error.classList.remove("d-none");
            }
        } finally {
            checkoutSubmitting = false;
            if (button) button.disabled = false;
            if (buttonText) buttonText.textContent = "Place digital order";
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
    document.title = `${displayName} | GameVault`;

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
    const intros = {
        "Gift card": "Redeem this digital gift card for wallet credit, games, add-ons, and platform content.",
        "Top up": "Fast in-game credit support for eligible accounts through Telegram checkout.",
        "Game key": "Activate this digital game key with the included redemption instructions.",
        Account: "Receive verified account access details and recovery guidance after checkout.",
    };

    return intros[getProductCategory(product)] || "Digital product handled through Telegram checkout.";
}

function getProductDetail(product) {
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
    const productCategoryText = getProductCategory(product);

    if (productIcon) productIcon.className = `bi ${productIconClass}`;
    if (productCategory) productCategory.textContent = productCategoryText;
    if (productBadge) productBadge.textContent = productCategoryText;
    if (productIntro) productIntro.textContent = getProductIntro(product);
    if (productDetailDescription) productDetailDescription.textContent = getProductDetail(product);

    productShowcase.classList.remove(...ART_CLASSES);
    productShowcase.classList.add(productArt);

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
    const savedTheme = localStorage.getItem(THEME_KEY) || "light";
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

function setupTelegramApp() {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready?.();
    webApp?.expand?.();
}

document.addEventListener("click", (event) => {
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
    setupTelegramApp();
    setupThemeToggle();
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
    setupProductDetailPage();
    setupProductOptions();
}

initSite();
