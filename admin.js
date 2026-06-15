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

const ADMIN_TOKEN_KEY = "hyperkey-admin-token";
const ORDER_API_URL = window.GAMEVAULT_ORDER_API_URL || "";

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
    previewImages: {},
    orders: [],
    orderFilters: {
        search: "",
        payment: "",
        delivery: "",
    },
};

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
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

function setDatabase(database) {
    state.database = {
        currency: database.currency || "TND",
        categories: Array.isArray(database.categories) ? database.categories : [],
        routes: database.routes && typeof database.routes === "object" ? database.routes : {},
        products: database.products && typeof database.products === "object" ? database.products : {},
    };

    const firstProduct = Object.keys(state.database.products)[0] || "";
    selectProduct(firstProduct);
    renderAll();
}

async function loadDatabase() {
    try {
        const response = await fetch(`products.json?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load products.json");
        setDatabase(await response.json());
        showToast("Loaded products.json");
    } catch (error) {
        renderAll();
        showToast(error.message || "Could not load products.json");
    }
}

function setSettings(settings) {
    state.settings = mergePaymentSettings(settings);
    fillSettingsForm();
}

async function loadSettings() {
    try {
        const response = await fetch(`settings.json?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load settings.json");
        setSettings(await response.json());
    } catch (error) {
        setSettings(DEFAULT_PAYMENT_SETTINGS);
        showToast(error.message || "Using default payment settings");
    }
}

function renderAll() {
    renderCategoryEditor();
    renderCategoryOptions();
    renderArtOptions();
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
                  (category, index) => `
                    <div class="admin-category-row" data-category-index="${index}">
                        <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                            <strong>${escapeHtml(category.label || category.name || `Category ${index + 1}`)}</strong>
                            <button class="btn btn-outline-danger btn-sm" type="button" data-remove-category="${index}" aria-label="Remove category">
                                <i class="bi bi-trash"></i>
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
                                <label class="form-label">Icon</label>
                                <input class="form-control form-control-sm" data-category-field="icon" value="${escapeHtml(category.icon || "bi-box")}" />
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
                `,
              )
              .join("")
        : `<div class="empty-state py-3"><p class="text-secondary mb-0">No categories yet.</p></div>`;
}

function renderCategoryOptions() {
    const categorySelect = document.getElementById("productCategory");
    if (!categorySelect) return;

    const currentValue = categorySelect.value;
    const categories = getCategories();
    categorySelect.innerHTML = categories.length
        ? categories
              .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.label || category.name)}</option>`)
              .join("")
        : `<option value="">Add a category first</option>`;
    categorySelect.value = currentValue || categorySelect.options[0]?.value || "";
}

function renderArtOptions() {
    const artSelect = document.getElementById("productArt");
    if (!artSelect) return;

    const currentValue = artSelect.value;
    artSelect.innerHTML = ART_STYLES.map((art) => `<option value="${escapeHtml(art)}">${escapeHtml(art)}</option>`).join("");
    artSelect.value = currentValue || ART_STYLES[0];
}

function renderProductList() {
    const list = document.getElementById("productList");
    const search = document.getElementById("productSearch")?.value.trim().toLowerCase() || "";
    if (!list) return;

    const entries = getProductEntries().filter(([id, product]) => {
        const haystack = `${id} ${product.name || ""} ${product.category || ""}`.toLowerCase();
        return haystack.includes(search);
    });

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
                            <small>${escapeHtml(id)} · ${escapeHtml(product.category || "Digital")}</small>
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
}

function fillForm() {
    const product = getSelectedProduct();
    const isNew = !product;
    document.getElementById("editorTitle").textContent = isNew ? "New product" : product.name || state.selectedId;

    const productId = document.getElementById("productId");
    const productName = document.getElementById("productName");
    const productCategory = document.getElementById("productCategory");
    const productPrice = document.getElementById("productPrice");
    const productIcon = document.getElementById("productIcon");
    const productArt = document.getElementById("productArt");
    const productImage = document.getElementById("productImage");
    const productPhotoFile = document.getElementById("productPhotoFile");
    const productDescription = document.getElementById("productDescription");
    const productVisible = document.getElementById("productVisible");
    const productInStock = document.getElementById("productInStock");
    const productCustomerInputEnabled = document.getElementById("productCustomerInputEnabled");
    const productCustomerInputLabel = document.getElementById("productCustomerInputLabel");

    if (productId) productId.value = state.selectedId || "";
    if (productName) productName.value = product?.name || "";
    if (productCategory) productCategory.value = product?.category || productCategory.options[0]?.value || "";
    if (productPrice) productPrice.value = Number(product?.price ?? 0);
    if (productIcon) productIcon.value = product?.icon || "bi-box";
    if (productArt) productArt.value = product?.art || "gamekey-art";
    if (productImage) productImage.value = product?.image || "";
    if (productPhotoFile) productPhotoFile.value = "";
    if (productDescription) productDescription.value = product?.description || "";
    if (productVisible) productVisible.checked = product?.visible !== false;
    if (productInStock) productInStock.checked = product?.inStock !== false;
    if (productCustomerInputEnabled) productCustomerInputEnabled.checked = product?.customerInput?.enabled === true;
    if (productCustomerInputLabel) productCustomerInputLabel.value = product?.customerInput?.label || "Player ID";

    renderVariations();
    renderPreview();
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
}

function readFormProduct() {
    validateCategories();

    const id = document.getElementById("productId").value.trim();
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const price = Number(document.getElementById("productPrice").value || 0);
    const icon = document.getElementById("productIcon").value.trim() || "bi-box";
    const art = document.getElementById("productArt").value || "gamekey-art";
    const image = document.getElementById("productImage").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const visible = document.getElementById("productVisible").checked;
    const inStock = document.getElementById("productInStock")?.checked !== false;
    const defaultVariation = document.getElementById("defaultVariation").value;
    const customerInputEnabled = document.getElementById("productCustomerInputEnabled")?.checked || false;
    const customerInputLabel = (document.getElementById("productCustomerInputLabel")?.value.trim() || "Player ID").slice(0, 80);

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
        icon,
        art,
    };
    if (image) product.image = image;
    if (description) product.description = description;
    if (!visible) product.visible = false;
    if (!inStock) product.inStock = false;
    if (customerInputEnabled) {
        product.customerInput = {
            enabled: true,
            label: customerInputLabel || "Player ID",
        };
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

function saveProduct(options = {}) {
    const { id, product } = readFormProduct();
    const products = getProducts();
    if (state.originalId && state.originalId !== id) delete products[state.originalId];
    products[id] = product;
    selectProduct(id);
    renderAll();
    if (!options.silent) showToast("Product saved in editor");
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
}

function duplicateProduct() {
    const product = getSelectedProduct();
    if (!product) return;
    const baseId = `${state.selectedId || slugify(product.name)}-copy`;
    let nextId = baseId;
    let counter = 2;
    while (getProducts()[nextId]) {
        nextId = `${baseId}-${counter}`;
        counter += 1;
    }
    getProducts()[nextId] = {
        ...clone(product),
        name: `${product.name || "Product"} Copy`,
    };
    selectProduct(nextId);
    renderAll();
    showToast("Product duplicated");
}

function addCategory() {
    const name = getUniqueCategoryName();
    const id = slugify(name);
    getCategories().push({
        name,
        id,
        page: `products.html#${id}`,
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
    category[field] = value;

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
        category.page = String(category.page || `products.html#${category.id}`).trim();
        category.label = String(category.label || name).trim();
        category.icon = String(category.icon || "bi-box").trim();
        category.teaser = String(category.teaser || "").trim();
        category.heading = String(category.heading || category.label || name).trim();
        category.description = String(category.description || `Browse ${name.toLowerCase()} products.`).trim();
    });
}

function addVariation() {
    const label = `${state.database.currency || "TND"} option`;
    let id = slugify(label);
    let counter = 2;
    const existing = new Set(state.draftVariations.map((variation) => variation.id));
    while (existing.has(id)) {
        id = `${slugify(label)}-${counter}`;
        counter += 1;
    }
    state.draftVariations.push({
        id,
        label,
        name: document.getElementById("productName").value.trim() || "Product option",
        price: Number(document.getElementById("productPrice").value || 0),
    });
    renderVariations();
    renderPreview();
}

function updateVariation(index, field, value) {
    if (!state.draftVariations[index]) return;
    state.draftVariations[index][field] = field === "price" ? Number(value || 0) : value;
    renderPreview();
}

function removeVariation(index) {
    state.draftVariations.splice(index, 1);
    renderVariations();
    renderPreview();
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
                icon: document.getElementById("productIcon")?.value || "bi-box",
                art: document.getElementById("productArt")?.value || "gamekey-art",
                image: document.getElementById("productImage")?.value || "",
                description: document.getElementById("productDescription")?.value || "",
                inStock: document.getElementById("productInStock")?.checked !== false,
                customerInput: document.getElementById("productCustomerInputEnabled")?.checked
                    ? {
                          enabled: true,
                          label: document.getElementById("productCustomerInputLabel")?.value || "Player ID",
                      }
                    : undefined,
                variations: state.draftVariations,
            },
        };
    }
}

function renderPreview() {
    const preview = document.getElementById("adminPreviewCard");
    if (!preview) return;
    const { product } = getPreviewProduct();
    const firstVariation = product.variations?.[0];
    const price = firstVariation?.price ?? product.price ?? 0;
    const image = product.image ? state.previewImages[product.image] || product.image : "";

    preview.innerHTML = `
        <div class="product-art ${escapeHtml(product.art || "gamekey-art")}">
            ${
                image
                    ? `<img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name || "Product photo")}" />`
                    : `<i class="bi ${escapeHtml(product.icon || "bi-box")}"></i>`
            }
        </div>
        <div class="card-body">
            <span class="badge text-bg-dark mb-2">${escapeHtml(product.category || "Digital")}</span>
            ${product.inStock === false ? '<span class="badge text-bg-secondary mb-2 ms-1">Out of stock</span>' : ""}
            <h3 class="h5 fw-black">${escapeHtml(product.name || "New product")}</h3>
            <p class="text-secondary">${escapeHtml(product.description || "Product description")}</p>
            ${
                product.customerInput?.enabled
                    ? `<span class="badge text-bg-warning mb-3">${escapeHtml(product.customerInput.label || "Player ID")} required</span>`
                    : ""
            }
            <strong class="price">${money(price, state.database.currency)}</strong>
        </div>
    `;
}

function handlePhotoFile(file) {
    if (!file) return;
    const path = `assets/${safeAssetFileName(file.name)}`;
    const input = document.getElementById("productImage");
    if (input) input.value = path;
    if (state.previewImages[path]) URL.revokeObjectURL(state.previewImages[path]);
    state.previewImages[path] = URL.createObjectURL(file);
    renderPreview();
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
    const d17 = settings.payment.d17;
    const flouci = settings.payment.flouci;
    const ttCard = settings.payment["tt-card"];

    const fields = {
        d17Enabled: d17.enabled !== false,
        d17Instructions: d17.instructions,
        d17ProofLabel: d17.proofLabel,
        d17FeePercent: d17.feePercent,
        d17RoundUpToDecimal: d17.roundUpToDecimal,
        flouciEnabled: flouci.enabled !== false,
        flouciInstructions: flouci.instructions,
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
        payment: {
            d17: {
                enabled: checkedValue("d17Enabled"),
                label: "D17 transfer",
                instructions: textValue("d17Instructions", DEFAULT_PAYMENT_SETTINGS.payment.d17.instructions),
                proofLabel: textValue("d17ProofLabel", DEFAULT_PAYMENT_SETTINGS.payment.d17.proofLabel),
                feePercent: numberValue("d17FeePercent", DEFAULT_PAYMENT_SETTINGS.payment.d17.feePercent),
                roundUpToDecimal: numberValue("d17RoundUpToDecimal", DEFAULT_PAYMENT_SETTINGS.payment.d17.roundUpToDecimal),
            },
            flouci: {
                enabled: checkedValue("flouciEnabled"),
                label: "Flouci transfer",
                instructions: textValue("flouciInstructions", DEFAULT_PAYMENT_SETTINGS.payment.flouci.instructions),
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
    link.download = "products.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Downloaded products.json");
}

function downloadSettingsJson() {
    const blob = new Blob([getSettingsJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "settings.json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Downloaded settings.json");
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
    showToast("Imported settings.json");
}

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || document.getElementById("adminApiToken")?.value.trim() || "";
}

function setAdminToken(token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
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

function getDeliveryText(order) {
    return (order.deliveries || []).map((delivery) => delivery.text || "").filter(Boolean).join("\n\n");
}

function renderDeliveryControls(order) {
    const deliveryText = getDeliveryText(order);
    return `
        <div class="admin-delivery-box mt-3">
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

function getFilteredOrders() {
    const search = state.orderFilters.search.trim().toLowerCase();
    return state.orders.filter((order) => {
        if (state.orderFilters.payment && order.paymentStatus !== state.orderFilters.payment) return false;
        if (state.orderFilters.delivery && order.deliveryStatus !== state.orderFilters.delivery) return false;

        if (!search) return true;
        const haystack = [
            order.id,
            order.customerPhone,
            order.customerPhoneDisplay,
            order.paymentMethodLabel,
            order.paymentStatusLabel,
            order.deliveryStatusLabel,
            ...(order.items || []).map((item) => item.productName),
            ...(order.proofs || []).map((proof) => `${proof.label} ${proof.value}`),
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
            const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("en-TN") : "Not available";
            return `
                <article class="admin-order-card" data-admin-order-id="${escapeHtml(order.id)}">
                    <div class="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-3">
                        <div>
                            <p class="eyebrow mb-2">${escapeHtml(createdAt)}</p>
                            <h3 class="h4 fw-black mb-1">${escapeHtml(order.id)}</h3>
                            <p class="text-secondary mb-0">WhatsApp: ${escapeHtml(order.customerPhoneDisplay)}</p>
                        </div>
                        <div class="admin-order-actions">
                            <button class="btn btn-outline-dark btn-sm" type="button" data-copy-admin-text="${escapeHtml(order.customerPhone)}">
                                <i class="bi bi-clipboard me-1"></i>Copy phone
                            </button>
                            <button class="btn btn-outline-dark btn-sm" type="button" data-copy-admin-text="${escapeHtml(order.id)}">
                                <i class="bi bi-clipboard me-1"></i>Copy ID
                            </button>
                        </div>
                    </div>
                    <div class="status-grid mb-3">
                        <div>
                            <span>Payment</span>
                            ${statusBadge(order.paymentStatusLabel, order.paymentStatus)}
                        </div>
                        <div>
                            <span>Delivery</span>
                            ${statusBadge(order.deliveryStatusLabel, order.deliveryStatus)}
                        </div>
                        <div>
                            <span>Method</span>
                            <strong>${escapeHtml(order.paymentMethodLabel)}</strong>
                        </div>
                        <div>
                            <span>To verify</span>
                            <strong>${formatPlainTndAmount(order.amountDue)}</strong>
                        </div>
                    </div>
                    <div class="admin-order-grid">
                        <div>
                            <p class="form-label mb-2">Products</p>
                            ${renderOrderItems(order.items)}
                        </div>
                        <div>
                            <p class="form-label mb-2">Payment proof</p>
                            ${renderProofs(order.proofs)}
                        </div>
                    </div>
                    <div class="admin-status-controls mt-3">
                        <select class="form-select form-select-sm" data-order-payment-status>
                            <option value="pending" ${order.paymentStatus === "pending" ? "selected" : ""}>Payment pending</option>
                            <option value="verified" ${order.paymentStatus === "verified" ? "selected" : ""}>Payment verified</option>
                            <option value="rejected" ${order.paymentStatus === "rejected" ? "selected" : ""}>Payment rejected</option>
                        </select>
                        <select class="form-select form-select-sm" data-order-delivery-status>
                            <option value="waiting" ${order.deliveryStatus === "waiting" ? "selected" : ""}>Waiting delivery</option>
                            <option value="delivered" ${order.deliveryStatus === "delivered" ? "selected" : ""}>Delivered</option>
                            <option value="cancelled" ${order.deliveryStatus === "cancelled" ? "selected" : ""}>Cancelled</option>
                        </select>
                        <button class="btn btn-primary btn-sm" type="button" data-update-order-status="${escapeHtml(order.id)}">Save status</button>
                    </div>
                    ${renderDeliveryControls(order)}
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
    const result = await adminRequest({
        action: "admin-update-order",
        orderId,
        paymentStatus,
        deliveryStatus,
    });

    state.orders = state.orders.map((order) => (order.id === result.order.id ? result.order : order));
    renderAdminOrders();
    showToast("Order status updated");
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
    document.getElementById("productSearch")?.addEventListener("input", renderProductList);
    document.getElementById("newProductButton")?.addEventListener("click", createNewProduct);
    document.getElementById("duplicateProductButton")?.addEventListener("click", duplicateProduct);
    document.getElementById("deleteProductButton")?.addEventListener("click", deleteProduct);
    document.getElementById("addVariationButton")?.addEventListener("click", addVariation);
    document.getElementById("addCategoryButton")?.addEventListener("click", addCategory);
    document.getElementById("resetFormButton")?.addEventListener("click", fillForm);
    document.getElementById("downloadJsonButton")?.addEventListener("click", downloadJson);
    document.getElementById("copyJsonButton")?.addEventListener("click", copyJson);
    document.getElementById("jsonImport")?.addEventListener("change", (event) => importJson(event.target.files[0]));
    document.getElementById("downloadSettingsButton")?.addEventListener("click", downloadSettingsJson);
    document.getElementById("settingsImport")?.addEventListener("change", (event) => importSettingsJson(event.target.files[0]));
    document.getElementById("productPhotoFile")?.addEventListener("change", (event) => handlePhotoFile(event.target.files[0]));
    document.getElementById("saveAdminTokenButton")?.addEventListener("click", () => {
        const token = document.getElementById("adminApiToken")?.value.trim() || "";
        if (!token) {
            showToast("Enter the admin token");
            return;
        }
        setAdminToken(token);
        showToast("Admin token saved for this tab");
    });
    document.getElementById("loadOrdersButton")?.addEventListener("click", () => {
        loadAdminOrders().catch((error) => showToast(error.message || "Could not load orders"));
    });
    document.getElementById("adminOrderSearch")?.addEventListener("input", (event) => {
        state.orderFilters.search = event.target.value || "";
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

    document.querySelectorAll(".admin-settings-list .admin-setting-group input, .admin-settings-list .admin-setting-group textarea").forEach((input) => {
        input.addEventListener("input", saveSettingsFromForm);
        input.addEventListener("change", saveSettingsFromForm);
    });

    document.getElementById("productList")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-select-product]");
        if (!button) return;
        selectProduct(button.dataset.selectProduct);
        renderAll();
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
        updateCategory(Number(row.dataset.categoryIndex), input.dataset.categoryField, input.value);
    });

    document.getElementById("categoryEditorList")?.addEventListener("click", (event) => {
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
    });

    document.getElementById("adminOrdersList")?.addEventListener("click", (event) => {
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
        }
    });
}

bindEvents();
const savedAdminToken = getAdminToken();
if (savedAdminToken) {
    const tokenInput = document.getElementById("adminApiToken");
    if (tokenInput) tokenInput.value = savedAdminToken;
}
loadDatabase();
loadSettings();
