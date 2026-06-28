const ART_STYLES = [
    "steam-art",
    "xbox-art",
    "playstation-art",
    "topup-art",
    "vbucks-art",
    "valorant-art",
    "gamekey-art",
    "account-art",
    "roblox-art",
];

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

const ADMIN_TOKEN_KEY = "hyperkey-admin-token";
const ORDER_API_URL = window.GAMEVAULT_ORDER_API_URL || "";

let lastProductNameSlug = "";

const state = {
    database: {
        currency: "TND",
        categories: [],
        routes: {},
        products: {},
    },
    settings: clone(DEFAULT_PAYMENT_SETTINGS),
    selectedId: "",
    originalId: "",
    draftVariations: [],
    draftCustomerInputs: [],
    previewImages: {},
    productFilters: {
        search: "",
        category: "",
        status: "",
    },
    hasUnsavedChanges: false,
    orders: [],
    orderFilters: {
        search: "",
        payment: "",
        delivery: "",
        workflow: "",
        dateFrom: "",
        dateTo: "",
    },
};

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function renderCustomerInputs() {
    const container = document.getElementById("productCustomerInputs");
    if (!container) return;
    container.innerHTML = state.draftCustomerInputs.length
        ? state.draftCustomerInputs
              .map((label, index) => `
                <div class="d-flex gap-2" data-customer-input-index="${index}">
                    <input class="form-control form-control-sm" data-customer-input-field="label" value="${escapeHtml(label)}" />
                    <button class="btn btn-outline-danger btn-sm" type="button" data-remove-customer-input="${index}">Remove</button>
                </div>
            `)
              .join("")
        : `<div class="text-secondary small">No customer inputs added.</div>`;
}

function addCustomerInput(label) {
    const value = String(label || document.getElementById("productCustomerNewInput")?.value || "").trim();
    if (!value) return;
    state.draftCustomerInputs.push(value.slice(0, 80));
    const inputEl = document.getElementById("productCustomerNewInput");
    if (inputEl) inputEl.value = "";
    renderCustomerInputs();
    renderPreview();
    markProductDirty();
}

function removeCustomerInput(index) {
    state.draftCustomerInputs.splice(index, 1);
    renderCustomerInputs();
    renderPreview();
    markProductDirty();
}

function safeAssetFileName(fileName) {
    const extension = String(fileName || "").split(".").pop()?.toLowerCase() || "png";
    const baseName = String(fileName || "product-photo").replace(/\.[^.]+$/, "");
    return `${slugify(baseName) || "product-photo"}.${extension.replace(/[^a-z0-9]/g, "") || "png"}`;
}

function money(amount, currency = "TND") {
    return new Intl.NumberFormat("en-TN", {
        style: "currency",
        currency,
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

function formatAdminDateTime(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";
    return new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    })
        .format(date)
        .replace(",", "");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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

    return merged;
}

function getProducts() {
    return state.database.products || {};
}

function getCategories() {
    return Array.isArray(state.database.categories) ? state.database.categories : [];
}

function getUniqueCategoryName(baseName = "New category") {
    const existing = new Set(getCategories().map((category) => String(category.name || "").toLowerCase()));
    let name = baseName;
    let counter = 2;
    while (existing.has(name.toLowerCase())) {
        name = `${baseName} ${counter}`;
        counter += 1;
    }
    return name;
}

function getProductEntries() {
    return Object.entries(getProducts()).sort(([, a], [, b]) => String(a.name || "").localeCompare(String(b.name || "")));
}

function getSelectedProduct() {
    return getProducts()[state.selectedId] || null;
}

function showToast(message) {
    const toastElement = document.getElementById("adminToast");
    const messageElement = document.getElementById("adminToastMessage");
    if (messageElement) messageElement.textContent = message;
    if (toastElement && window.bootstrap) bootstrap.Toast.getOrCreateInstance(toastElement).show();
}

function setUnsavedChanges(isDirty) {
    state.hasUnsavedChanges = Boolean(isDirty);
    const indicator = document.getElementById("adminUnsavedIndicator");
    if (!indicator) return;
    indicator.classList.toggle("is-dirty", state.hasUnsavedChanges);
    indicator.innerHTML = `<span></span>${state.hasUnsavedChanges ? "Unsaved changes" : "Saved"}`;
}

function updateEditorSectionBadges() {}
function markProductDirty() {
    setUnsavedChanges(true);
}

function isAdminMobileViewport() {
    return window.matchMedia("(max-width: 767.98px)").matches;
}

function syncMobileEditorSections() {
    if (!isAdminMobileViewport()) return;
    const sections = [...document.querySelectorAll(".admin-editor-details")];
    sections.forEach((section) => {
        section.open = false;
    });
    if (sections[0]) sections[0].open = true;
}

function syncResponsiveAdminLayout() {}

function closeMobileProductCatalog() {
    const catalog = document.getElementById("mobileProductCatalogSheet");
    if (!catalog || !window.bootstrap) return;
    bootstrap.Offcanvas.getInstance(catalog)?.hide();
}

function setDatabase(database) {
    // migrate older product/category shapes to include `photo` / `image` fields
    function migrateDatabase(db) {
        if (!db) return db;
        if (Array.isArray(db.categories)) {
            db.categories.forEach((cat) => {
                if (!cat.photo) {
                    if (cat.icon && typeof cat.icon === "string") {
                        // keep icon for backward compatibility but set a placeholder photo path
                        cat.photo = "assets/hyperlogo.png";
                    } else {
                        cat.photo = "assets/hyperlogo.png";
                    }
                }
            });
        }

        if (db.products && typeof db.products === "object") {
            Object.values(db.products).forEach((product) => {
                if (!product) return;
                if (!product.image) {
                    if (product.icon && typeof product.icon === "string") {
                        // no direct mapping from icon -> image file, use default placeholder
                        product.image = "assets/hyperlogo.png";
                    } else {
                        product.image = "assets/hyperlogo.png";
                    }
                }
            });
        }

        return db;
    }

    const migrated = migrateDatabase(clone(database));
    state.database = {
        currency: migrated.currency || "TND",
        categories: Array.isArray(migrated.categories) ? migrated.categories : [],
        routes: migrated.routes && typeof migrated.routes === "object" ? migrated.routes : {},
        products: migrated.products && typeof migrated.products === "object" ? migrated.products : {},
    };

    const firstProduct = Object.keys(state.database.products)[0] || "";
    selectProduct(firstProduct);
    renderAll();
}

async function loadDatabase() {
    const apiUrl = CATALOG_API_URL ? `${CATALOG_API_URL}/data` : "";
    if (apiUrl) {
        try {
            const database = await adminGetRequest(apiUrl);
            setDatabase(database);
            showToast("Loaded products from database");
            return;
        } catch (error) {
            console.warn("Could not load from API:", error.message);
        }
    }

    renderAll();
    if (!apiUrl) {
        showToast("Configure GAMEVAULT_ORDER_API_URL in config.js to connect to the database");
    } else {
        showToast("Could not load products from API. Make sure the Worker is running.");
    }
}

function setSettings(settings) {
    state.settings = mergePaymentSettings(settings);
    fillSettingsForm();
}

async function loadSettings() {
    const apiUrl = CATALOG_API_URL ? `${CATALOG_API_URL}/settings` : "";
    if (apiUrl) {
        try {
            const settings = await adminGetRequest(apiUrl);
            if (settings && typeof settings === "object" && Object.keys(settings).length) {
                setSettings(settings);
                showToast("Loaded settings from database");
                return;
            }
        } catch (error) {
            console.warn("Could not load settings from API:", error.message);
        }
    }

    setSettings(DEFAULT_PAYMENT_SETTINGS);
    showToast("Could not load settings from API. Using defaults.");
}

function renderAll() {
    renderCategoryEditor();
    renderCategoryOptions();
    renderProductPicker();
    renderProductList();
    fillForm();
    updateJsonOutput();
}

function renderCategoryEditor() {
    const list = document.getElementById("categoryEditorList");
    if (!list) return;

    const categories = getCategories();
    list.innerHTML = categories.length
        ? categories
              .map(
                  (category, index) => {
                      const productCount = Object.values(getProducts()).filter((product) => product.category === category.name).length;
                      const visible = category.visible !== false;
                      return `
                    <details class="admin-category-row" data-category-index="${index}">
                        <summary>
                            <span>
                                <strong>${escapeHtml(category.label || category.name || `Category ${index + 1}`)}</strong>
                                <small>${escapeHtml(adminCountLabel(productCount, "product"))} &middot; ${visible ? "Visible" : "Hidden"} &middot; ${escapeHtml(category.page || "No page")}</small>
                            </span>
                            <i class="bi bi-chevron-down"></i>
                        </summary>
                        <div class="admin-category-body">
                            <div class="admin-category-actions mb-3">
                                <button class="btn btn-outline-dark btn-sm" type="button" data-move-category="${index}" data-category-direction="-1" ${index === 0 ? "disabled" : ""}>
                                    <i class="bi bi-arrow-up me-1"></i>Up
                                </button>
                                <button class="btn btn-outline-dark btn-sm" type="button" data-move-category="${index}" data-category-direction="1" ${index === categories.length - 1 ? "disabled" : ""}>
                                    <i class="bi bi-arrow-down me-1"></i>Down
                                </button>
                                <button class="btn btn-outline-danger btn-sm" type="button" data-remove-category="${index}" aria-label="Remove category">
                                    <i class="bi bi-trash me-1"></i>Remove
                                </button>
                            </div>
                            <div class="row g-2">
                            <div class="col-6">
                                <label class="form-label">Name</label>
                                <input class="form-control form-control-sm" data-category-field="name" value="${escapeHtml(category.name || "")}" />
                            </div>
                            <div class="col-6">
                                <label class="form-label">Label</label>
                                <input class="form-control form-control-sm" data-category-field="label" value="${escapeHtml(category.label || "")}" />
                            </div>
                            <div class="col-7">
                                <label class="form-label">Page</label>
                                <input class="form-control form-control-sm" data-category-field="page" value="${escapeHtml(category.page || "")}" />
                            </div>
                            <div class="col-5">
                                <label class="form-label">Photo path</label>
                                <input class="form-control form-control-sm" data-category-field="photo" value="${escapeHtml(category.photo || "assets/hyperlogo.png")}" />
                            </div>
                            <div class="col-12">
                                <div class="form-check form-switch admin-switch">
                                    <input class="form-check-input" type="checkbox" data-category-field="visible" ${visible ? "checked" : ""} />
                                    <label class="form-check-label">Visible in store navigation</label>
                                </div>
                            </div>
                            <div class="col-12">
                                <label class="form-label">Teaser</label>
                                <input class="form-control form-control-sm" data-category-field="teaser" value="${escapeHtml(category.teaser || "")}" />
                            </div>
                            <div class="col-12">
                                <label class="form-label">Heading</label>
                                <input class="form-control form-control-sm" data-category-field="heading" value="${escapeHtml(category.heading || "")}" />
                            </div>
                            <div class="col-12">
                                <label class="form-label">Description</label>
                                <textarea class="form-control form-control-sm" rows="2" data-category-field="description">${escapeHtml(category.description || "")}</textarea>
                            </div>
                        </div>
                        </div>
                    </details>
                `;
                  },
              )
              .join("")
        : `<div class="empty-state py-3"><p class="text-secondary mb-0">No categories yet.</p></div>`;
}

function renderCategoryOptions() {
    const categorySelect = document.getElementById("productCategory");
    const categoryFilter = document.getElementById("productCategoryFilter");
    const mobileCategoryFilter = document.getElementById("mobileCatalogCategoryFilter");
    const categories = getCategories();
    const categoryOptions = categories
        .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.label || category.name)}</option>`)
        .join("");

    if (categorySelect) {
        const currentValue = categorySelect.value;
        categorySelect.innerHTML = categories.length ? categoryOptions : `<option value="">Add a category first</option>`;
        categorySelect.value = currentValue || categorySelect.options[0]?.value || "";
    }

    if (categoryFilter) {
        const currentFilter = state.productFilters.category || categoryFilter.value;
        categoryFilter.innerHTML = `<option value="">All categories</option>${categoryOptions}`;
        categoryFilter.value = categories.some((category) => category.name === currentFilter) ? currentFilter : "";
        state.productFilters.category = categoryFilter.value;
    }

    if (mobileCategoryFilter) {
        mobileCategoryFilter.innerHTML = `<option value="">All categories</option>${categoryOptions}`;
        mobileCategoryFilter.value = state.productFilters.category || "";
    }
}

// art options removed from admin editor

function renderProductPicker() {
    const picker = document.getElementById("mobileProductSelect");
    if (!picker) return;

    const entries = getProductEntries();
    picker.innerHTML = entries.length
        ? entries
              .map(([id, product]) => `<option value="${escapeHtml(id)}">${escapeHtml(product.name || id)}</option>`)
              .join("")
        : `<option value="">No products yet</option>`;
    picker.value = state.selectedId || entries[0]?.[0] || "";
}

function getProductFiltersFromControls(scope = "desktop") {
    const ids =
        scope === "mobile"
            ? {
                  search: "mobileCatalogSearch",
                  category: "mobileCatalogCategoryFilter",
                  status: "mobileCatalogStatusFilter",
              }
            : {
                  search: "productSearch",
                  category: "productCategoryFilter",
                  status: "productStatusFilter",
              };

    return {
        search: document.getElementById(ids.search)?.value.trim().toLowerCase() || "",
        category: document.getElementById(ids.category)?.value || "",
        status: document.getElementById(ids.status)?.value || "",
    };
}

function syncProductFilterControls(exceptScope = "") {
    const controls = {
        desktop: {
            search: document.getElementById("productSearch"),
            category: document.getElementById("productCategoryFilter"),
            status: document.getElementById("productStatusFilter"),
        },
        mobile: {
            search: document.getElementById("mobileCatalogSearch"),
            category: document.getElementById("mobileCatalogCategoryFilter"),
            status: document.getElementById("mobileCatalogStatusFilter"),
        },
    };

    Object.entries(controls).forEach(([scope, inputs]) => {
        if (scope === exceptScope) return;
        if (inputs.search) inputs.search.value = state.productFilters.search || "";
        if (inputs.category) inputs.category.value = state.productFilters.category || "";
        if (inputs.status) inputs.status.value = state.productFilters.status || "";
    });
}

function updateProductFiltersFromControls(scope) {
    state.productFilters = getProductFiltersFromControls(scope);
    syncProductFilterControls(scope);
    renderProductList();
}

function getFilteredProductEntries() {
    return getProductEntries().filter(([id, product]) => {
        const haystack = `${id} ${product.name || ""} ${product.category || ""}`.toLowerCase();
        if (!haystack.includes(state.productFilters.search)) return false;
        if (state.productFilters.category && product.category !== state.productFilters.category) return false;

        if (state.productFilters.status === "visible" && product.visible === false) return false;
        if (state.productFilters.status === "hidden" && product.visible !== false) return false;
        if (state.productFilters.status === "in-stock" && product.inStock === false) return false;
        if (state.productFilters.status === "out-of-stock" && product.inStock !== false) return false;
        if (state.productFilters.status === "needs-input" && product.customerInput?.enabled !== true) return false;

        return true;
    });
}

function getProductAdminStatus(product) {
    if (product.visible === false) {
        return {
            label: "Hidden",
            tone: "hidden",
        };
    }
    if (product.inStock === false) {
        return {
            label: "Draft",
            tone: "draft",
        };
    }
    return {
        label: "Published",
        tone: "published",
    };
}

function renderMobileProductList(entries) {
    const list = document.getElementById("mobileProductList");
    const resultCount = document.getElementById("mobileCatalogResultCount");
    if (!list) return;

    if (resultCount) resultCount.textContent = `${entries.length} product${entries.length === 1 ? "" : "s"} shown`;

    list.innerHTML = entries.length
        ? entries
              .map(([id, product]) => {
                  const variationCount = Array.isArray(product.variations) ? product.variations.length : 0;
                  const status = getProductAdminStatus(product);
                  return `
                    <div class="admin-mobile-product-row ${id === state.selectedId ? "active" : ""}">
                        <button class="admin-mobile-product-main" type="button" data-select-mobile-product="${escapeHtml(id)}">
                            <span>
                                <strong>${escapeHtml(product.name || id)}</strong>
                                <small>${escapeHtml(product.category || "Digital")}</small>
                            </span>
                            <span class="admin-mobile-product-meta">
                                <em>${variationCount ? `${variationCount} option${variationCount === 1 ? "" : "s"}` : "No options"}</em>
                                <b class="admin-mobile-product-status status-${status.tone}">${status.label}</b>
                            </span>
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-outline-dark btn-sm admin-row-menu" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Product actions for ${escapeHtml(product.name || id)}">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                                <li><button class="dropdown-item" type="button" data-mobile-product-action="duplicate" data-product-action-id="${escapeHtml(id)}"><i class="bi bi-copy me-2"></i>Duplicate</button></li>
                                <li><button class="dropdown-item" type="button" data-mobile-product-action="toggle-visibility" data-product-action-id="${escapeHtml(id)}"><i class="bi ${product.visible === false ? "bi-eye" : "bi-eye-slash"} me-2"></i>${product.visible === false ? "Publish" : "Hide"}</button></li>
                                <li><hr class="dropdown-divider" /></li>
                                <li><button class="dropdown-item text-danger" type="button" data-mobile-product-action="delete" data-product-action-id="${escapeHtml(id)}"><i class="bi bi-trash me-2"></i>Delete</button></li>
                            </ul>
                        </div>
                    </div>
                `;
              })
              .join("")
        : `<div class="empty-state py-4"><p class="text-secondary mb-0">No products found.</p></div>`;
}

function renderProductList() {
    const list = document.getElementById("productList");
    syncProductFilterControls();

    const entries = getFilteredProductEntries();
    const totalEntries = getProductEntries().length;
    const mobileCatalogCount = document.getElementById("mobileProductCatalogCount");
    if (mobileCatalogCount) mobileCatalogCount.textContent = `Products (${totalEntries})`;

    const count = document.getElementById("productListCount");
    if (count) count.textContent = `${entries.length} product${entries.length === 1 ? "" : "s"}`;

    renderMobileProductList(entries);
    if (!list) return;

    list.innerHTML = entries.length
        ? entries
              .map(([id, product]) => {
                  const isActive = id === state.selectedId;
                  const hidden = product.visible === false;
                  const outOfStock = product.inStock === false;
                  const variationCount = Array.isArray(product.variations) ? product.variations.length : 0;
                  const needsInput = product.customerInput?.enabled === true;
                  return `
                    <button class="admin-product-item ${isActive ? "active" : ""}" type="button" data-select-product="${escapeHtml(id)}">
                        <span>
                            <strong>${escapeHtml(product.name || id)}</strong>
                            <small>${escapeHtml(id)} &middot; ${escapeHtml(product.category || "Digital")}</small>
                        </span>
                        <span class="admin-item-meta">
                            ${variationCount ? `<em>${variationCount} options</em>` : `<em>${money(product.price, state.database.currency)}</em>`}
                            ${needsInput ? '<i class="bi bi-input-cursor-text" title="Customer input required"></i>' : ""}
                            ${outOfStock ? '<i class="bi bi-slash-circle" title="Out of stock"></i>' : '<i class="bi bi-check-circle" title="Available"></i>'}
                            ${hidden ? '<i class="bi bi-eye-slash" title="Hidden"></i>' : '<i class="bi bi-eye" title="Visible"></i>'}
                        </span>
                    </button>
                `;
              })
              .join("")
        : `<div class="empty-state py-4"><p class="text-secondary mb-0">No products found.</p></div>`;
}

function selectProduct(id) {
    state.selectedId = id;
    state.originalId = id;
    const product = getSelectedProduct();
    state.draftVariations = Array.isArray(product?.variations) ? clone(product.variations) : [];
    renderProductPicker();
}

function fillForm() {
    const product = getSelectedProduct();
    const isNew = !product;
    lastProductNameSlug = slugify(product?.name || "");
    document.getElementById("editorTitle").textContent = isNew ? "New product" : product.name || state.selectedId;

    const productId = document.getElementById("productId");
    const productName = document.getElementById("productName");
    const productCategory = document.getElementById("productCategory");
    const productPrice = document.getElementById("productPrice");
    const productImage = document.getElementById("productImage");
    const productPhotoFile = document.getElementById("productPhotoFile");
    const productDescription = document.getElementById("productDescription");
    const productVisible = document.getElementById("productVisible");
    const productInStock = document.getElementById("productInStock");
    const productCustomerInputEnabled = document.getElementById("productCustomerInputEnabled");

    if (productId) productId.value = state.selectedId || "";
    if (productName) productName.value = product?.name || "";
    if (productCategory) productCategory.value = product?.category || productCategory.options[0]?.value || "";
    if (productPrice) productPrice.value = Number(product?.price ?? 0);
    if (productImage) productImage.value = product?.image || "assets/hyperlogo.png";
    if (productPhotoFile) productPhotoFile.value = "";
    if (productDescription) productDescription.value = product?.description || "";
    if (productVisible) productVisible.checked = product?.visible !== false;
    if (productInStock) productInStock.checked = product?.inStock !== false;
    if (productCustomerInputEnabled) productCustomerInputEnabled.checked = product?.customerInput?.enabled === true;

    state.draftCustomerInputs = [];
    if (product?.customerInput) {
        if (Array.isArray(product.customerInput.labels)) state.draftCustomerInputs = clone(product.customerInput.labels);
        else if (product.customerInput.label) state.draftCustomerInputs = [product.customerInput.label];
    }
    renderCustomerInputs();

    renderVariations();
    renderPreview();
    updateImagePreview();
    updateEditorSectionBadges();
    syncMobileEditorSections();
    setUnsavedChanges(false);
}

function renderVariations() {
    const list = document.getElementById("variationList");
    const defaultVariation = document.getElementById("defaultVariation");
    const selectedProduct = getSelectedProduct();
    if (!list || !defaultVariation) return;

    list.innerHTML = state.draftVariations.length
        ? state.draftVariations
              .map(
                  (variation, index) => `
                    <div class="admin-variation-row" data-variation-index="${index}">
                        <div>
                            <label class="form-label">ID</label>
                            <input class="form-control form-control-sm" data-variation-field="id" value="${escapeHtml(variation.id || "")}" />
                        </div>
                        <div>
                            <label class="form-label">Label</label>
                            <input class="form-control form-control-sm" data-variation-field="label" value="${escapeHtml(variation.label || "")}" />
                        </div>
                        <div>
                            <label class="form-label">Name</label>
                            <input class="form-control form-control-sm" data-variation-field="name" value="${escapeHtml(variation.name || "")}" />
                        </div>
                        <div>
                            <label class="form-label">Price</label>
                            <input class="form-control form-control-sm" data-variation-field="price" type="number" min="0" step="0.001" value="${Number(variation.price ?? 0)}" />
                        </div>
                        <button class="btn btn-outline-danger btn-sm" type="button" data-remove-variation="${index}"><i class="bi bi-x-lg"></i></button>
                    </div>
                `,
              )
              .join("")
        : `<div class="empty-state py-3"><p class="text-secondary mb-0">No variations for this product.</p></div>`;

    defaultVariation.innerHTML = `<option value="">None</option>${state.draftVariations
        .map((variation) => `<option value="${escapeHtml(variation.id || "")}">${escapeHtml(variation.label || variation.name || variation.id || "Option")}</option>`)
        .join("")}`;
    defaultVariation.value = selectedProduct?.defaultVariation || state.draftVariations[0]?.id || "";
    updateEditorSectionBadges();
}

function readFormProduct() {
    validateCategories();

    const id = document.getElementById("productId").value.trim();
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const price = Number(document.getElementById("productPrice").value || 0);
    const image = document.getElementById("productImage").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const visible = document.getElementById("productVisible").checked;
    const inStock = document.getElementById("productInStock")?.checked !== false;
    const defaultVariation = document.getElementById("defaultVariation").value;
    const customerInputEnabled = document.getElementById("productCustomerInputEnabled")?.checked || false;

    if (!id) throw new Error("Product ID is required");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("Product ID must use lowercase letters, numbers, and hyphens");
    if (!name) throw new Error("Product name is required");
    if (!category) throw new Error("Choose or add a category");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price must be zero or more");
    if (id !== state.originalId && getProducts()[id]) throw new Error("Product ID already exists");

    const product = {
        name,
        category,
        price,
    };
    if (image) product.image = image;
    else if (!state.originalId) product.image = "assets/hyperlogo.png";
    if (description) product.description = description;
    if (!visible) product.visible = false;
    if (!inStock) product.inStock = false;
    if (customerInputEnabled) {
        const labels = (state.draftCustomerInputs || []).map((l) => String(l || "").slice(0, 80)).filter(Boolean);
        if (labels.length === 1) {
            product.customerInput = { enabled: true, label: labels[0] };
        } else if (labels.length > 1) {
            product.customerInput = { enabled: true, labels };
        }
    }

    const variations = state.draftVariations
        .map((variation) => ({
            id: String(variation.id || "").trim(),
            label: String(variation.label || "").trim(),
            name: String(variation.name || "").trim(),
            price: Number(variation.price || 0),
        }))
        .filter((variation) => variation.id || variation.label || variation.name);

    const seenVariationIds = new Set();
    variations.forEach((variation, index) => {
        if (!variation.id) variation.id = slugify(variation.label || variation.name || `option-${index + 1}`);
        if (!/^[a-z0-9][a-z0-9-]*$/.test(variation.id)) throw new Error(`Variation ID is invalid: ${variation.id}`);
        if (seenVariationIds.has(variation.id)) throw new Error(`Duplicate variation ID: ${variation.id}`);
        if (!Number.isFinite(variation.price) || variation.price < 0) throw new Error(`Variation price is invalid: ${variation.id}`);
        seenVariationIds.add(variation.id);
    });

    if (variations.length) {
        product.variations = variations;
        product.defaultVariation = defaultVariation && seenVariationIds.has(defaultVariation) ? defaultVariation : variations[0].id;
    }

    return { id, product };
}

function focusFieldForError(message) {
    const msg = String(message || "").toLowerCase();
    if (msg.includes("product id")) {
        document.getElementById("productId")?.focus();
    } else if (msg.includes("product name") || msg.includes("name is required") || msg.includes("product name is required")) {
        document.getElementById("productName")?.focus();
    } else if (msg.includes("category")) {
        document.getElementById("productCategory")?.focus();
    } else if (msg.includes("price")) {
        document.getElementById("productPrice")?.focus();
    }
}

function saveProduct(options = {}) {
    try {
        const { id, product } = readFormProduct();
        const products = getProducts();
        if (state.originalId && state.originalId !== id) delete products[state.originalId];
        products[id] = product;
        selectProduct(id);
        renderAll();
        setUnsavedChanges(false);
        if (!options.silent) showToast("Product saved in editor");
    } catch (error) {
        const msg = String(error?.message || error || "An error occurred");
        showToast(msg);
        focusFieldForError(msg);
    }
}

function deleteProduct() {
    if (!state.selectedId) return;
    const product = getSelectedProduct();
    if (!product) return;
    if (!window.confirm(`Delete ${product.name || state.selectedId}?`)) return;

    delete getProducts()[state.selectedId];
    Object.keys(state.database.routes || {}).forEach((routeId) => {
        if (state.database.routes[routeId]?.productId === state.selectedId) delete state.database.routes[routeId];
    });

    const nextId = Object.keys(getProducts())[0] || "";
    selectProduct(nextId);
    renderAll();
    showToast("Product deleted in editor");
}

function createNewProduct() {
    state.selectedId = "";
    state.originalId = "";
    state.draftVariations = [];
    fillForm();
    document.getElementById("productId").value = "";
    document.getElementById("productName").focus();
    updateEditorSectionBadges();
    setUnsavedChanges(true);
}

function duplicateProduct() {
    const original = getSelectedProduct();
    if (!original) { showToast("Select a product to duplicate."); return; }

    const baseName = String(original.name || "Product").trim();
    const newName = `${baseName} (copy)`;
    const baseId = slugify(newName) || "duplicate-product";
    let newId = baseId;
    let counter = 2;
    const existing = new Set(Object.keys(getProducts()));
    while (existing.has(newId)) {
        newId = `${baseId}-${counter}`;
        counter += 1;
    }

    getProducts()[newId] = { ...clone(original), name: newName };
    selectProduct(newId);
    renderAll();
    showToast(`Duplicated as ${newId}`);
}

function toggleProductVisibility(id) {
    const product = getProducts()[id];
    if (!product) return;

    if (product.visible === false) {
        delete product.visible;
        showToast("Product published");
    } else {
        product.visible = false;
        showToast("Product hidden");
    }

    if (id === state.selectedId) fillForm();
    renderProductList();
    updateJsonOutput();
}

function addCategory() {
    const name = getUniqueCategoryName();
    const id = slugify(name);
    getCategories().push({
        name,
        id,
        label: name,
        icon: "bi-box",
        teaser: "Digital products",
        heading: name,
        description: `Browse ${name.toLowerCase()} products.`,
    });
    renderCategoryEditor();
    renderCategoryOptions();
    updateJsonOutput();
    showToast("Category added");
}

function updateCategory(index, field, value) {
    const category = getCategories()[index];
    if (!category) return;

    const previousName = category.name;
    category[field] = field === "visible" ? Boolean(value) : value;

    if (field === "name") {
        Object.values(getProducts()).forEach((product) => {
            if (product.category === previousName) product.category = value;
        });
        if (!category.id) category.id = slugify(value);
        if (!category.label || category.label === previousName) category.label = value;
        if (!category.heading || category.heading === previousName) category.heading = value;
    }

    const categorySelect = document.getElementById("productCategory");
    const selectedCategory = categorySelect?.value;
    renderCategoryOptions();
    if (field === "name" && selectedCategory === previousName && categorySelect) {
        categorySelect.value = value;
    }
    renderProductList();
    renderPreview();
    updateJsonOutput();
}

function moveCategory(index, direction) {
    const categories = getCategories();
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;
    const [category] = categories.splice(index, 1);
    categories.splice(nextIndex, 0, category);
    renderCategoryEditor();
    renderCategoryOptions();
    updateJsonOutput();
    showToast("Category order updated");
}

function removeCategory(index) {
    const category = getCategories()[index];
    if (!category) return;

    const usedCount = Object.values(getProducts()).filter((product) => product.category === category.name).length;
    if (usedCount) {
        showToast(`Move ${usedCount} product${usedCount === 1 ? "" : "s"} out of this category first`);
        return;
    }

    getCategories().splice(index, 1);
    renderCategoryEditor();
    renderCategoryOptions();
    updateJsonOutput();
    showToast("Category removed");
}

function validateCategories() {
    const seen = new Set();
    getCategories().forEach((category, index) => {
        const name = String(category.name || "").trim();
        if (!name) throw new Error(`Category ${index + 1} needs a name`);

        const key = name.toLowerCase();
        if (seen.has(key)) throw new Error(`Duplicate category: ${name}`);
        seen.add(key);

        category.name = name;
        category.id = String(category.id || slugify(name) || `category-${index + 1}`).trim();
        category.page = String(category.page || "").trim();
        category.label = String(category.label || name).trim();
        category.photo = String(category.photo || "assets/hyperlogo.png").trim();
        category.teaser = String(category.teaser || "").trim();
        category.heading = String(category.heading || category.label || name).trim();
        category.description = String(category.description || `Browse ${name.toLowerCase()} products.`).trim();
    });
}

function addVariation() {
    const defaultName = document.getElementById("productName").value.trim() || `${state.database.currency || "TND"} option`;
    let baseId = slugify(defaultName) || slugify(`${state.database.currency || "TND"} option`);
    let id = baseId;
    let counter = 2;
    const existing = new Set(state.draftVariations.map((variation) => variation.id));
    while (existing.has(id) || !id) {
        id = `${baseId}-${counter}`;
        counter += 1;
    }
    state.draftVariations.push({
        id,
        label: defaultName,
        name: defaultName,
        price: Number(document.getElementById("productPrice").value || 0),
    });
    renderVariations();
    renderPreview();
    markProductDirty();
}

function updateVariation(index, field, value) {
    if (!state.draftVariations[index]) return;
    state.draftVariations[index][field] = field === "price" ? Number(value || 0) : value;
    // auto-generate id from name or label when appropriate
    if (field === "name" || field === "label") {
        const currentId = String(state.draftVariations[index].id || "").trim();
        if (!currentId) {
            let base = slugify(String(value || "option"));
            let id = base;
            let counter = 2;
            const existing = new Set(state.draftVariations.map((v, i) => (i === index ? null : v.id)).filter(Boolean));
            while (existing.has(id) || !id) {
                id = `${base}-${counter}`;
                counter += 1;
            }
            state.draftVariations[index].id = id;
        }
    }
    renderPreview();
    markProductDirty();
}

function removeVariation(index) {
    state.draftVariations.splice(index, 1);
    renderVariations();
    renderPreview();
    markProductDirty();
}

function getPreviewProduct() {
    try {
        return readFormProduct();
    } catch {
        return {
            id: document.getElementById("productId")?.value || "new-product",
            product: {
                name: document.getElementById("productName")?.value || "New product",
                category: document.getElementById("productCategory")?.value || "Digital",
                price: Number(document.getElementById("productPrice")?.value || 0),
                image: document.getElementById("productImage")?.value || "assets/hyperlogo.png",
                description: document.getElementById("productDescription")?.value || "",
                inStock: document.getElementById("productInStock")?.checked !== false,
                customerInput: document.getElementById("productCustomerInputEnabled")?.checked
                    ? {
                          enabled: true,
                          labels: (state.draftCustomerInputs && state.draftCustomerInputs.length) ? state.draftCustomerInputs : [document.getElementById("productCustomerNewInput")?.value || "Player ID"],
                      }
                    : undefined,
                variations: state.draftVariations,
            },
        };
    }
}

function renderPreview() {
    const container = document.getElementById("adminPreviewBody");
    if (!container) return;

    const { id, product } = getPreviewProduct();
    const image = String(product.image || "").trim();
    const statePreviewImage = state.previewImages?.[image];
    const hasVariations = Array.isArray(product.variations) && product.variations.length > 0;
    const defaultVariation = hasVariations && product.variations.find((v) => v.visible !== false && v.inStock !== false) || product.variations?.[0];
    const displayPrice = defaultVariation?.price ?? product.price ?? 0;
    const inStock = product.inStock !== false;
    const art = product.art || "gamekey-art";
    const icon = product.icon || "bi-box";

    container.innerHTML = `
        <div class="col-12 px-0">
            <article class="card product-card h-100">
                <a class="product-art ${escapeHtml(art)}" href="product.html?product=${encodeURIComponent(id)}">
                    ${image
                        ? `<img class="product-image" src="${escapeHtml(statePreviewImage || image)}" alt="${escapeHtml(product.name)}" />`
                        : `<i class="bi ${escapeHtml(icon)}"></i>`
                    }
                </a>
                <div class="card-body d-flex flex-column">
                    <div class="d-flex flex-wrap gap-2 mb-2">
                        <span class="badge text-bg-dark">${escapeHtml(product.category || "Digital")}</span>
                        <span class="badge ${inStock ? "text-bg-success" : "text-bg-secondary"}">${inStock ? "Available" : "Out of stock"}</span>
                    </div>
                    <h2 class="h5">${escapeHtml(product.name || "New product")}</h2>
                    <p class="text-secondary flex-grow-1">${escapeHtml(product.description || "") || "&nbsp;"}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="price">${hasVariations ? "From " : ""}${money(displayPrice, state.database.currency)}</strong>
                        <button class="btn btn-primary btn-sm" ${inStock ? "" : "disabled"}>${inStock ? "Add" : "Unavailable"}</button>
                    </div>
                </div>
            </article>
        </div>
        <div class="admin-preview-details mt-3">
            <details>
                <summary>Product info</summary>
                <div class="small text-secondary mt-2" style="white-space: pre-wrap;">
ID: ${escapeHtml(id)}
${hasVariations ? `Variations: ${product.variations.length}` : `Price: ${money(displayPrice, state.database.currency)}`}
Category: ${escapeHtml(product.category || "Digital")}
${image ? `Image: ${escapeHtml(image)}` : "No image"}
${product.visible === false ? "Hidden from store" : "Visible"}
${!inStock ? "Out of stock" : ""}
${product.customerInput?.enabled ? "Customer input enabled" : ""}
                </div>
            </details>
        </div>
    `;
}

function updateImagePreview() {
    const container = document.getElementById("adminImagePreview");
    const img = document.getElementById("adminImagePreviewImg");
    if (!container || !img) return;

    const pathInput = document.getElementById("productImage");
    const path = pathInput?.value?.trim() || "";
    const blobUrl = state.previewImages?.[path];

    if (blobUrl) {
        img.src = blobUrl;
        container.style.display = "";
    } else if (path) {
        img.src = path;
        container.style.display = "";
    } else {
        container.style.display = "none";
    }
}

function handlePhotoFile(file) {
    if (!file) return;
    const path = `assets/${safeAssetFileName(file.name)}`;
    const input = document.getElementById("productImage");
    if (input) input.value = path;
    if (state.previewImages[path]) URL.revokeObjectURL(state.previewImages[path]);
    state.previewImages[path] = URL.createObjectURL(file);
    updateImagePreview();
    renderPreview();
    markProductDirty();
    showToast(`Photo path set to ${path}`);
}

function getOutputJson() {
    validateCategories();
    return JSON.stringify(state.database, null, 4);
}

function updateJsonOutput() {
    const output = document.getElementById("jsonOutput");
    if (!output) return;
    try {
        output.value = getOutputJson();
    } catch {
        output.value = JSON.stringify(state.database, null, 4);
    }
}

function fillSettingsForm() {
    const settings = mergePaymentSettings(state.settings);
    const store = settings.store;
    const statusMessages = settings.statusMessages;
    const d17 = settings.payment.d17;
    const flouci = settings.payment.flouci;
    const ttCard = settings.payment["tt-card"];

    const fields = {
        storeNameSetting: store.name,
        storeLogoSetting: store.logo,
        supportWhatsappSetting: store.supportWhatsApp,
        deliveryMessageSetting: store.deliveryMessage,
        statusPaymentReviewTitle: statusMessages.paymentReview.title,
        statusPaymentReviewMessage: statusMessages.paymentReview.message,
        statusPaymentRejectedTitle: statusMessages.paymentRejected.title,
        statusPaymentRejectedMessage: statusMessages.paymentRejected.message,
        statusCustomerInfoTitle: statusMessages.customerInfoNeeded.title,
        statusCustomerInfoMessage: statusMessages.customerInfoNeeded.message,
        statusDeliveryWaitingTitle: statusMessages.deliveryWaiting.title,
        statusDeliveryWaitingMessage: statusMessages.deliveryWaiting.message,
        statusDeliveredTitle: statusMessages.delivered.title,
        statusDeliveredMessage: statusMessages.delivered.message,
        statusCancelledTitle: statusMessages.cancelled.title,
        statusCancelledMessage: statusMessages.cancelled.message,
        d17Enabled: d17.enabled !== false,
        d17Instructions: d17.instructions,
        d17RecipientName: d17.recipientName,
        d17RecipientValue: d17.recipientValue,
        d17RecipientHint: d17.recipientHint,
        d17ProofLabel: d17.proofLabel,
        d17FeePercent: d17.feePercent,
        d17RoundUpToDecimal: d17.roundUpToDecimal,
        flouciEnabled: flouci.enabled !== false,
        flouciInstructions: flouci.instructions,
        flouciRecipientName: flouci.recipientName,
        flouciRecipientValue: flouci.recipientValue,
        flouciRecipientHint: flouci.recipientHint,
        flouciProofLabel: flouci.proofLabel,
        flouciFeeUnder100: flouci.feeUnder100,
        flouciFeeFrom100: flouci.feeFrom100,
        ttCardEnabled: ttCard.enabled !== false,
        ttCardInstructions: ttCard.instructions,
        ttCardValue: ttCard.cardValue,
        ttCardFeePercent: ttCard.feePercent,
        ttCardCodeLength: ttCard.codeLength,
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (!element) return;
        if (element.type === "checkbox") {
            element.checked = Boolean(value);
        } else {
            element.value = value ?? "";
        }
    });
}

function readSettingsForm() {
    const numberValue = (id, fallback) => {
        const value = Number(document.getElementById(id)?.value ?? fallback);
        return Number.isFinite(value) ? value : fallback;
    };
    const textValue = (id, fallback) => document.getElementById(id)?.value.trim() || fallback;
    const checkedValue = (id) => document.getElementById(id)?.checked !== false;

    return {
        store: {
            name: textValue("storeNameSetting", DEFAULT_PAYMENT_SETTINGS.store.name),
            logo: textValue("storeLogoSetting", DEFAULT_PAYMENT_SETTINGS.store.logo),
            supportWhatsApp: textValue("supportWhatsappSetting", DEFAULT_PAYMENT_SETTINGS.store.supportWhatsApp),
            deliveryMessage: textValue("deliveryMessageSetting", DEFAULT_PAYMENT_SETTINGS.store.deliveryMessage),
        },
        statusMessages: {
            paymentReview: {
                title: textValue("statusPaymentReviewTitle", DEFAULT_PAYMENT_SETTINGS.statusMessages.paymentReview.title),
                message: textValue("statusPaymentReviewMessage", DEFAULT_PAYMENT_SETTINGS.statusMessages.paymentReview.message),
            },
            paymentRejected: {
                title: textValue("statusPaymentRejectedTitle", DEFAULT_PAYMENT_SETTINGS.statusMessages.paymentRejected.title),
                message: textValue("statusPaymentRejectedMessage", DEFAULT_PAYMENT_SETTINGS.statusMessages.paymentRejected.message),
            },
            customerInfoNeeded: {
                title: textValue("statusCustomerInfoTitle", DEFAULT_PAYMENT_SETTINGS.statusMessages.customerInfoNeeded.title),
                message: textValue("statusCustomerInfoMessage", DEFAULT_PAYMENT_SETTINGS.statusMessages.customerInfoNeeded.message),
            },
            deliveryWaiting: {
                title: textValue("statusDeliveryWaitingTitle", DEFAULT_PAYMENT_SETTINGS.statusMessages.deliveryWaiting.title),
                message: textValue("statusDeliveryWaitingMessage", DEFAULT_PAYMENT_SETTINGS.statusMessages.deliveryWaiting.message),
            },
            delivered: {
                title: textValue("statusDeliveredTitle", DEFAULT_PAYMENT_SETTINGS.statusMessages.delivered.title),
                message: textValue("statusDeliveredMessage", DEFAULT_PAYMENT_SETTINGS.statusMessages.delivered.message),
            },
            cancelled: {
                title: textValue("statusCancelledTitle", DEFAULT_PAYMENT_SETTINGS.statusMessages.cancelled.title),
                message: textValue("statusCancelledMessage", DEFAULT_PAYMENT_SETTINGS.statusMessages.cancelled.message),
            },
        },
        faq: Array.isArray(state.settings.faq) ? state.settings.faq : DEFAULT_PAYMENT_SETTINGS.faq,
        payment: {
            d17: {
                enabled: checkedValue("d17Enabled"),
                label: "D17 transfer",
                instructions: textValue("d17Instructions", DEFAULT_PAYMENT_SETTINGS.payment.d17.instructions),
                recipientName: textValue("d17RecipientName", ""),
                recipientValue: textValue("d17RecipientValue", ""),
                recipientHint: textValue("d17RecipientHint", ""),
                proofLabel: textValue("d17ProofLabel", DEFAULT_PAYMENT_SETTINGS.payment.d17.proofLabel),
                feePercent: numberValue("d17FeePercent", DEFAULT_PAYMENT_SETTINGS.payment.d17.feePercent),
                roundUpToDecimal: numberValue("d17RoundUpToDecimal", DEFAULT_PAYMENT_SETTINGS.payment.d17.roundUpToDecimal),
            },
            flouci: {
                enabled: checkedValue("flouciEnabled"),
                label: "Flouci transfer",
                instructions: textValue("flouciInstructions", DEFAULT_PAYMENT_SETTINGS.payment.flouci.instructions),
                recipientName: textValue("flouciRecipientName", ""),
                recipientValue: textValue("flouciRecipientValue", ""),
                recipientHint: textValue("flouciRecipientHint", ""),
                proofLabel: textValue("flouciProofLabel", DEFAULT_PAYMENT_SETTINGS.payment.flouci.proofLabel),
                feeUnder100: numberValue("flouciFeeUnder100", DEFAULT_PAYMENT_SETTINGS.payment.flouci.feeUnder100),
                feeFrom100: numberValue("flouciFeeFrom100", DEFAULT_PAYMENT_SETTINGS.payment.flouci.feeFrom100),
            },
            "tt-card": {
                enabled: checkedValue("ttCardEnabled"),
                label: "Tunisie Telecom recharge card",
                instructions: textValue("ttCardInstructions", DEFAULT_PAYMENT_SETTINGS.payment["tt-card"].instructions),
                cardValue: numberValue("ttCardValue", DEFAULT_PAYMENT_SETTINGS.payment["tt-card"].cardValue),
                feePercent: numberValue("ttCardFeePercent", DEFAULT_PAYMENT_SETTINGS.payment["tt-card"].feePercent),
                codeLength: numberValue("ttCardCodeLength", DEFAULT_PAYMENT_SETTINGS.payment["tt-card"].codeLength),
            },
        },
    };
}

function saveSettingsFromForm() {
    state.settings = mergePaymentSettings(readSettingsForm());
}

function getSettingsJson() {
    saveSettingsFromForm();
    return JSON.stringify(state.settings, null, 4);
}

function downloadJson() {
    try {
        if (document.getElementById("productId")?.value.trim()) saveProduct({ silent: true });
    } catch (error) {
        showToast(error.message || "Could not save current product");
        return;
    }

    const blob = new Blob([getOutputJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hyperkey-catalog-export.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Catalog exported");
}

function downloadSettingsJson() {
    downloadTextFile("hyperkey-settings-export.json", getSettingsJson(), "application/json");
    showToast("Settings exported");
}

function downloadTextFile(fileName, text, type = "text/plain") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function getProductsCsv() {
    const rows = [
        ["id", "name", "category", "price", "description", "image", "visible", "inStock", "variations"],
        ...Object.entries(getProducts()).map(([id, product]) => [
            id,
            product.name || "",
            product.category || "",
            product.price ?? 0,
            product.description || "",
            product.image || "",
            product.visible === false ? "false" : "true",
            product.inStock === false ? "false" : "true",
            Array.isArray(product.variations) ? JSON.stringify(product.variations) : "",
        ]),
    ];
    return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function exportProductsCsv() {
    try {
        if (document.getElementById("productId")?.value.trim()) saveProduct({ silent: true });
        downloadTextFile("hyperkey-products.csv", getProductsCsv(), "text/csv");
        showToast("Exported products CSV");
    } catch (error) {
        showToast(error.message || "Could not export CSV");
    }
}

function downloadCsvTemplate() {
    const template = [
        ["id", "name", "category", "price", "description", "image", "visible", "inStock", "variations"],
        ["steam-wallet-25", "Steam Wallet 25 TND", "Game Top-Ups", "25", "Digital wallet code.", "assets/hyperlogo.png", "true", "true", ""],
    ];
    downloadTextFile("hyperkey-products-template.csv", template.map((row) => row.map(csvEscape).join(",")).join("\n"), "text/csv");
    showToast("Downloaded CSV template");
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let insideQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (insideQuotes && char === '"' && next === '"') {
            cell += '"';
            index += 1;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
            row.push(cell);
            cell = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") index += 1;
            row.push(cell);
            if (row.some((value) => value.trim())) rows.push(row);
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
}

async function importCsv(file) {
    if (!file) return;
    if (!window.confirm("Importing CSV can overwrite products with matching IDs. Continue?")) return;

    const rows = parseCsv(await file.text());
    const headers = (rows.shift() || []).map((header) => slugify(header));
    const required = ["id", "name", "category", "price"];
    if (!required.every((field) => headers.includes(field))) {
        throw new Error("CSV must include id, name, category, and price columns");
    }

    rows.forEach((row) => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = row[index] ?? "";
        });
        const id = slugify(record.id);
        if (!id) return;

        const product = {
            name: record.name || id,
            category: record.category || getCategories()[0]?.name || "Game Top-Ups",
            price: Number(record.price || 0),
        };
        if (record.description) product.description = record.description;
        if (record.image) product.image = record.image;
        if (record.visible === "false") product.visible = false;
        if (record.instock === "false") product.inStock = false;
        if (record.variations) {
            try {
                const variations = JSON.parse(record.variations);
                if (Array.isArray(variations)) product.variations = variations;
            } catch {
                throw new Error(`Invalid variations JSON for ${id}`);
            }
        }

        getProducts()[id] = product;
    });

    selectProduct(Object.keys(getProducts())[0] || "");
    renderAll();
    showToast("Imported products CSV");
}

async function copyJson() {
    try {
        if (document.getElementById("productId")?.value.trim()) saveProduct({ silent: true });
        await navigator.clipboard.writeText(getOutputJson());
        showToast("Copied JSON");
    } catch (error) {
        showToast(error.message || "Could not copy JSON");
    }
}

async function importJson(file) {
    if (!file) return;
    if (!window.confirm("Importing JSON will replace the current product database in this editor. Continue?")) return;
    const text = await file.text();
    const database = JSON.parse(text);
    setDatabase(database);
    showToast("Imported JSON");
}

async function importSettingsJson(file) {
    if (!file) return;
    const text = await file.text();
    const settings = JSON.parse(text);
    setSettings(settings);
    showToast("Settings imported from file");
}

function getSelectedImportFile(inputId, label) {
    const file = document.getElementById(inputId)?.files?.[0];
    if (!file) throw new Error(`Choose ${label} first`);
    return file;
}

function showSelectedFileMessage(inputId, label) {
    const file = document.getElementById(inputId)?.files?.[0];
    if (!file) return;
    showToast(`${file.name} selected. Press ${label} to import.`);
}

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function showAdminContent() {
    const lockScreen = document.getElementById("adminLockScreen");
    const content = document.getElementById("adminContent");
    if (lockScreen) lockScreen.style.display = "none";
    if (content) content.style.display = "";
}

function showLockScreen() {
    const lockScreen = document.getElementById("adminLockScreen");
    const content = document.getElementById("adminContent");
    if (lockScreen) lockScreen.style.display = "";
    if (content) content.style.display = "none";
}

async function verifyAdminToken() {
    try {
        await adminRequest({ action: "admin-verify" });
        return true;
    } catch {
        return false;
    }
}

async function unlockAdminPanel(token) {
    const errorEl = document.getElementById("adminLockError");
    const button = document.getElementById("adminUnlockButton");
    if (!token) return;
    setAdminToken(token);
    if (button) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Verifying...`;
    }
    try {
        const valid = await verifyAdminToken();
        if (!valid) throw new Error("Token is invalid");
        sessionStorage.setItem("hyperkey-admin-unlocked", "1");
        showAdminContent();
        initAdminPanel();
    } catch (err) {
        setAdminToken("");
        sessionStorage.removeItem("hyperkey-admin-unlocked");
        if (errorEl) {
            errorEl.textContent = err.message || "Token is invalid";
            errorEl.style.display = "";
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i class="bi bi-unlock me-1"></i>Unlock`;
        }
    }
}

function lockAdminPanel() {
    setAdminToken("");
    sessionStorage.removeItem("hyperkey-admin-unlocked");
    showLockScreen();
    const errorEl = document.getElementById("adminLockError");
    if (errorEl) errorEl.style.display = "none";
    const tokenInput = document.getElementById("adminLockToken");
    if (tokenInput) tokenInput.value = "";
}

async function uploadToGitHub(file) {
    const path = `assets/${safeAssetFileName(file.name)}`;

    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
    });

    const result = await adminRequest({
        action: "admin-upload-image",
        fileName: path,
        base64: data,
    });

    return { path };
}

async function adminRequest(body) {
    if (!ORDER_API_URL) throw new Error("Worker URL is not configured in config.js");
    const token = getAdminToken();
    if (!token) throw new Error("Enter and save the admin token");

    const response = await fetch(ORDER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": token,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let result = {};
    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error("Worker did not return JSON");
    }

    if (!response.ok || !result.ok) {
        throw new Error(result.error || "Admin request failed");
    }

    return result;
}

function renderProofs(proofs) {
    if (!Array.isArray(proofs) || !proofs.length) return `<p class="text-secondary mb-0">No proof saved.</p>`;
    return proofs
        .map(
            (proof) => `
                <div class="admin-proof-line">
                    <span>${escapeHtml(proof.label || proof.type || "Proof")}</span>
                    <strong>${escapeHtml(proof.value || "")}</strong>
                </div>
            `,
        )
        .join("");
}

function renderOrderItems(items) {
    if (!Array.isArray(items) || !items.length) return `<p class="text-secondary mb-0">No items saved.</p>`;
    return items
        .map(
            (item) => `
                <div class="admin-order-line">
                    <span>${escapeHtml(item.quantity > 1 ? `${item.quantity} x ` : "")}${escapeHtml(item.productName)}</span>
                    <strong>${formatPlainTndAmount(item.lineTotal)}</strong>
                </div>
            `,
        )
        .join("");
}

function getAdminOrderItemCount(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
}

const CATALOG_API_URL = ORDER_API_URL ? `${ORDER_API_URL.replace(/\/+$/, "")}/api` : "";

async function adminGetRequest(url) {
    const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return response.json();
}

async function syncDatabaseToApi() {
    if (!CATALOG_API_URL) throw new Error("Worker URL is not configured in config.js");
    try {
        if (document.getElementById("productId")?.value.trim()) saveProduct({ silent: true });
    } catch (error) {
        throw new Error(error.message || "Could not save current product");
    }
    const data = {
        action: "admin-save-data",
        products: getProducts(),
        categories: getCategories().map((cat) => ({
            ...cat,
            visible: cat.visible !== false,
        })),
        currency: state.database.currency || "TND",
        routes: state.database.routes || {},
    };
    await adminRequest(data);
    setUnsavedChanges(false);
}

async function syncSettingsToApi() {
    if (!CATALOG_API_URL) throw new Error("Worker URL is not configured in config.js");
    saveSettingsFromForm();
    await adminRequest({
        action: "admin-save-settings",
        settings: state.settings,
    });
}

function adminCountLabel(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function getAdminCustomerInputLabels(product) {
    const config = product?.customerInput;
    if (!config || config.enabled === false) return [];
    const labels = Array.isArray(config.labels) && config.labels.length ? config.labels : [config.label || "Player ID"];
    return [...new Set(labels.map((label) => String(label || "Player ID").trim().slice(0, 80)).filter(Boolean))];
}

function getAdminCustomerInputKey(productId, variationId, label) {
    return `${productId}::${variationId || ""}::${slugify(label || "delivery-info")}`;
}

function getAdminCustomerInputRequirements(order) {
    const fromWorker = Array.isArray(order.customerInputRequirements) ? order.customerInputRequirements : [];
    if (fromWorker.length) return fromWorker;

    if (order.paymentStatus !== "verified" || order.deliveryStatus !== "waiting") return [];

    const savedKeys = new Set(
        (Array.isArray(order.customerInputs) ? order.customerInputs : []).map((input) =>
            input.key || getAdminCustomerInputKey(input.productId, input.variationId || "", input.label || ""),
        ),
    );

    return (Array.isArray(order.items) ? order.items : [])
        .flatMap((item) => {
            const product = state.database.products?.[item.productId];
            return getAdminCustomerInputLabels(product)
                .map((label) => {
                    const key = getAdminCustomerInputKey(item.productId, item.variationId || "", label);
                    if (savedKeys.has(key)) return null;
                    return {
                        key,
                        productId: item.productId,
                        variationId: item.variationId || "",
                        productName: item.productName,
                        label,
                    };
                })
                .filter(Boolean);
        })
        .filter(Boolean);
}

function renderOrderCustomerInputs(inputs, requirements = []) {
    const savedInputs = Array.isArray(inputs) ? inputs : [];
    const pendingRequirements = Array.isArray(requirements) ? requirements : [];

    if (!savedInputs.length && !pendingRequirements.length) return "";

    return `
        <div class="admin-customer-input-list">
            ${[
                ...savedInputs.map(
                    (input) => `
                        <div class="admin-customer-input-row">
                            <div>
                                <span>${escapeHtml(input.label || "Delivery info")} for ${escapeHtml(input.productName || "Product")}</span>
                                <code>${escapeHtml(input.value || "")}</code>
                            </div>
                            <button class="btn btn-outline-dark btn-sm" type="button" data-copy-admin-text="${escapeHtml(input.value || "")}">
                                <i class="bi bi-clipboard me-1"></i>Copy
                            </button>
                        </div>
                    `,
                ),
                ...pendingRequirements.map(
                    (input) => `
                        <div class="admin-customer-input-row admin-customer-input-row-pending">
                            <div>
                                <span>${escapeHtml(input.label || "Delivery info")} for ${escapeHtml(input.productName || "Product")}</span>
                                <em>Waiting for customer</em>
                            </div>
                        </div>
                    `,
                ),
            ].join("")}
        </div>
    `;
}
function getDeliveryText(order) {
    return (order.deliveries || []).map((delivery) => delivery.text || "").filter(Boolean).join("\n\n");
}

function renderDeliveryControls(order) {
    const deliveryText = getDeliveryText(order);
    return `
        <div class="admin-delivery-box">
            <div class="d-flex flex-column flex-lg-row justify-content-between gap-2 mb-2">
                <div>
                    <p class="form-label mb-1">Delivery code / note</p>
                    <p class="small text-secondary mb-0">Use Note: CODE. Enter 0 when no code should be delivered.</p>
                </div>
                <button class="btn btn-outline-dark btn-sm align-self-lg-start" type="button" data-save-order-delivery="${escapeHtml(order.id)}">
                    <i class="bi bi-key me-1"></i>Save delivery
                </button>
            </div>
            <textarea class="form-control admin-delivery-text" rows="3" data-order-delivery-text placeholder="Steam 25 TND: AAAA-BBBB-CCCC">${escapeHtml(deliveryText)}</textarea>
        </div>
    `;
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

function getOrderReasonSummary(order) {
    const reasons = [
        order.paymentStatusReason ? `Payment: ${order.paymentStatusReason}` : "",
        order.deliveryStatusReason ? `Delivery: ${order.deliveryStatusReason}` : "",
    ].filter(Boolean);
    if (!reasons.length) return "";
    return `
        <div class="admin-status-reasons">
            ${reasons.map((reason) => `<div><i class="bi bi-info-circle me-1"></i>${escapeHtml(reason)}</div>`).join("")}
        </div>
    `;
}

function getOrderWorkflowStatus(order) {
    const payment = String(order.paymentStatus || "").toLowerCase();
    const delivery = String(order.deliveryStatus || "").toLowerCase();
    if (payment === "rejected" || delivery === "cancelled" || delivery === "canceled") return "cancelled";
    if (delivery === "delivered") return "completed";
    if (payment === "verified" && delivery === "waiting") return "delivering";
    if (payment === "verified") return "paid";
    return "pending";
}

function getFilteredOrders() {
    const search = state.orderFilters.search.trim().toLowerCase();
    const dateFrom = state.orderFilters.dateFrom ? new Date(state.orderFilters.dateFrom + "T00:00:00") : null;
    const dateTo = state.orderFilters.dateTo ? new Date(state.orderFilters.dateTo + "T23:59:59") : null;
    return state.orders.filter((order) => {
        if (state.orderFilters.workflow && getOrderWorkflowStatus(order) !== state.orderFilters.workflow) return false;
        if (state.orderFilters.payment && order.paymentStatus !== state.orderFilters.payment) return false;
        if (state.orderFilters.delivery && order.deliveryStatus !== state.orderFilters.delivery) return false;

        if (dateFrom || dateTo) {
            const createdAt = new Date(order.createdAt);
            if (dateFrom && createdAt < dateFrom) return false;
            if (dateTo && createdAt > dateTo) return false;
        }

        if (!search) return true;
        const haystack = [
            order.id,
            order.customerPhone,
            order.customerPhoneDisplay,
            order.paymentMethodLabel,
            order.paymentStatusLabel,
            order.deliveryStatusLabel,
            order.paymentStatusReason,
            order.deliveryStatusReason,
            ...(order.items || []).map((item) => item.productName),
            ...(order.proofs || []).map((proof) => `${proof.label} ${proof.value}`),
            ...(order.deliveries || []).map((delivery) => `${delivery.text || ""} ${(delivery.lines || []).map((line) => `${line.note} ${line.code}`).join(" ")}`),
            ...(order.customerInputs || []).map((input) => `${input.label} ${input.productName} ${input.value}`),
            ...getAdminCustomerInputRequirements(order).map((input) => `${input.label} ${input.productName}`),
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(search);
    });
}

function renderAdminOrders() {
    const list = document.getElementById("adminOrdersList");
    if (!list) return;

    if (!state.orders.length) {
        list.innerHTML = `<div class="empty-state py-4"><p class="text-secondary mb-0">No orders found.</p></div>`;
        return;
    }

    const orders = getFilteredOrders();
    if (!orders.length) {
        list.innerHTML = `<div class="empty-state py-4"><p class="text-secondary mb-0">No orders match these filters.</p></div>`;
        return;
    }

    list.innerHTML = orders
        .map((order) => {
            const createdAt = formatAdminDateTime(order.createdAt);
            const customerInputRequirements = getAdminCustomerInputRequirements(order);
            const customerInputHtml = renderOrderCustomerInputs(order.customerInputs, customerInputRequirements);
            const itemCount = getAdminOrderItemCount(order.items);
            const proofCount = Array.isArray(order.proofs) ? order.proofs.length : 0;
            const customerInputCount = (Array.isArray(order.customerInputs) ? order.customerInputs.length : 0) + customerInputRequirements.length;
            const deliveryText = getDeliveryText(order);
            const workflowStatus = getOrderWorkflowStatus(order);
            return `
                <article class="admin-order-card order-priority-${workflowStatus}" data-admin-order-id="${escapeHtml(order.id)}">
                    <div class="admin-order-card-header">
                        <div class="admin-order-title-block">
                            <p class="eyebrow mb-1">${escapeHtml(createdAt)}</p>
                            <h3 class="h4 fw-black mb-2">${escapeHtml(order.id)}</h3>
                            <div class="admin-order-meta-row">
                                <span><i class="bi bi-whatsapp"></i><bdi class="phone-ltr">${escapeHtml(order.customerPhoneDisplay)}</bdi></span>
                                <span><i class="bi bi-credit-card"></i>${escapeHtml(order.paymentMethodLabel)}</span>
                                <strong>${formatPlainTndAmount(order.amountDue)}</strong>
                            </div>
                        </div>
                        <div class="admin-order-actions">
                            <button class="btn btn-outline-dark btn-sm" type="button" data-copy-admin-text="${escapeHtml(order.customerPhone)}">
                                <i class="bi bi-clipboard me-1"></i>Phone
                            </button>
                            <button class="btn btn-outline-danger btn-sm" type="button" data-delete-order="${escapeHtml(order.id)}">
                                <i class="bi bi-trash me-1"></i>Delete
                            </button>
                        </div>
                    </div>

                    <div class="admin-order-body admin-order-body-groups">
                        <details class="admin-order-details admin-order-status-details" open>
                            <summary>
                                <span><i class="bi bi-sliders me-1"></i>Status controls</span>
                                <small>${escapeHtml(order.paymentStatusLabel)} / ${escapeHtml(order.deliveryStatusLabel)}</small>
                                <i class="bi bi-chevron-down"></i>
                            </summary>
                            <div class="admin-order-status-panel">
                            <div class="admin-status-card">
                                <span>Payment</span>
                                ${statusBadge(order.paymentStatusLabel, order.paymentStatus)}
                            </div>
                            <div class="admin-status-card">
                                <span>Delivery</span>
                                ${statusBadge(order.deliveryStatusLabel, order.deliveryStatus)}
                            </div>
                            ${getOrderReasonSummary(order)}
                            <div class="admin-status-controls">
                                <select class="form-select form-select-sm" data-order-payment-status aria-label="Payment status">
                                    <option value="pending" ${order.paymentStatus === "pending" ? "selected" : ""}>Payment pending</option>
                                    <option value="verified" ${order.paymentStatus === "verified" ? "selected" : ""}>Payment verified</option>
                                    <option value="rejected" ${order.paymentStatus === "rejected" ? "selected" : ""}>Payment rejected</option>
                                </select>
                                <select class="form-select form-select-sm" data-order-delivery-status aria-label="Delivery status">
                                    <option value="waiting" ${order.deliveryStatus === "waiting" ? "selected" : ""}>Waiting delivery</option>
                                    <option value="delivered" ${order.deliveryStatus === "delivered" ? "selected" : ""}>Delivered</option>
                                    <option value="cancelled" ${order.deliveryStatus === "cancelled" ? "selected" : ""}>Cancelled</option>
                                </select>
                                <button class="btn btn-primary btn-sm" type="button" data-update-order-status="${escapeHtml(order.id)}">Save status</button>
                            </div>
                            <div class="admin-reason-controls">
                                <label>
                                    <span>Payment rejection reason</span>
                                    <input class="form-control form-control-sm" data-order-payment-reason type="text" value="${escapeHtml(order.paymentStatusReason || "")}" placeholder="Reason shown to customer if rejected" />
                                </label>
                                <label>
                                    <span>Cancel reason</span>
                                    <input class="form-control form-control-sm" data-order-delivery-reason type="text" value="${escapeHtml(order.deliveryStatusReason || "")}" placeholder="Reason shown to customer if cancelled" />
                                </label>
                            </div>
                            <div class="admin-quick-actions">
                                <button class="btn btn-outline-dark btn-sm" type="button" data-quick-order-action="payment:verified" data-quick-order-id="${escapeHtml(order.id)}">
                                    <i class="bi bi-check-circle me-1"></i>Verify payment
                                </button>
                                <button class="btn btn-outline-danger btn-sm" type="button" data-quick-order-action="payment:rejected" data-quick-order-id="${escapeHtml(order.id)}">
                                    <i class="bi bi-x-circle me-1"></i>Reject payment
                                </button>
                                <button class="btn btn-outline-dark btn-sm" type="button" data-quick-order-action="delivery:waiting" data-quick-order-id="${escapeHtml(order.id)}">
                                    <i class="bi bi-hourglass-split me-1"></i>Not delivered
                                </button>
                                <button class="btn btn-outline-dark btn-sm" type="button" data-quick-order-action="delivery:delivered" data-quick-order-id="${escapeHtml(order.id)}">
                                    <i class="bi bi-truck me-1"></i>Delivered
                                </button>
                                <button class="btn btn-outline-danger btn-sm" type="button" data-quick-order-action="delivery:cancelled" data-quick-order-id="${escapeHtml(order.id)}">
                                    <i class="bi bi-slash-circle me-1"></i>Cancel order
                                </button>
                            </div>
                            </div>
                        </details>

                        <details class="admin-order-details">
                            <summary>
                                <span><i class="bi bi-bag-check me-1"></i>Products</span>
                                <small>${escapeHtml(adminCountLabel(itemCount, "item"))}</small>
                                <i class="bi bi-chevron-down"></i>
                            </summary>
                            <div class="admin-order-detail-grid admin-order-detail-grid-single">
                                <div>${renderOrderItems(order.items)}</div>
                            </div>
                        </details>

                        <details class="admin-order-details">
                            <summary>
                                <span><i class="bi bi-receipt me-1"></i>Payment proof</span>
                                <small>${escapeHtml(adminCountLabel(proofCount, "proof"))}</small>
                                <i class="bi bi-chevron-down"></i>
                            </summary>
                            <div class="admin-order-detail-grid admin-order-detail-grid-single">
                                <div>${renderProofs(order.proofs)}</div>
                            </div>
                        </details>

                        ${
                            customerInputHtml
                                ? `<details class="admin-order-details" open>
                                    <summary>
                                        <span><i class="bi bi-person-lines-fill me-1"></i>Customer delivery info</span>
                                        <small>${escapeHtml(adminCountLabel(customerInputCount, "field"))}</small>
                                        <i class="bi bi-chevron-down"></i>
                                    </summary>
                                    <div class="admin-order-detail-grid admin-order-detail-grid-single">
                                        <div class="admin-customer-inputs-block">${customerInputHtml}</div>
                                    </div>
                                </details>`
                                : ""
                        }

                        <details class="admin-order-details admin-delivery-details" ${deliveryText ? "open" : ""}>
                            <summary>
                                <span><i class="bi bi-key me-1"></i>Delivery code / note</span>
                                <small>${deliveryText ? "Saved" : "Empty"}</small>
                                <i class="bi bi-chevron-down"></i>
                            </summary>
                            ${renderDeliveryControls(order)}
                        </details>
                    </div>
                </article>
            `;
        })
        .join("");
}

async function loadAdminOrders() {
    const list = document.getElementById("adminOrdersList");
    if (list) {
        list.innerHTML = `<div class="empty-state py-4"><p class="text-secondary mb-0">Loading orders...</p></div>`;
    }

    const result = await adminRequest({ action: "admin-list-orders", limit: 50 });
    state.orders = result.orders || [];
    renderAdminOrders();
    showToast("Loaded orders");
}

async function updateAdminOrderStatus(orderId) {
    const card = [...document.querySelectorAll("[data-admin-order-id]")].find((item) => item.dataset.adminOrderId === orderId);
    if (!card) return;

    const paymentStatus = card.querySelector("[data-order-payment-status]")?.value || "";
    const deliveryStatus = card.querySelector("[data-order-delivery-status]")?.value || "";
    let paymentStatusReason = card.querySelector("[data-order-payment-reason]")?.value || "";
    let deliveryStatusReason = card.querySelector("[data-order-delivery-reason]")?.value || "";
    if (paymentStatus === "rejected" && !paymentStatusReason.trim()) {
        paymentStatusReason = window.prompt("Payment rejection reason shown to customer:", "Payment proof could not be verified.") || "";
        const input = card.querySelector("[data-order-payment-reason]");
        if (input) input.value = paymentStatusReason;
    }
    if (deliveryStatus === "cancelled" && !deliveryStatusReason.trim()) {
        deliveryStatusReason = window.prompt("Cancel reason shown to customer:", "Order was cancelled by support.") || "";
        const input = card.querySelector("[data-order-delivery-reason]");
        if (input) input.value = deliveryStatusReason;
    }
    const result = await adminRequest({
        action: "admin-update-order",
        orderId,
        paymentStatus,
        deliveryStatus,
        paymentStatusReason,
        deliveryStatusReason,
    });

    state.orders = state.orders.map((order) => (order.id === result.order.id ? result.order : order));
    renderAdminOrders();
    showToast("Order status updated");
}

async function quickUpdateAdminOrder(orderId, action) {
    const card = [...document.querySelectorAll("[data-admin-order-id]")].find((item) => item.dataset.adminOrderId === orderId);
    if (!card) return;

    const [target, status] = String(action || "").split(":");
    if (!target || !status) return;

    const payload = {
        action: "admin-update-order",
        orderId,
    };

    if (target === "payment") {
        payload.paymentStatus = status;
        payload.paymentStatusReason = card.querySelector("[data-order-payment-reason]")?.value || "";
        if (status === "rejected" && !payload.paymentStatusReason.trim()) {
            payload.paymentStatusReason = window.prompt("Payment rejection reason shown to customer:", "Payment proof could not be verified.") || "";
            const input = card.querySelector("[data-order-payment-reason]");
            if (input) input.value = payload.paymentStatusReason;
        }
    }

    if (target === "delivery") {
        payload.deliveryStatus = status;
        payload.deliveryStatusReason = card.querySelector("[data-order-delivery-reason]")?.value || "";
        if (status === "cancelled" && !payload.deliveryStatusReason.trim()) {
            payload.deliveryStatusReason = window.prompt("Cancel reason shown to customer:", "Order was cancelled by support.") || "";
            const input = card.querySelector("[data-order-delivery-reason]");
            if (input) input.value = payload.deliveryStatusReason;
        }
    }

    const result = await adminRequest(payload);
    state.orders = state.orders.map((order) => (order.id === result.order.id ? result.order : order));
    renderAdminOrders();
    showToast("Order updated");
}

async function saveAdminOrderDelivery(orderId) {
    const card = [...document.querySelectorAll("[data-admin-order-id]")].find((item) => item.dataset.adminOrderId === orderId);
    if (!card) return;

    const deliveryText = card.querySelector("[data-order-delivery-text]")?.value || "";
    const result = await adminRequest({
        action: "admin-save-delivery",
        orderId,
        deliveryText,
    });

    state.orders = state.orders.map((order) => (order.id === result.order.id ? result.order : order));
    renderAdminOrders();
    showToast("Delivery details saved");
}

function bindEvents() {
    document.getElementById("productSearch")?.addEventListener("input", () => updateProductFiltersFromControls("desktop"));
    document.getElementById("productCategoryFilter")?.addEventListener("change", () => updateProductFiltersFromControls("desktop"));
    document.getElementById("productStatusFilter")?.addEventListener("change", () => updateProductFiltersFromControls("desktop"));
    document.getElementById("mobileCatalogSearch")?.addEventListener("input", () => updateProductFiltersFromControls("mobile"));
    document.getElementById("mobileCatalogCategoryFilter")?.addEventListener("change", () => updateProductFiltersFromControls("mobile"));
    document.getElementById("mobileCatalogStatusFilter")?.addEventListener("change", () => updateProductFiltersFromControls("mobile"));
    document.getElementById("mobileProductSelect")?.addEventListener("change", (event) => {
        selectProduct(event.target.value);
        renderAll();
    });
    document.getElementById("newProductButton")?.addEventListener("click", createNewProduct);
    document.getElementById("deleteProductButton")?.addEventListener("click", deleteProduct);
    document.getElementById("addVariationButton")?.addEventListener("click", addVariation);
    document.getElementById("addCategoryButton")?.addEventListener("click", addCategory);
    document.getElementById("resetFormButton")?.addEventListener("click", fillForm);
    document.getElementById("syncDatabaseButton")?.addEventListener("click", () => {
        syncDatabaseToApi()
            .then(() => showToast("Saved products and categories to database"))
            .catch((error) => showToast(error.message || "Could not save to database"));
    });
    document.getElementById("syncSettingsButton")?.addEventListener("click", () => {
        syncSettingsToApi()
            .then(() => showToast("Saved settings to database"))
            .catch((error) => showToast(error.message || "Could not save settings to database"));
    });
    document.getElementById("downloadJsonButton")?.addEventListener("click", downloadJson);
    document.getElementById("copyJsonButton")?.addEventListener("click", copyJson);
    document.getElementById("copyJsonButtonSecondary")?.addEventListener("click", copyJson);
    document.getElementById("jsonImport")?.addEventListener("change", () => showSelectedFileMessage("jsonImport", "Import products"));
    document.getElementById("importJsonButton")?.addEventListener("click", () => {
        Promise.resolve()
            .then(() => importJson(getSelectedImportFile("jsonImport", "catalog JSON file")))
            .catch((error) => showToast(error.message || "Could not import catalog from file"));
    });
    document.getElementById("csvImport")?.addEventListener("change", () => showSelectedFileMessage("csvImport", "Import CSV"));
    document.getElementById("importCsvButton")?.addEventListener("click", () => {
        Promise.resolve()
            .then(() => importCsv(getSelectedImportFile("csvImport", "products CSV")))
            .catch((error) => showToast(error.message || "Could not import products CSV"));
    });
    document.getElementById("exportProductsCsvButton")?.addEventListener("click", exportProductsCsv);
    document.getElementById("downloadCsvTemplateButton")?.addEventListener("click", downloadCsvTemplate);
    document.getElementById("downloadSettingsButton")?.addEventListener("click", downloadSettingsJson);
    document.getElementById("settingsImport")?.addEventListener("change", () => showSelectedFileMessage("settingsImport", "Import settings"));
    document.getElementById("importSettingsButton")?.addEventListener("click", () => {
        Promise.resolve()
            .then(() => importSettingsJson(getSelectedImportFile("settingsImport", "settings JSON file")))
            .catch((error) => showToast(error.message || "Could not import settings from file"));
    });
    document.getElementById("productPhotoFile")?.addEventListener("change", (event) => handlePhotoFile(event.target.files[0]));
    document.getElementById("productImage")?.addEventListener("input", () => {
        updateImagePreview();
        renderPreview();
    });
    document.getElementById("productName")?.addEventListener("input", (event) => {
        const name = event.target.value || "";
        const idInput = document.getElementById("productId");
        if (!idInput) return;
        const currentId = idInput.value.trim();
        if (!currentId || !state.originalId) {
            lastProductNameSlug = slugify(name);
            idInput.value = lastProductNameSlug;
        }
    });
    document.getElementById("productName")?.addEventListener("blur", (event) => {
        const name = event.target.value || "";
        const idInput = document.getElementById("productId");
        if (!idInput) return;
        const currentId = idInput.value.trim();
        if (!currentId || currentId === slugify(name) || currentId === lastProductNameSlug) {
            lastProductNameSlug = slugify(name);
            idInput.value = lastProductNameSlug;
        }
    });
    document.getElementById("addCustomerInputButton")?.addEventListener("click", () => addCustomerInput());
    document.getElementById("productCustomerInputs")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-customer-input]");
        if (!button) return;
        removeCustomerInput(Number(button.dataset.removeCustomerInput));
    });
    document.getElementById("productCustomerInputs")?.addEventListener("input", (event) => {
        const input = event.target.closest("[data-customer-input-field]");
        if (!input) return;
        const row = input.closest("[data-customer-input-index]");
        if (!row) return;
        const index = Number(row.dataset.customerInputIndex);
        state.draftCustomerInputs[index] = input.value.slice(0, 80);
        renderPreview();
        markProductDirty();
    });
    document.getElementById("loadOrdersButton")?.addEventListener("click", () => {
        loadAdminOrders().catch((error) => showToast(error.message || "Could not load orders"));
    });
    document.getElementById("adminOrderSearch")?.addEventListener("input", (event) => {
        state.orderFilters.search = event.target.value || "";
        renderAdminOrders();
    });
    document.getElementById("adminOrderDateFrom")?.addEventListener("change", (event) => {
        state.orderFilters.dateFrom = event.target.value || "";
        renderAdminOrders();
    });
    document.getElementById("adminOrderDateTo")?.addEventListener("change", (event) => {
        state.orderFilters.dateTo = event.target.value || "";
        renderAdminOrders();
    });
    document.getElementById("adminPaymentFilter")?.addEventListener("change", (event) => {
        state.orderFilters.payment = event.target.value || "";
        renderAdminOrders();
    });
    document.getElementById("adminDeliveryFilter")?.addEventListener("change", (event) => {
        state.orderFilters.delivery = event.target.value || "";
        renderAdminOrders();
    });

    document.getElementById("adminOrderStatusFilters")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-order-workflow-filter]");
        if (!button) return;
        state.orderFilters.workflow = button.dataset.orderWorkflowFilter || "";
        document.querySelectorAll("[data-order-workflow-filter]").forEach((filterButton) => {
            filterButton.classList.toggle("active", filterButton === button);
            filterButton.classList.toggle("btn-primary", filterButton === button);
            filterButton.classList.toggle("btn-outline-dark", filterButton !== button);
        });
        renderAdminOrders();
    });

    document.querySelectorAll("#paymentsPane input, #paymentsPane textarea").forEach((input) => {
        input.addEventListener("input", saveSettingsFromForm);
        input.addEventListener("change", saveSettingsFromForm);
    });

    document.querySelectorAll("[data-settings-field]").forEach((input) => {
        input.addEventListener("input", saveSettingsFromForm);
        input.addEventListener("change", saveSettingsFromForm);
    });

    document.getElementById("productList")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-select-product]");
        if (!button) return;
        selectProduct(button.dataset.selectProduct);
        renderAll();
    });

    document.getElementById("mobileProductList")?.addEventListener("click", (event) => {
        const actionButton = event.target.closest("[data-mobile-product-action]");
        if (actionButton) {
            const productId = actionButton.dataset.productActionId;
            const action = actionButton.dataset.mobileProductAction;
            if (!productId || !getProducts()[productId]) return;

            if (action === "toggle-visibility") {
                toggleProductVisibility(productId);
            } else if (action === "duplicate") {
                selectProduct(productId);
                duplicateProduct();
                closeMobileProductCatalog();
            } else if (action === "delete") {
                selectProduct(productId);
                deleteProduct();
                closeMobileProductCatalog();
            }
            return;
        }

        const selectButton = event.target.closest("[data-select-mobile-product]");
        if (!selectButton) return;
        selectProduct(selectButton.dataset.selectMobileProduct);
        renderAll();
        closeMobileProductCatalog();
    });

    document.getElementById("variationList")?.addEventListener("input", (event) => {
        const input = event.target.closest("[data-variation-field]");
        if (!input) return;
        const row = input.closest("[data-variation-index]");
        updateVariation(Number(row.dataset.variationIndex), input.dataset.variationField, input.value);
    });

    document.getElementById("variationList")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-variation]");
        if (!button) return;
        removeVariation(Number(button.dataset.removeVariation));
    });

    document.getElementById("categoryEditorList")?.addEventListener("input", (event) => {
        const input = event.target.closest("[data-category-field]");
        if (!input) return;
        const row = input.closest("[data-category-index]");
        const value = input.type === "checkbox" ? input.checked : input.value;
        updateCategory(Number(row.dataset.categoryIndex), input.dataset.categoryField, value);
    });

    document.getElementById("categoryEditorList")?.addEventListener("click", (event) => {
        const moveButton = event.target.closest("[data-move-category]");
        if (moveButton) {
            moveCategory(Number(moveButton.dataset.moveCategory), Number(moveButton.dataset.categoryDirection));
            return;
        }

        const button = event.target.closest("[data-remove-category]");
        if (!button) return;
        removeCategory(Number(button.dataset.removeCategory));
    });

    document.getElementById("productForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        try {
            saveProduct();
        } catch (error) {
            showToast(error.message || "Could not save product");
        }
    });

    document.getElementById("productForm")?.addEventListener("input", () => {
        renderPreview();
        markProductDirty();
    });

    document.querySelectorAll("#adminWorkspaceTabs [data-bs-toggle='pill']").forEach((tab) => {
        tab.addEventListener("shown.bs.tab", () => {
            tab.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        });
    });

    window.addEventListener("resize", syncResponsiveAdminLayout);

    document.getElementById("adminOrdersList")?.addEventListener("click", (event) => {
        const quickActionButton = event.target.closest("[data-quick-order-action]");
        if (quickActionButton) {
            quickUpdateAdminOrder(quickActionButton.dataset.quickOrderId, quickActionButton.dataset.quickOrderAction).catch((error) =>
                showToast(error.message || "Could not update order"),
            );
            return;
        }

        const saveDeliveryButton = event.target.closest("[data-save-order-delivery]");
        if (saveDeliveryButton) {
            saveAdminOrderDelivery(saveDeliveryButton.dataset.saveOrderDelivery).catch((error) =>
                showToast(error.message || "Could not save delivery details"),
            );
            return;
        }

        const updateButton = event.target.closest("[data-update-order-status]");
        if (updateButton) {
            updateAdminOrderStatus(updateButton.dataset.updateOrderStatus).catch((error) =>
                showToast(error.message || "Could not update order"),
            );
            return;
        }

        const copyButton = event.target.closest("[data-copy-admin-text]");
        if (copyButton) {
            const value = copyButton.dataset.copyAdminText || "";
            navigator.clipboard
                ?.writeText(value)
                .then(() => showToast("Copied"))
                .catch(() => showToast(value));
            return;
        }

        const deleteButton = event.target.closest("[data-delete-order]");
        if (deleteButton) {
            const orderId = deleteButton.dataset.deleteOrder;
            if (!orderId) return;
            if (!window.confirm(`Delete ${orderId}? This will permanently remove the order.`)) return;
            adminRequest({ action: "admin-delete-order", orderId })
                .then(() => {
                    state.orders = state.orders.filter((o) => o.id !== orderId);
                    renderAdminOrders();
                    showToast("Order deleted");
                })
                .catch((error) => showToast(error.message || "Could not delete order"));
            return;
        }
    });

    document.getElementById("adminUnlockForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const token = document.getElementById("adminLockToken")?.value.trim();
        if (!token) return;
        unlockAdminPanel(token);
    });

    document.getElementById("lockAdminButton")?.addEventListener("click", () => {
        lockAdminPanel();
    });

    document.getElementById("uploadToGitHubButton")?.addEventListener("click", async () => {
        const fileInput = document.getElementById("productPhotoFile");
        if (!fileInput?.files?.[0]) {
            showToast("Select a photo file first");
            return;
        }
        const file = fileInput.files[0];
        const statusEl = document.getElementById("uploadStatus");
        if (statusEl) statusEl.textContent = "Uploading to GitHub...";
        try {
            const result = await uploadToGitHub(file);
            const pathInput = document.getElementById("productImage");
            if (pathInput) pathInput.value = result.path;
            updateImagePreview();
            renderPreview();
            markProductDirty();
            if (statusEl) statusEl.innerHTML = `<span class="text-success"><i class="bi bi-check-circle me-1"></i>Uploaded: ${result.path}</span>`;
            showToast("Image uploaded to GitHub");
        } catch (error) {
            if (statusEl) statusEl.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(error.message)}</span>`;
            showToast(error.message || "Upload failed");
        }
    });

}

bindEvents();

function initAdminPanel() {
    syncResponsiveAdminLayout();
    loadDatabase();
    loadSettings();
}

// start locked; check if already verified this session
(async () => {
    const alreadyUnlocked = sessionStorage.getItem("hyperkey-admin-unlocked");
    const savedToken = getAdminToken();
    if (alreadyUnlocked && savedToken) {
        const valid = await verifyAdminToken();
        if (valid) {
            showAdminContent();
            initAdminPanel();
            return;
        }
        sessionStorage.removeItem("hyperkey-admin-unlocked");
    }
    showLockScreen();
})();

