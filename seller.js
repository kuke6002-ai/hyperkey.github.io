const SLR_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const SLR_SESSION_KEY = "hyperkey-seller-session";
let slrMinWithdrawal = 0;
let slrEditProductId = null;
let slrProducts = [];
let slrSellerDisplayName = "";
const slrProductEditor = {
    originalProduct: null,
    variations: [],
    customerInputs: [],
    selectedFile: null,
    previewUrl: "",
    dirty: false,
    uploadId: 0,
};

function cloneSlrValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

/* ── Utilities ────────────────────────────── */

function getSlrSession() {
    try {
        const result = JSON.parse(sessionStorage.getItem(SLR_SESSION_KEY));
        return result && result.token ? result : null;
    } catch { return null; }
}

function saveSlrSession(data) {
    sessionStorage.setItem(SLR_SESSION_KEY, JSON.stringify(data));
}

function clearSlrSession() {
    sessionStorage.removeItem(SLR_SESSION_KEY);
}

function slrEscape(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slrMoney(amount) {
    const n = Number(amount || 0).toFixed(3);
    return typeof CURRENT_LANGUAGE !== "undefined" && CURRENT_LANGUAGE === "ar" ? `TND ${n}` : `${n} TND`;
}

function slrT(text) {
    return typeof t === "function" ? t(text) : text;
}

function slrTranslateError(msg) {
    const exact = slrT(msg);
    if (exact !== msg) return exact;
    const minWd = msg.match(/^(Minimum withdrawal is TND )([\d.]+)$/);
    if (minWd) return slrT("Minimum withdrawal is") + " TND " + minWd[2];
    const insuff = msg.match(/^(Insufficient pending earnings\. Available: )([\d.]+)( TND)$/);
    if (insuff) return slrT("Insufficient pending commissions. Available:") + " " + insuff[2] + " TND";
    const variationError = msg.match(/^(Variation ID is invalid:|Duplicate variation ID:|Variation name is required:|Variation price is invalid:)\s*(.+)$/);
    if (variationError) return `${slrT(variationError[1])} ${variationError[2]}`;
    return msg;
}

function slrToast(message, type) {
    const container = document.getElementById("slrToastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `aff-toast aff-toast--${type || "info"}`;
    el.textContent = slrTranslateError(message);
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("aff-toast--show"));
    setTimeout(() => {
        el.classList.remove("aff-toast--show");
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

/* ── API calls ─────────────────────────────── */

async function loginSeller(phone, password) {
    const response = await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-login", phone, password }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Login failed");
    return result;
}

async function loadSellerStats(token) {
    const response = await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-stats", token }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not load stats");
    return result;
}

async function logoutSeller(token) {
    await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-logout", token }),
    });
}

async function requestSellerPayout(token, amount, method, recipientDetail) {
    const response = await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-request-payout", token, amount, method, recipientDetail }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Payout request failed");
    return result;
}

async function saveSellerProduct(token, product) {
    const response = await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-product-save", token, ...product }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not save product");
    return result;
}

async function uploadSellerProductImage(token, file) {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type)) throw new Error(slrT("Choose a PNG, JPG, or WebP image."));
    if (file.size > 4 * 1024 * 1024) throw new Error(slrT("Image must be 4 MB or smaller."));

    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = () => reject(new Error(slrT("Could not read image")));
        reader.readAsDataURL(file);
    });
    const response = await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-upload-image", token, base64 }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || slrT("Could not upload image"));
    return result.path;
}

async function deleteSellerProduct(token, productId) {
    const response = await fetch(SLR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seller-product-delete", token, productId }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not delete product");
    return result;
}

/* ── Dashboard rendering ──────────────────── */

function renderSellerDashboard(data) {
    const seller = data.seller;
    const stats = data.stats;
    const products = data.products || [];
    const recentOrders = data.recentOrders || [];
    const earnings = data.earnings || [];
    const payouts = data.payouts || [];

    slrProducts = products;
    slrSellerDisplayName = seller.displayName || seller.name || "Seller";
    document.getElementById("sellerGreeting").textContent = `Welcome, ${slrEscape(seller.name || seller.displayName)}.`;

    document.getElementById("slrTotalOrders").textContent = stats.totalOrders;
    document.getElementById("slrTotalRevenue").textContent = slrMoney(stats.totalRevenue);
    document.getElementById("slrPendingEarnings").textContent = slrMoney(stats.pendingEarnings);
    document.getElementById("slrPaidEarnings").textContent = slrMoney(stats.paidEarnings);

    const avail = Number(stats.currentBalance || 0);
    document.getElementById("slrPayoutBalance").textContent = slrMoney(Math.max(0, avail));

    slrMinWithdrawal = data.minimumWithdrawal || 0;
    const minEl = document.getElementById("slrMinWithdrawalDisplay");
    if (minEl) minEl.textContent = slrMoney(slrMinWithdrawal);
    const minLabel = document.getElementById("slrMinWithdrawalLabel");
    if (minLabel) minLabel.textContent = slrT("Minimum withdrawal:");

    if (typeof t === "function") {
        document.querySelectorAll("#sellerStatsCards .aff-stat-card__label").forEach((el) => {
            const key = el.textContent.trim();
            const translated = t(key);
            if (translated !== key) el.textContent = translated;
        });
    }

    /* Products list */
    renderSlrProducts(products);

    /* Orders list */
    const ordersEl = document.getElementById("slrOrdersList");
    if (!recentOrders.length) {
        ordersEl.innerHTML = `<div class="aff-empty"><div class="aff-empty-icon"><i class="bi bi-inbox"></i></div><p class="fw-bold mb-1">No orders yet</p><p class="text-secondary small mb-0">Orders containing your products will appear here.</p></div>`;
    } else {
        ordersEl.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm aff-table">
                    <thead><tr><th>${slrT("Order")}</th><th>${slrT("Payment")}</th><th>${slrT("Delivery")}</th><th>${slrT("Items")}</th><th>${slrT("Date")}</th></tr></thead>
                    <tbody>
                        ${recentOrders.map((o) => `
                            <tr>
                                <td><code class="aff-order-id">${slrEscape(o.id)}</code></td>
                                <td>${slrStatusBadge(o.paymentStatus || "-")}</td>
                                <td>${slrStatusBadge(o.deliveryStatus || "-")}</td>
                                <td>${(o.items || []).map((i) => slrEscape(i.product_name || i.product_id)).join(", ")}</td>
                                <td class="text-secondary small">${new Date(o.createdAt).toLocaleDateString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    /* Earnings history */
    renderSlrEarnings(earnings);

    /* Payouts history */
    renderSlrPayouts(payouts);
}

function slrStatusBadge(status) {
    const s = String(status || "").toLowerCase();
    let tone = "neutral";
    if (["delivered", "paid", "verified"].some((x) => s.includes(x))) tone = "good";
    else if (["cancelled", "canceled", "rejected"].some((x) => s.includes(x))) tone = "bad";
    else if (["pending", "waiting", "manual", "delivering"].some((x) => s.includes(x))) tone = "pending";
    const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : status;
    return `<strong class="status-badge status-${tone}"><span class="status-dot" aria-hidden="true"></span>${slrEscape(slrT(label))}</strong>`;
}

/* ── Products ────────────────────────────────── */

function renderSlrProducts(products) {
    const el = document.getElementById("slrProductsList");
    if (!products.length) {
        el.innerHTML = `<div class="aff-empty"><div class="aff-empty-icon"><i class="bi bi-box"></i></div><p class="fw-bold mb-1">No products yet</p><p class="text-secondary small mb-0">Add your first product to start selling.</p></div>`;
        return;
    }
    el.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm aff-table">
                <thead><tr><th>Product</th><th>Price</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                    ${products.map((p) => `
                        <tr>
                            <td>${slrEscape(p.name)} <small class="text-secondary">(${slrEscape(p.id)})</small></td>
                            <td class="fw-bold">${slrMoney(p.price)}</td>
                            <td>${p.visible ? '<span class="badge text-bg-success aff-badge">Visible</span>' : '<span class="badge text-bg-secondary aff-badge">Hidden</span>'} ${p.inStock ? "" : '<span class="badge text-bg-warning aff-badge">Out of stock</span>'}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" type="button" data-slr-edit-product="${slrEscape(p.id)}">Edit</button>
                                <button class="btn btn-sm btn-outline-danger" type="button" data-slr-delete-product="${slrEscape(p.id)}">Del</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function openSlrProductModal(product) {
    slrEditProductId = product ? product.id : null;
    slrProductEditor.originalProduct = product ? cloneSlrValue(product) : null;
    slrProductEditor.variations = Array.isArray(product?.variations) ? cloneSlrValue(product.variations) : [];
    const customerInput = product?.customerInput || {};
    slrProductEditor.customerInputs = Array.isArray(customerInput.labels)
        ? [...customerInput.labels]
        : (customerInput.label ? [customerInput.label] : []);
    slrProductEditor.selectedFile = null;
    if (slrProductEditor.previewUrl) URL.revokeObjectURL(slrProductEditor.previewUrl);
    slrProductEditor.previewUrl = "";

    document.getElementById("slrProductModalTitle").textContent = slrT(product ? "Edit marketplace product" : "New marketplace product");
    const idInput = document.getElementById("slrProductId");
    idInput.value = product?.id || "";
    idInput.readOnly = Boolean(product);
    document.getElementById("slrProductName").value = product?.name || "";
    document.getElementById("slrProductPrice").value = Number(product?.price ?? 0);
    document.getElementById("slrProductShortDesc").value = product?.shortDescription || "";
    document.getElementById("slrProductDesc").value = product?.description || "";
    document.getElementById("slrProductImage").value = product?.image || "assets/hyperlogo.png";
    document.getElementById("slrProductPhotoFile").value = "";
    document.getElementById("slrProductUploadStatus").textContent = "";
    document.getElementById("slrProductVisible").checked = product?.visible !== false;
    document.getElementById("slrProductInStock").checked = product?.inStock !== false;
    document.getElementById("slrProductCustomerInput").checked = customerInput.enabled === true;
    document.getElementById("slrProductCustomerInputFields").classList.toggle("d-none", customerInput.enabled !== true);
    document.getElementById("slrProductFormError").classList.add("d-none");
    renderSlrCustomerInputs();
    renderSlrVariations(product?.defaultVariation || "");
    updateSlrImagePreview();
    renderSlrProductPreview();
    setSlrProductDirty(false);
    if (typeof translateElement === "function") translateElement(document.getElementById("slrProductModal"));
    if (window.matchMedia("(max-width: 767.98px)").matches) {
        document.querySelectorAll("#slrProductForm .admin-editor-details").forEach((section, index) => {
            section.open = index === 0;
        });
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("slrProductModal")).show();
}

function slrSlugify(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function regenerateSlrVariationIds() {
    const productId = slrSlugify(document.getElementById("slrProductName")?.value) || "product";
    const defaultSelect = document.getElementById("slrDefaultVariation");
    const selectedIndex = slrProductEditor.variations.findIndex((variation) => variation.id === defaultSelect?.value);
    const usedIds = new Set();

    slrProductEditor.variations.forEach((variation, index) => {
        const variationId = slrSlugify(variation.label || variation.name || `option-${index + 1}`) || `option-${index + 1}`;
        const baseId = `${productId}-${variationId}`.slice(0, 80).replace(/-+$/g, "");
        let id = baseId;
        let suffix = 2;
        while (usedIds.has(id)) {
            const suffixText = `-${suffix++}`;
            id = `${baseId.slice(0, 80 - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
        }
        variation.id = id;
        usedIds.add(id);
    });

    if (!defaultSelect) return;
    slrProductEditor.variations.forEach((variation, index) => {
        const option = defaultSelect.options[index + 1];
        if (option) option.value = variation.id;
    });
    defaultSelect.value = selectedIndex >= 0 ? slrProductEditor.variations[selectedIndex].id : "";
}

function installSlrProductEditor() {
    const modal = document.getElementById("slrProductModal");
    if (!modal) return;
    const dialog = modal.querySelector(".modal-dialog");
    dialog.className = "modal-dialog modal-xl modal-dialog-scrollable slr-product-modal-dialog";
    dialog.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div><p class="eyebrow mb-1">Marketplace editor</p><h2 class="modal-title h4 mb-0" id="slrProductModalTitle">New marketplace product</h2></div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body slr-product-modal-body">
                <div class="slr-product-editor-layout">
                    <form id="slrProductForm" class="content-panel admin-panel admin-product-editor" novalidate>
                        <details class="admin-form-section admin-editor-details" open>
                            <summary><span class="admin-section-heading"><span class="admin-step">1</span><span><h3 class="h6 mb-1">Basic information</h3><small class="text-secondary">Product identity, price, and description</small></span></span><i class="bi bi-chevron-down"></i></summary>
                            <div class="admin-form-section-body">
                                <div class="row g-3">
                                    <input id="slrProductId" type="hidden" />
                                    <div class="col-12"><label class="form-label" for="slrProductName">Product name</label><input class="form-control" id="slrProductName" maxlength="120" required /></div>
                                    <div class="col-md-8"><label class="form-label" for="slrProductShortDesc">Category</label><input class="form-control" id="slrProductShortDesc" maxlength="180" /></div>
                                    <div class="col-md-4"><label class="form-label" for="slrProductPrice">Base price (TND)</label><input class="form-control" id="slrProductPrice" type="number" min="0" step="0.001" required /></div>
                                    <div class="col-12"><label class="form-label" for="slrProductDesc">Description</label><textarea class="form-control" id="slrProductDesc" rows="4" maxlength="5000"></textarea></div>
                                </div>
                            </div>
                        </details>
                        <details class="admin-form-section admin-editor-details" open>
                            <summary><span class="admin-section-heading"><span class="admin-step">2</span><span><h3 class="h6 mb-1">Display and image</h3><small class="text-secondary">Upload the image shown in the marketplace</small></span></span><i class="bi bi-chevron-down"></i></summary>
                            <div class="admin-form-section-body">
                                <div class="row g-3 align-items-start">
                                    <div class="col-lg-7"><label class="form-label" for="slrProductImage">Photo path</label><input class="form-control" id="slrProductImage" value="assets/hyperlogo.png" readonly /><div class="form-text">Choose an image and upload it before saving.</div><input class="form-control mt-3" id="slrProductPhotoFile" type="file" accept="image/png,image/jpeg,image/webp" /><button class="btn btn-outline-primary mt-2" id="slrUploadProductImageButton" type="button"><i class="bi bi-cloud-arrow-up me-1"></i>Upload image</button><div class="small text-secondary mt-2" id="slrProductUploadStatus"></div></div>
                                    <div class="col-lg-5"><div class="slr-image-preview" id="slrProductImagePreview"><img id="slrProductImagePreviewImg" alt="Product image preview" /></div></div>
                                </div>
                            </div>
                        </details>
                        <details class="admin-form-section admin-editor-details" open>
                            <summary><span class="admin-section-heading"><span class="admin-step">3</span><span><h3 class="h6 mb-1">Availability and customer input</h3><small class="text-secondary">Publishing, stock, and checkout requirements</small></span></span><i class="bi bi-chevron-down"></i></summary>
                            <div class="admin-form-section-body">
                                <div class="row g-3">
                                    <div class="col-md-6"><div class="form-check form-switch admin-switch"><input class="form-check-input" id="slrProductVisible" type="checkbox" checked /><label class="form-check-label" for="slrProductVisible">Visible in marketplace</label></div></div>
                                    <div class="col-md-6"><div class="form-check form-switch admin-switch"><input class="form-check-input" id="slrProductInStock" type="checkbox" checked /><label class="form-check-label" for="slrProductInStock">In stock</label></div></div>
                                    <div class="col-12"><div class="admin-setting-group product-customer-input"><div class="form-check form-switch admin-switch"><input class="form-check-input" id="slrProductCustomerInput" type="checkbox" /><label class="form-check-label" for="slrProductCustomerInput">Require customer information</label></div><div class="p-3 d-none" id="slrProductCustomerInputFields"><div class="admin-variation-list mb-3" id="slrProductCustomerInputs"></div><div class="admin-inline-control"><input class="form-control" id="slrProductCustomerNewInput" maxlength="80" placeholder="Player ID, email, account name..." /><button class="btn btn-outline-primary" id="slrAddCustomerInputButton" type="button">Add field</button></div></div></div></div>
                                </div>
                            </div>
                        </details>
                        <details class="admin-form-section admin-editor-details" open>
                            <summary><span class="admin-section-heading"><span class="admin-step">4</span><span><h3 class="h6 mb-1">Variations</h3><small class="text-secondary">Add product options and select the default</small></span></span><i class="bi bi-chevron-down"></i></summary>
                            <div class="admin-form-section-body"><div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3"><div><label class="form-label" for="slrDefaultVariation">Default variation</label><select class="form-select" id="slrDefaultVariation"><option value="">None</option></select></div><button class="btn btn-outline-primary" id="slrAddVariationBtn" type="button"><i class="bi bi-plus-lg me-1"></i>Add variation</button></div><div class="admin-variation-list" id="slrVariationsList"></div></div>
                        </details>
                        <div class="alert alert-danger d-none mt-3" id="slrProductFormError"></div>
                        <div class="admin-save-bar"><div class="admin-unsaved-indicator" id="slrProductUnsavedIndicator"><span></span>Saved</div><button class="btn btn-outline-secondary" id="slrResetProductButton" type="button">Reset changes</button><button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="slrSaveProductButton" type="submit"><i class="bi bi-check-lg me-1"></i>Save product</button></div>
                    </form>
                    <aside class="admin-preview-column slr-product-preview-column"><details class="admin-preview-details-shell" open><summary>Live preview <i class="bi bi-chevron-down"></i></summary><div class="content-panel admin-panel admin-preview-body"><div class="admin-sidebar-heading"><div><h3 class="h6 mb-1">Marketplace preview</h3><small>Updates as you edit</small></div></div><div id="slrProductPreviewBody"></div></div></details></aside>
                </div>
            </div>
        </div>`;
}

function setSlrProductDirty(dirty) {
    slrProductEditor.dirty = Boolean(dirty);
    const indicator = document.getElementById("slrProductUnsavedIndicator");
    if (!indicator) return;
    indicator.classList.toggle("is-dirty", slrProductEditor.dirty);
    indicator.innerHTML = `<span></span>${slrT(slrProductEditor.dirty ? "Unsaved changes" : "Saved")}`;
}

function renderSlrCustomerInputs() {
    const list = document.getElementById("slrProductCustomerInputs");
    if (!list) return;
    list.innerHTML = slrProductEditor.customerInputs.length
        ? slrProductEditor.customerInputs.map((label, index) => `<div class="admin-inline-control" data-slr-customer-input-index="${index}"><input class="form-control form-control-sm" data-slr-customer-input-field="label" maxlength="80" value="${slrEscape(label)}" /><button class="btn btn-outline-danger btn-sm" type="button" data-remove-slr-customer-input="${index}">${slrEscape(slrT("Remove"))}</button></div>`).join("")
        : `<div class="text-secondary small">${slrEscape(slrT("No customer inputs added."))}</div>`;
}

function renderSlrVariations(selectedDefault) {
    const list = document.getElementById("slrVariationsList");
    const defaultSelect = document.getElementById("slrDefaultVariation");
    if (!list || !defaultSelect) return;
    const currentDefault = selectedDefault ?? defaultSelect.value;
    list.innerHTML = slrProductEditor.variations.length
        ? slrProductEditor.variations.map((variation, index) => `
            <div class="admin-variation-row slr-variation-row" data-slr-variation-index="${index}">
                <div><label class="form-label">${slrEscape(slrT("Label"))}</label><input class="form-control form-control-sm" data-slr-variation-field="label" value="${slrEscape(variation.label || "")}" /></div>
                <div><label class="form-label">${slrEscape(slrT("Name"))}</label><input class="form-control form-control-sm" data-slr-variation-field="name" value="${slrEscape(variation.name || "")}" /></div>
                <div><label class="form-label">${slrEscape(slrT("Price"))}</label><input class="form-control form-control-sm" data-slr-variation-field="price" type="number" min="0" step="0.001" value="${Number(variation.price ?? 0)}" /></div>
                <button class="btn btn-outline-danger btn-sm" type="button" data-remove-slr-variation="${index}" aria-label="${slrEscape(slrT("Remove variation"))}"><i class="bi bi-x-lg"></i></button>
            </div>`).join("")
        : `<div class="empty-state py-3"><p class="text-secondary mb-0">${slrEscape(slrT("No variations for this product."))}</p></div>`;
    defaultSelect.innerHTML = `<option value="">${slrEscape(slrT("None"))}</option>${slrProductEditor.variations.map((variation) => `<option value="${slrEscape(variation.id || "")}">${slrEscape(variation.label || variation.name || variation.id || slrT("Option"))}</option>`).join("")}`;
    defaultSelect.value = slrProductEditor.variations.some((variation) => variation.id === currentDefault) ? currentDefault : "";
}

function updateSlrImagePreview() {
    const image = document.getElementById("slrProductImagePreviewImg");
    const container = document.getElementById("slrProductImagePreview");
    if (!image || !container) return;
    const source = slrProductEditor.previewUrl || document.getElementById("slrProductImage")?.value.trim();
    container.classList.toggle("d-none", !source);
    if (source) image.src = source;
}

function getSlrPreviewProduct() {
    return {
        id: document.getElementById("slrProductId")?.value.trim() || "new-product",
        name: document.getElementById("slrProductName")?.value.trim() || slrT("New product"),
        price: Number(document.getElementById("slrProductPrice")?.value || 0),
        shortDescription: document.getElementById("slrProductShortDesc")?.value.trim() || "",
        description: document.getElementById("slrProductDesc")?.value.trim() || "",
        image: document.getElementById("slrProductImage")?.value.trim() || "",
        visible: document.getElementById("slrProductVisible")?.checked !== false,
        inStock: document.getElementById("slrProductInStock")?.checked !== false,
        variations: slrProductEditor.variations,
    };
}

function renderSlrProductPreview() {
    const container = document.getElementById("slrProductPreviewBody");
    if (!container) return;
    const product = getSlrPreviewProduct();
    const firstVariation = product.variations[0];
    const displayPrice = firstVariation?.price ?? product.price;
    const imageSource = slrProductEditor.previewUrl || product.image;
    container.innerHTML = `<article class="card product-card h-100"><span class="product-art gamekey-art">${imageSource ? `<img class="product-image" src="${slrEscape(imageSource)}" alt="${slrEscape(product.name)}" />` : '<i class="bi bi-shop"></i>'}</span><div class="card-body d-flex flex-column"><div class="d-flex flex-wrap gap-2 mb-2">${product.shortDescription ? `<span class="badge text-bg-dark">${slrEscape(product.shortDescription)}</span>` : ""}<span class="badge ${product.inStock ? "text-bg-success" : "text-bg-secondary"}">${slrEscape(slrT(product.inStock ? "Available" : "Out of stock"))}</span></div><h3 class="h5">${slrEscape(product.name)}</h3><p class="small text-secondary mb-1"><i class="bi bi-person me-1"></i>${slrEscape(slrT("Sold by"))}: ${slrEscape(slrSellerDisplayName || slrT("Seller"))}</p><p class="text-secondary flex-grow-1">${slrEscape(product.shortDescription || product.description) || "&nbsp;"}</p><div class="d-flex justify-content-between align-items-center"><strong class="price">${firstVariation ? `${slrEscape(slrT("From"))} ` : ""}${slrMoney(displayPrice)}</strong><button class="btn btn-primary btn-sm" type="button" disabled>${slrEscape(slrT(product.inStock ? "Add" : "Unavailable"))}</button></div></div></article><div class="admin-preview-details mt-3"><details><summary>${slrEscape(slrT("Product info"))}</summary><div class="small text-secondary mt-2">${slrEscape(slrT("ID"))}: ${slrEscape(product.id)}<br>${product.variations.length ? `${slrEscape(slrT("Variations"))}: ${product.variations.length}` : `${slrEscape(slrT("Price"))}: ${slrMoney(product.price)}`}<br>${slrEscape(slrT(product.visible ? "Visible" : "Hidden"))}</div></details></div>`;
}

function readSlrProductForm() {
    const productId = document.getElementById("slrProductId").value.trim();
    const name = document.getElementById("slrProductName").value.trim();
    const price = Number(document.getElementById("slrProductPrice").value);
    if (!productId) throw new Error(slrT("Product ID is required."));
    if (!/^[a-z0-9][a-z0-9-]*$/.test(productId)) throw new Error(slrT("Product ID must use lowercase letters, numbers, and hyphens."));
    if (!name) throw new Error(slrT("Product name is required."));
    if (!Number.isFinite(price) || price < 0) throw new Error(slrT("Price must be zero or more."));
    if (!slrEditProductId && slrProducts.some((product) => product.id === productId)) throw new Error(slrT("Product ID already exists."));
    regenerateSlrVariationIds();

    const seenIds = new Set();
    const variations = slrProductEditor.variations.map((variation, index) => {
        const normalized = {
            id: String(variation.id || "").trim() || slrSlugify(variation.label || variation.name || `option-${index + 1}`),
            label: String(variation.label || "").trim(),
            name: String(variation.name || "").trim(),
            price: Number(variation.price),
        };
        if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized.id)) throw new Error(`Variation ID is invalid: ${normalized.id}`);
        if (seenIds.has(normalized.id)) throw new Error(`Duplicate variation ID: ${normalized.id}`);
        if (!normalized.label && !normalized.name) throw new Error(`Variation name is required: ${normalized.id}`);
        if (!Number.isFinite(normalized.price) || normalized.price < 0) throw new Error(`Variation price is invalid: ${normalized.id}`);
        seenIds.add(normalized.id);
        return normalized;
    });
    const defaultVariation = document.getElementById("slrDefaultVariation").value;
    const labels = slrProductEditor.customerInputs.map((label) => String(label || "").trim()).filter(Boolean);
    const customerInputEnabled = document.getElementById("slrProductCustomerInput").checked;
    return {
        originalProductId: slrEditProductId,
        productId,
        name,
        price,
        image: document.getElementById("slrProductImage").value.trim(),
        shortDescription: document.getElementById("slrProductShortDesc").value.trim(),
        description: document.getElementById("slrProductDesc").value.trim(),
        visible: document.getElementById("slrProductVisible").checked,
        inStock: document.getElementById("slrProductInStock").checked,
        variations,
        defaultVariation: defaultVariation && seenIds.has(defaultVariation) ? defaultVariation : "",
        customerInput: customerInputEnabled
            ? { enabled: true, ...(labels.length > 1 ? { labels } : { label: labels[0] || "Customer input" }) }
            : { enabled: false },
    };
}

/* ── Earnings ────────────────────────────────── */

function renderSlrEarnings(earnings) {
    const el = document.getElementById("slrEarningsList");
    if (!earnings.length) {
        el.innerHTML = `<div class="aff-empty"><div class="aff-empty-icon"><i class="bi bi-cash-stack"></i></div><p class="fw-bold mb-1">No earnings yet</p><p class="text-secondary small mb-0">Earnings from sales will appear here once orders are delivered.</p></div>`;
        return;
    }
    el.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm aff-table">
                <thead><tr><th>Order</th><th>Product</th><th>Sale</th><th>Fee</th><th>Earned</th><th>Date</th></tr></thead>
                <tbody>
                    ${earnings.map((e) => `
                        <tr>
                            <td><code class="aff-order-id">${slrEscape(e.orderId)}</code></td>
                            <td>${slrEscape(e.productId)}</td>
                            <td>${slrMoney(e.lineTotal)}</td>
                            <td>${e.feePercent}%</td>
                            <td class="fw-bold">${slrMoney(e.amount)}</td>
                            <td class="text-secondary small">${new Date(e.createdAt).toLocaleDateString()}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/* ── Payouts ─────────────────────────────────── */

function renderSlrPayouts(payouts) {
    const el = document.getElementById("slrPayoutsList");
    if (!payouts.length) {
        el.innerHTML = `<div class="aff-empty"><div class="aff-empty-icon"><i class="bi bi-wallet2"></i></div><p class="fw-bold mb-1">No payouts yet</p><p class="text-secondary small mb-0">Once you have earnings, request a payout above.</p></div>`;
        return;
    }
    el.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm aff-table">
                <thead><tr><th>Amount</th><th>Method</th><th>Recipient</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                    ${payouts.map((p) => `
                        <tr>
                            <td class="fw-bold">${slrMoney(p.amount)}</td>
                            <td>${slrEscape(p.method)}</td>
                            <td class="small font-monospace">${slrEscape(p.recipientDetail || "-")}</td>
                            <td>${slrPayoutBadge(p.status)}</td>
                            <td class="text-secondary small">${new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function slrPayoutBadge(status) {
    const map = { pending: "warning", paid: "success", approved: "success", rejected: "danger", requested: "warning" };
    const labels = { pending: "Pending", paid: "Paid", approved: "Approved", rejected: "Rejected", requested: "Requested" };
    const color = map[status] || "secondary";
    const text = labels[status] || status;
    return `<span class="badge text-bg-${color} aff-badge">${slrEscape(text)}</span>`;
}

/* ── Loading state ──────────────────────────── */

function setSlrLoading(loading) {
    const overlay = document.getElementById("slrDashboardLoading");
    const cards = document.getElementById("sellerStatsCards");
    if (!overlay || !cards) return;
    if (loading) {
        overlay.style.display = "";
        cards.style.opacity = "0.3";
        cards.style.pointerEvents = "none";
    } else {
        overlay.style.display = "none";
        cards.style.opacity = "";
        cards.style.pointerEvents = "";
    }
}

/* ── Refresh ────────────────────────────────── */

async function refreshSlrDashboard() {
    const session = getSlrSession();
    if (!session) return;
    setSlrLoading(true);
    try {
        const data = await loadSellerStats(session.token);
        renderSellerDashboard(data);
        if (typeof translatePage === "function") translatePage();
    } catch (error) {
        slrToast(error.message || "Failed to refresh", "danger");
    } finally {
        setSlrLoading(false);
    }
}

/* ── Section toggle ──────────────────────────── */

function showSlrSection(sectionId) {
    const login = document.getElementById("sellerLoginSection");
    const dash = document.getElementById("sellerDashboardSection");
    if (!login || !dash) return;
    login.style.display = sectionId === "login" ? "" : "none";
    dash.style.display = sectionId === "dashboard" ? "" : "none";
    if (sectionId === "dashboard") {
        dash.querySelectorAll(".hk-reveal").forEach((el) => el.classList.add("hk-visible"));
    }
}

/* ── Init ───────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
    installSlrProductEditor();
    const loginForm = document.getElementById("sellerLoginForm");
    const loginBtn = document.getElementById("sellerLoginButton");
    const loginError = document.getElementById("sellerLoginError");
    const phoneInput = document.getElementById("sellerPhoneInput");
    const passInput = document.getElementById("sellerPasswordInput");

    /* === LOGIN === */
    if (loginForm) {
        const session = getSlrSession();
        if (session) {
            showSlrSection("dashboard");
            setSlrLoading(true);
            loadSellerStats(session.token)
                .then((data) => { renderSellerDashboard(data); if (typeof translatePage === "function") translatePage(); if (typeof observeReveal === "function") observeReveal(); })
                .catch(() => { clearSlrSession(); showSlrSection("login"); })
                .finally(() => setSlrLoading(false));
        } else {
            showSlrSection("login");
        }

        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const phone = phoneInput.value.trim().replace(/\D/g, "");
            const password = passInput.value;
            if (!phone || !password) {
                loginError.textContent = slrT("Enter your phone and password.");
                loginError.classList.remove("d-none");
                return;
            }
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + slrT("Logging in...");
            loginError.classList.add("d-none");
            try {
                const result = await loginSeller(phone, password);
                saveSlrSession({ sellerId: result.seller.id, token: result.token });
                showSlrSection("dashboard");
                setSlrLoading(true);
                const data = await loadSellerStats(result.token);
        renderSellerDashboard(data);
        if (typeof translatePage === "function") translatePage();
        if (typeof observeReveal === "function") observeReveal();
    } catch (error) {
        clearSlrSession();
        showSlrSection("login");
                loginError.textContent = error.message ? slrTranslateError(error.message) : slrT("Login failed");
                loginError.classList.remove("d-none");
            } finally {
                setSlrLoading(false);
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>' + slrT("Login");
            }
        });
    }

    /* === DASHBOARD === */

    /* Copy referral / store link */
    /* (not applicable for sellers) */

    /* Payout Max button */
    const payoutMaxBtn = document.getElementById("slrPayoutMaxBtn");
    if (payoutMaxBtn) {
        payoutMaxBtn.addEventListener("click", () => {
            const balance = document.getElementById("slrPayoutBalance");
            const input = document.getElementById("slrPayoutAmountInput");
            const num = parseFloat(balance.textContent.replace("TND ", ""));
            if (num > 0) input.value = num.toFixed(3);
        });
    }

    /* Request payout */
    const requestPayoutBtn = document.getElementById("slrRequestPayoutButton");
    if (requestPayoutBtn) {
        requestPayoutBtn.addEventListener("click", async () => {
            const session = getSlrSession();
            if (!session) return;
            const amount = Number(document.getElementById("slrPayoutAmountInput").value);
            const method = document.querySelector("#slrPayoutMethodInput input[type=radio]:checked")?.value || "d17";
            const recipientDetail = document.getElementById("slrPayoutRecipientInput").value.trim();
            const errorEl = document.getElementById("slrPayoutError");
            const button = document.getElementById("slrRequestPayoutButton");
            if (!amount || amount <= 0) {
                errorEl.textContent = slrT("Enter a valid amount");
                errorEl.classList.remove("d-none");
                return;
            }
            if (slrMinWithdrawal > 0 && amount < slrMinWithdrawal) {
                errorEl.textContent = slrT("Minimum withdrawal is") + " " + slrMoney(slrMinWithdrawal);
                errorEl.classList.remove("d-none");
                return;
            }
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + slrT("Requesting...");
            errorEl.classList.add("d-none");
            try {
                await requestSellerPayout(session.token, amount, method, recipientDetail);
                document.getElementById("slrPayoutAmountInput").value = "";
                slrToast("Payout requested successfully", "success");
                await refreshSlrDashboard();
            } catch (error) {
                errorEl.textContent = error.message ? slrTranslateError(error.message) : slrT("Payout request failed");
                errorEl.classList.remove("d-none");
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="bi bi-send me-1"></i>' + slrT("Request payout");
            }
        });
    }

    /* Add product button */
    const addBtn = document.getElementById("slrAddProductButton");
    if (addBtn) {
        addBtn.addEventListener("click", () => openSlrProductModal(null));
    }

    /* Save product */
    const productForm = document.getElementById("slrProductForm");
    if (productForm) {
        productForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const session = getSlrSession();
            if (!session) return;
            const errorEl = document.getElementById("slrProductFormError");
            const saveBtn = document.getElementById("slrSaveProductButton");
            saveBtn.disabled = true;
            errorEl.classList.add("d-none");
            try {
                const product = readSlrProductForm();
                if (slrProductEditor.selectedFile) throw new Error(slrT("Upload the selected image before saving."));
                await saveSellerProduct(session.token, product);
                bootstrap.Modal.getInstance(document.getElementById("slrProductModal")).hide();
                slrToast("Product saved", "success");
                await refreshSlrDashboard();
            } catch (error) {
                errorEl.textContent = slrTranslateError(error.message);
                errorEl.classList.remove("d-none");
            } finally {
                saveBtn.disabled = false;
            }
        });
    }

    /* Product list event delegation */
    document.addEventListener("click", (event) => {
        const editBtn = event.target.closest("[data-slr-edit-product]");
        if (editBtn) {
            const productId = editBtn.dataset.slrEditProduct;
            const session = getSlrSession();
            if (!session) return;
            loadSellerStats(session.token).then((data) => {
                const product = (data.products || []).find((p) => p.id === productId);
                if (product) openSlrProductModal(product);
            }).catch((error) => slrToast(error.message || "Could not load product", "danger"));
            return;
        }
        const delBtn = event.target.closest("[data-slr-delete-product]");
        if (delBtn) {
            const productId = delBtn.dataset.slrDeleteProduct;
            const session = getSlrSession();
            if (!session) return;
            if (!confirm("Delete this product?")) return;
            deleteSellerProduct(session.token, productId).then(() => {
                slrToast("Product deleted", "success");
                refreshSlrDashboard();
            }).catch((error) => slrToast(error.message, "danger"));
            return;
        }
        const removeVar = event.target.closest("[data-remove-slr-variation]");
        if (removeVar) {
            const index = Number(removeVar.dataset.removeSlrVariation);
            slrProductEditor.variations.splice(index, 1);
            renderSlrVariations();
            renderSlrProductPreview();
            setSlrProductDirty(true);
            return;
        }
        const removeCustomerInput = event.target.closest("[data-remove-slr-customer-input]");
        if (removeCustomerInput) {
            slrProductEditor.customerInputs.splice(Number(removeCustomerInput.dataset.removeSlrCustomerInput), 1);
            renderSlrCustomerInputs();
            setSlrProductDirty(true);
        }
    });

    /* Variation add */
    const addVarBtn = document.getElementById("slrAddVariationBtn");
    if (addVarBtn) {
        addVarBtn.addEventListener("click", () => {
            if (slrProductEditor.variations.length >= 50) {
                slrToast("A product can have up to 50 variations.", "danger");
                return;
            }
            slrProductEditor.variations.push({ id: "", label: "", name: "", price: Number(document.getElementById("slrProductPrice").value || 0) });
            regenerateSlrVariationIds();
            renderSlrVariations();
            renderSlrProductPreview();
            setSlrProductDirty(true);
        });
    }

    /* Customer input toggle */
    const ciToggle = document.getElementById("slrProductCustomerInput");
    if (ciToggle) {
        ciToggle.addEventListener("change", () => {
            document.getElementById("slrProductCustomerInputFields").classList.toggle("d-none", !ciToggle.checked);
            setSlrProductDirty(true);
            renderSlrProductPreview();
        });
    }

    document.getElementById("slrAddCustomerInputButton")?.addEventListener("click", () => {
        const input = document.getElementById("slrProductCustomerNewInput");
        const value = input.value.trim();
        if (!value) return;
        if (slrProductEditor.customerInputs.length >= 10) {
            slrToast("A product can have up to 10 customer fields.", "danger");
            return;
        }
        slrProductEditor.customerInputs.push(value);
        input.value = "";
        renderSlrCustomerInputs();
        setSlrProductDirty(true);
    });

    document.getElementById("slrResetProductButton")?.addEventListener("click", () => openSlrProductModal(slrProductEditor.originalProduct));

    productForm?.addEventListener("input", (event) => {
        if (event.target.id === "slrProductName" && !slrEditProductId) {
            document.getElementById("slrProductId").value = slrSlugify(event.target.value);
        }
        if (event.target.id === "slrProductName") regenerateSlrVariationIds();
        const variationField = event.target.closest("[data-slr-variation-field]");
        if (variationField) {
            const row = variationField.closest("[data-slr-variation-index]");
            const index = Number(row.dataset.slrVariationIndex);
            const field = variationField.dataset.slrVariationField;
            slrProductEditor.variations[index][field] = field === "price" ? Number(variationField.value || 0) : variationField.value;
            if (field === "label" || field === "name") regenerateSlrVariationIds();
            const defaultOption = document.getElementById("slrDefaultVariation")?.options[index + 1];
            if (defaultOption) {
                defaultOption.value = slrProductEditor.variations[index].id || "";
                defaultOption.textContent = slrProductEditor.variations[index].label || slrProductEditor.variations[index].name || slrProductEditor.variations[index].id || slrT("Option");
            }
        }
        const customerField = event.target.closest("[data-slr-customer-input-field]");
        if (customerField) {
            const row = customerField.closest("[data-slr-customer-input-index]");
            slrProductEditor.customerInputs[Number(row.dataset.slrCustomerInputIndex)] = customerField.value;
        }
        setSlrProductDirty(true);
        renderSlrProductPreview();
    });
    productForm?.addEventListener("change", () => {
        setSlrProductDirty(true);
        renderSlrProductPreview();
    });

    document.getElementById("slrProductPhotoFile")?.addEventListener("change", (event) => {
        const file = event.target.files?.[0] || null;
        if (!file) {
            slrProductEditor.selectedFile = null;
            if (slrProductEditor.previewUrl) URL.revokeObjectURL(slrProductEditor.previewUrl);
            slrProductEditor.previewUrl = "";
            updateSlrImagePreview();
            renderSlrProductPreview();
            return;
        }
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
            event.target.value = "";
            slrProductEditor.selectedFile = null;
            if (slrProductEditor.previewUrl) URL.revokeObjectURL(slrProductEditor.previewUrl);
            slrProductEditor.previewUrl = "";
            updateSlrImagePreview();
            renderSlrProductPreview();
            slrToast("Choose a PNG, JPG, or WebP image up to 4 MB.", "danger");
            return;
        }
        slrProductEditor.selectedFile = file;
        if (slrProductEditor.previewUrl) URL.revokeObjectURL(slrProductEditor.previewUrl);
        slrProductEditor.previewUrl = URL.createObjectURL(file);
        document.getElementById("slrProductUploadStatus").textContent = `${file.name} ${slrT("selected. Click Upload image.")}`;
        updateSlrImagePreview();
        renderSlrProductPreview();
        setSlrProductDirty(true);
    });

    document.getElementById("slrUploadProductImageButton")?.addEventListener("click", async () => {
        const session = getSlrSession();
        const file = slrProductEditor.selectedFile;
        const button = document.getElementById("slrUploadProductImageButton");
        const status = document.getElementById("slrProductUploadStatus");
        if (!session || !file) {
            status.textContent = slrT("Choose an image first.");
            return;
        }
        button.disabled = true;
        status.textContent = slrT("Uploading image...");
        const uploadId = ++slrProductEditor.uploadId;
        const productId = slrEditProductId;
        try {
            const path = await uploadSellerProductImage(session.token, file);
            if (uploadId !== slrProductEditor.uploadId || productId !== slrEditProductId) return;
            document.getElementById("slrProductImage").value = path;
            slrProductEditor.selectedFile = null;
            status.textContent = slrT("Image uploaded successfully.");
            renderSlrProductPreview();
        } catch (error) {
            if (uploadId === slrProductEditor.uploadId && productId === slrEditProductId) {
                status.textContent = slrTranslateError(error.message);
                slrToast(error.message, "danger");
            }
        } finally {
            if (uploadId === slrProductEditor.uploadId && button.isConnected) button.disabled = false;
        }
    });

    /* Refresh */
    const refreshBtn = document.getElementById("slrRefreshStats");
    if (refreshBtn) refreshBtn.addEventListener("click", refreshSlrDashboard);

    /* Logout */
    const logoutBtn = document.getElementById("sellerLogoutButton");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            const session = getSlrSession();
            if (session) await logoutSeller(session.token).catch(() => {});
            clearSlrSession();
            location.reload();
        });
    }

    document.getElementById("slrProductModal")?.addEventListener("hidden.bs.modal", () => {
        slrProductEditor.uploadId++;
        if (slrProductEditor.previewUrl) URL.revokeObjectURL(slrProductEditor.previewUrl);
        slrProductEditor.previewUrl = "";
        slrProductEditor.selectedFile = null;
    });
});
