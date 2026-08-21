/* ── Community seller page logic (English-only) ─────────────────── */

const SELL_API = typeof window.GAMEVAULT_ORDER_API_URL === "string" && window.GAMEVAULT_ORDER_API_URL ? window.GAMEVAULT_ORDER_API_URL : "";

const sellState = {
    code: sessionStorage.getItem("hyperkey-sell-code") || "",
    phone: sessionStorage.getItem("hyperkey-sell-phone") || "",
    products: [],
    orders: [],
    activeOrderId: "",
    chatTimer: null,
    chatSending: false,
    editingId: "",
    imageBase64: "",
    unreadTotal: 0,
    unreadByOrder: {},
};

function sellEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function sellT(text) {
    return typeof t === "function" ? t(text) : text;
}

function sellTranslateError(msg) {
    const exact = sellT(msg);
    if (exact !== msg) return exact;
    const withPeriod = sellT(String(msg).replace(/\.+$/, "") + ".");
    if (withPeriod !== String(msg).replace(/\.+$/, "") + ".") return withPeriod;
    const phoneErr = msg.match(/^(Enter a valid 8-digit Tunisian WhatsApp number\.?)/i);
    if (phoneErr) return sellT("Enter a valid 8-digit Tunisian WhatsApp number.");
    return msg;
}

function sellNormalizePhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.startsWith("00216") && digits.length === 13) return digits.slice(5);
    if (digits.startsWith("216") && digits.length === 11) return digits.slice(3);
    return digits;
}

function sellMoney(amount) {
    return `${Number(amount || 0).toFixed(3)} TND`;
}

function sellChatTime(createdAt) {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sellStatusTone(status) {
    const value = String(status || "").toLowerCase();
    if (["verified", "delivered"].some((item) => value.includes(item))) return "good";
    if (["rejected", "cancelled", "canceled"].some((item) => value.includes(item))) return "bad";
    if (["pending", "waiting", "manual"].some((item) => value.includes(item))) return "pending";
    return "neutral";
}

function sellStatusBadge(label, status) {
    return `<strong class="status-badge status-${sellStatusTone(status)}"><span class="status-dot" aria-hidden="true"></span>${sellEscape(label || status || "-")}</strong>`;
}

function sellPaymentLabel(status) {
    const labels = { pending: sellT("Payment pending"), verified: sellT("Payment verified"), rejected: sellT("Payment rejected") };
    return labels[status] || sellT("Payment pending");
}

function sellDeliveryLabel(status) {
    const labels = { waiting: sellT("Awaiting delivery"), delivered: sellT("Delivered"), cancelled: sellT("Cancelled") };
    return labels[status] || sellT("Awaiting delivery");
}

async function sellApi(body) {
    const response = await fetch(SELL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const text = await response.text();
    let result = {};
    try {
        result = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(sellT("Backend did not return JSON."));
    }
    if (!response.ok || !result.ok) throw new Error(result.error || sellT("Request failed."));
    return result;
}

function sellLoggedIn() {
    return Boolean(sellState.code && sellState.phone);
}

function sellStoreSession(code, phone) {
    sellState.code = String(code || "").trim().toUpperCase();
    sellState.phone = String(phone || "").trim();
    sessionStorage.setItem("hyperkey-sell-code", sellState.code);
    sessionStorage.setItem("hyperkey-sell-phone", sellState.phone);
    sellUpdateAuthUI();
}

function sellClearSession() {
    sellState.code = "";
    sellState.phone = "";
    sellState.editingId = "";
    sellState.activeOrderId = "";
    sellState.imageBase64 = "";
    sellStopChatPolling();
    sessionStorage.removeItem("hyperkey-sell-code");
    sessionStorage.removeItem("hyperkey-sell-phone");
    sellUpdateAuthUI();
    sellRenderStartPane();
    sellRenderProductsPane();
    sellRenderOrdersPane();
}

function sellUpdateAuthUI() {
    const badge = document.getElementById("sellLoggedInBadge");
    if (badge) {
        badge.classList.toggle("d-none", !sellLoggedIn());
        badge.textContent = sellLoggedIn() ? `${sellT("Logged in")}: ${sellState.code} · ${sellState.phone}` : "";
    }
    const alert = document.getElementById("sellLoginRequiredAlert");
    if (alert) alert.classList.toggle("d-none", sellLoggedIn());
    const saveButton = document.getElementById("sellSaveProductButton");
    if (saveButton) saveButton.disabled = !sellLoggedIn();
    const logoutButtons = [document.getElementById("sellProductsLogout"), document.getElementById("sellOrdersLogout")];
    logoutButtons.forEach((button) => {
        if (button) button.classList.toggle("d-none", !sellLoggedIn());
    });
    const authColumn = document.getElementById("sellAuthColumn");
    if (authColumn) authColumn.classList.toggle("d-none", sellLoggedIn());
    const productsCard = document.getElementById("sellProductsCard");
    if (productsCard) {
        productsCard.classList.toggle("col-lg-7", !sellLoggedIn());
        productsCard.classList.toggle("col-lg-12", sellLoggedIn());
    }
}

function sellShowPane(name) {
    document.querySelectorAll("#sellTabs [data-sell-tab]").forEach((button) => {
        button.classList.toggle("active", button.getAttribute("data-sell-tab") === name);
    });
    ["start", "products", "orders"].forEach((pane) => {
        const element = document.getElementById(`sell${pane.charAt(0).toUpperCase()}${pane.slice(1)}Pane`);
        if (element) element.classList.toggle("d-none", pane !== name);
    });
    if (name === "products") sellRenderProductsPane();
    if (name === "orders") sellRenderOrdersPane();
    if (name !== "orders") sellStopChatPolling();
}

/* ── Register / login ───────────────────────────────────────────── */

async function sellRegister() {
    const phone = sellNormalizePhone(document.getElementById("sellRegisterPhone")?.value || "");
    const resultBox = document.getElementById("sellRegisterResult");
    const errorBox = document.getElementById("sellRegisterError");
    if (resultBox) resultBox.classList.add("d-none");
    if (errorBox) errorBox.classList.add("d-none");
    if (!/^\d{8}$/.test(phone)) {
        if (errorBox) {
            errorBox.textContent = sellT("Enter a valid 8-digit Tunisian WhatsApp number.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    try {
        const result = await sellApi({ action: "public-seller-register", phone });
        const codeElement = document.getElementById("sellRegisterCode");
        if (codeElement) codeElement.textContent = result.code || "";
        if (resultBox) resultBox.classList.remove("d-none");
        document.getElementById("sellRegisterPhone").value = "";
    } catch (error) {
        if (errorBox) {
            errorBox.textContent = sellTranslateError(error.message || sellT("Could not register."));
            errorBox.classList.remove("d-none");
        }
    }
}

async function sellLogin(codeValue, phoneValue) {
    const code = String(codeValue || "").trim();
    const phone = sellNormalizePhone(phoneValue);
    const errorBox = document.getElementById("sellLoginError");
    if (errorBox) errorBox.classList.add("d-none");
    if (!code || !phone) {
        if (errorBox) {
            errorBox.textContent = sellT("Enter your seller code and WhatsApp number.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    try {
        await sellApi({ action: "public-seller-login", code, phone });
        sellStoreSession(code, phone);
        document.getElementById("sellLoginCode").value = "";
        document.getElementById("sellLoginPhone").value = "";
        sellRenderStartPane();
        sellRenderProductsPane();
        sellRenderOrdersPane();
    } catch (error) {
        if (errorBox) {
            errorBox.textContent = sellTranslateError(error.message || sellT("Invalid code or phone."));
            errorBox.classList.remove("d-none");
        }
    }
}

/* ── Start pane: login state reflects product form ──────────────── */

function sellRenderStartPane() {
    sellUpdateAuthUI();
}

/* ── Manage products ────────────────────────────────────────────── */

function sellLoginBoxHtml(target) {
    return `
        <div class="card border-0 shadow-sm" style="max-width: 420px;">
            <div class="card-body p-4">
                <h2 class="h5 fw-bold mb-3"><i class="bi bi-box-arrow-in-right me-2"></i>${sellT("Log in")}</h2>
                <p class="small text-secondary mb-3">${sellT("Enter the seller code you received when you registered, plus your WhatsApp number.")}</p>
                <div class="mb-3">
                    <label class="form-label" for="sellPaneLoginCode-${target}">${sellT("Seller code")}</label>
                    <input class="form-control sell-pane-login-code" id="sellPaneLoginCode-${target}" placeholder="${sellT("e.g. K7H2QX")}" maxlength="10" value="${sellEscape(sellState.code)}" />
                </div>
                <div class="mb-3">
                    <label class="form-label" for="sellPaneLoginPhone-${target}">${sellT("WhatsApp number")}</label>
                    <input class="form-control sell-pane-login-phone" id="sellPaneLoginPhone-${target}" inputmode="numeric" placeholder="${sellT("e.g. 22 123 456")}" maxlength="13" value="${sellEscape(sellState.phone)}" />
                </div>
                <button class="btn btn-outline-primary w-100" type="button" data-sell-pane-login="${target}"><i class="bi bi-box-arrow-in-right me-1"></i>${sellT("Log in")}</button>
                <div class="alert alert-danger d-none mt-3 sell-pane-login-error" role="alert"></div>
            </div>
        </div>
    `;
}

async function sellPaneLogin(target, button) {
    const area = document.getElementById(target);
    const code = area?.querySelector(".sell-pane-login-code")?.value || "";
    const phone = sellNormalizePhone(area?.querySelector(".sell-pane-login-phone")?.value);
    const errorBox = area?.querySelector(".sell-pane-login-error");
    if (errorBox) errorBox.classList.add("d-none");
    if (!code || !phone) {
        if (errorBox) {
            errorBox.textContent = sellT("Enter your seller code and WhatsApp number.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    button.disabled = true;
    try {
        await sellApi({ action: "public-seller-login", code, phone });
        sellStoreSession(code, phone);
        sellRenderProductsPane();
        sellRenderOrdersPane();
    } catch (error) {
        if (errorBox) {
            errorBox.textContent = sellTranslateError(error.message || sellT("Invalid code or phone."));
            errorBox.classList.remove("d-none");
        }
    } finally {
        button.disabled = false;
    }
}

async function sellLoadProducts() {
    if (!sellLoggedIn()) return;
    const result = await sellApi({ action: "public-seller-login", code: sellState.code, phone: sellState.phone });
    sellState.products = result.products || [];
}

function sellProductCardHtml(product) {
    const imageHtml = product.image
        ? `<img class="sell-product-image" src="${sellEscape(product.image)}" alt="${sellEscape(product.name)}" loading="lazy" />`
        : `<div class="sell-product-image-placeholder"><i class="bi bi-image"></i></div>`;
    const countBadge = "";
    return `
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-body p-3">
                <div class="d-flex gap-3">
                    <div class="sell-product-thumb position-relative">${imageHtml}${countBadge}</div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div>
                                <h3 class="h6 fw-bold mb-1">${sellEscape(product.name)}</h3>
                                <p class="small text-secondary mb-1">${sellMoney(product.price)} · ${sellEscape(product.category || sellT("No category"))} · ${sellT("Stock")}: ${Number(product.stock) || 0}</p>
                                ${product.approved ? '<span class="badge text-bg-success">' + sellT("Live") + "</span>" : '<span class="badge text-bg-warning">' + sellT("Pending review") + "</span>"}
                            </div>
                            <div class="d-flex gap-2 flex-shrink-0">
                                <button class="btn btn-outline-primary btn-sm" type="button" data-sell-edit-product="${sellEscape(product.id)}">${sellT("Edit")}</button>
                                <button class="btn btn-outline-danger btn-sm" type="button" data-sell-delete-product="${sellEscape(product.id)}">${sellT("Delete")}</button>
                            </div>
                        </div>
                        ${product.description ? `<p class="small text-secondary mb-0 mt-2">${sellEscape(product.description)}</p>` : ""}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function sellRenderProductsPane() {
    const area = document.getElementById("sellProductsArea");
    if (!area) return;
    sellUpdateAuthUI();
    if (!sellLoggedIn()) {
        area.innerHTML = sellLoginBoxHtml("sellProductsArea");
        return;
    }
    sellLoadProducts()
        .then(() => {
            const list = sellState.products;
            area.innerHTML = list.length
                ? list.map(sellProductCardHtml).join("")
                : `<div class="empty-state py-4"><p class="text-secondary mb-0">${sellT("No products yet. Add your first product on the \"Start selling\" tab.")}</p></div>`;
        })
        .catch((error) => {
            area.innerHTML = `<div class="alert alert-danger" role="alert">${sellEscape(sellTranslateError(error.message || sellT("Could not load products.")))}</div>`;
        });
}

async function sellCompressImage(file) {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(sellT("Could not read the image.")));
        reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(sellT("Could not read the image.")));
        img.src = dataUrl;
    });
    const MAX_DIMENSION = 1000;
    let { width, height } = image;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(sellT("Could not read the image."));
    context.drawImage(image, 0, 0, width, height);
    let quality = 0.72;
    let base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] || "";
    while (base64.length > 800_000 && quality > 0.35) {
        quality -= 0.08;
        base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] || "";
    }
    return base64;
}

async function sellPickImageFile(file) {
    if (!file) return;
    if (!file.type || !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        alert(sellT("Choose a PNG, JPG, or WebP image."));
        return;
    }
    sellSetUploadStatus(sellT("Processing photo..."));
    try {
        const base64 = await sellCompressImage(file);
        sellState.imageBase64 = base64;
        const preview = document.getElementById("sellProductImagePreview");
        if (preview) {
            preview.src = "data:image/jpeg;base64," + base64;
            preview.classList.remove("d-none");
        }
        sellSetUploadStatus(sellT("Photo ready. It will be saved with the product."), false, true);
    } catch (error) {
        sellSetUploadStatus(error?.message || sellT("Could not process the photo."), true);
    }
}

function sellSetUploadStatus(message, isError = false, isReady = false) {
    const status = document.getElementById("sellUploadStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("text-danger", Boolean(isError));
    status.classList.toggle("text-success", Boolean(isReady));
}

function sellResetImageUpload() {
    sellState.imageBase64 = "";
    const preview = document.getElementById("sellProductImagePreview");
    if (preview) {
        preview.removeAttribute("src");
        preview.classList.add("d-none");
    }
    sellSetUploadStatus("");
}

async function sellSaveProduct() {
    if (!sellLoggedIn()) {
        const errorBox = document.getElementById("sellProductError");
        if (errorBox) {
            errorBox.textContent = sellT("Log in with your seller code first.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    const name = String(document.getElementById("sellProductName")?.value || "").trim();
    const price = Number(document.getElementById("sellProductPrice")?.value);
    const category = String(document.getElementById("sellProductCategory")?.value || "").trim();
    const stock = Number(document.getElementById("sellProductStock")?.value);
    const description = String(document.getElementById("sellProductDescription")?.value || "").trim();
    const warrantyDays = Math.floor(Number(document.getElementById("sellProductWarrantyDays")?.value || 0));
    const errorBox = document.getElementById("sellProductError");
    if (errorBox) errorBox.classList.add("d-none");
    if (!name) {
        if (errorBox) {
            errorBox.textContent = sellT("Product name is required.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    if (!Number.isFinite(price) || price <= 0) {
        if (errorBox) {
            errorBox.textContent = sellT("Enter a valid price.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
        if (errorBox) {
            errorBox.textContent = sellT("Enter a valid stock quantity.");
            errorBox.classList.remove("d-none");
        }
        return;
    }
    const button = document.getElementById("sellSaveProductButton");
    if (button) button.disabled = true;
    try {
        const body = {
            action: sellState.editingId ? "public-product-update" : "public-product-create",
            code: sellState.code,
            phone: sellState.phone,
            productId: sellState.editingId,
            name,
            price,
            stock,
            category,
            description,
            warrantyDays,
        };
        if (sellState.imageBase64) {
            if (sellState.editingId) body.images = [sellState.imageBase64];
            else body.image = sellState.imageBase64;
        }
        await sellApi(body);
        sellState.editingId = "";
        sellState.imageBase64 = "";
        sellResetImageUpload();
        document.getElementById("sellProductName").value = "";
        document.getElementById("sellProductPrice").value = "";
        document.getElementById("sellProductCategory").value = "";
        document.getElementById("sellProductStock").value = "1";
        document.getElementById("sellProductDescription").value = "";
        document.getElementById("sellProductWarrantyDays").value = "0";
        document.getElementById("sellProductImage").value = "";
        document.getElementById("sellCancelEditButton").classList.add("d-none");
document.getElementById("sellSaveProductButton").innerHTML = '<i class="bi bi-check2 me-1"></i>' + sellT("Save product");
        sellRenderProductsPane();
    } catch (error) {
        if (errorBox) {
            errorBox.textContent = sellTranslateError(error.message || sellT("Could not save the product."));
            errorBox.classList.remove("d-none");
        }
    } finally {
        if (button) button.disabled = !sellLoggedIn();
    }
}

function sellStartEdit(productId) {
    const product = sellState.products.find((item) => item.id === productId);
    if (!product) return;
    sellState.editingId = product.id;
    document.getElementById("sellProductName").value = product.name;
    document.getElementById("sellProductPrice").value = product.price;
    document.getElementById("sellProductCategory").value = product.category || "";
    document.getElementById("sellProductStock").value = product.stock;
    document.getElementById("sellProductDescription").value = product.description || "";
    document.getElementById("sellProductWarrantyDays").value = Number(product.warrantyDays || 0) || "0";
    document.getElementById("sellProductImage").value = "";
    sellState.imageBase64 = "";
    const existingImage = product.image || (Array.isArray(product.images) && product.images.length ? product.images[0] : "");
    const preview = document.getElementById("sellProductImagePreview");
    if (preview) {
        if (existingImage) {
            preview.src = existingImage;
            preview.classList.remove("d-none");
        } else {
            preview.classList.add("d-none");
        }
    }
    document.getElementById("sellCancelEditButton").classList.remove("d-none");
    document.getElementById("sellSaveProductButton").innerHTML = '<i class="bi bi-check2 me-1"></i>' + sellT("Save changes");
    document.getElementById("sellProductError")?.classList.add("d-none");
    sellShowPane("start");
    document.getElementById("sellStartPane").scrollIntoView({ behavior: "smooth", block: "start" });
}

function sellCancelEdit() {
    sellState.editingId = "";
    sellState.imageBase64 = "";
    sellResetImageUpload();
    document.getElementById("sellProductName").value = "";
    document.getElementById("sellProductPrice").value = "";
    document.getElementById("sellProductCategory").value = "";
    document.getElementById("sellProductStock").value = "1";
    document.getElementById("sellProductDescription").value = "";
    document.getElementById("sellProductImage").value = "";
    document.getElementById("sellCancelEditButton").classList.add("d-none");
    document.getElementById("sellSaveProductButton").innerHTML = '<i class="bi bi-check2 me-1"></i>' + sellT("Save product");
    document.getElementById("sellProductError")?.classList.add("d-none");
}

async function sellDeleteProduct(productId) {
    if (!confirm(sellT("Delete this product permanently? It will be removed from the store."))) return;
    try {
        await sellApi({ action: "public-product-delete", code: sellState.code, phone: sellState.phone, productId });
        sellRenderProductsPane();
    } catch (error) {
        alert(sellTranslateError(error.message || sellT("Could not delete the product.")));
    }
}

/* ── My orders ──────────────────────────────────────────────────── */

async function sellRequestPayout(orderId) {
    const input = document.querySelector(`[data-sell-d17-input="${orderId}"]`);
    const d17 = String(input?.value || "").replace(/\s/g, "");
    if (!/^\d{8}$/.test(d17)) {
        alert(sellT("Enter your 8-digit D17 (ID card) number."));
        input?.focus();
        return;
    }
    try {
        await sellApi({ action: "public-request-payout", code: sellState.code, phone: sellState.phone, orderId, d17Number: d17 });
        alert(sellT("Payout request sent. The store admin will review it."));
        await sellLoadOrders();
        sellRenderOrdersPane();
    } catch (error) {
        alert(sellTranslateError(error.message || sellT("Could not send the payout request.")));
    }
}

async function sellLoadOrders() {
    if (!sellLoggedIn()) return;
    const result = await sellApi({ action: "public-seller-orders", code: sellState.code, phone: sellState.phone });
    sellState.orders = result.orders || [];
}

function sellRenderOrdersPane() {
    const area = document.getElementById("sellOrdersArea");
    if (!area) return;
    sellUpdateAuthUI();
    if (!sellLoggedIn()) {
        area.innerHTML = sellLoginBoxHtml("sellOrdersArea");
        return;
    }
    if (sellState.activeOrderId) {
        sellRenderOrderDetail(sellState.activeOrderId);
        return;
    }
    sellLoadOrders()
        .then(() => {
            const orders = sellState.orders;
            if (!orders.length) {
                area.innerHTML = `<div class="empty-state py-4"><p class="text-secondary mb-0">${sellT("No orders yet. Orders appear here once customers buy your products.")}</p></div>`;
                return;
            }
            area.innerHTML = orders
                .map(
                    (order) => {
                        const eligible = order.paymentStatus === "verified" && order.deliveryStatus === "delivered";
                        let payoutBlock = "";
                        if (eligible) {
                            if (order.payoutStatus === "approved") {
                                payoutBlock = `<div class="alert alert-success py-2 px-3 mb-0"><i class="bi bi-check-circle me-1"></i>${sellT("Payout approved. The store admin will contact you.")}</div>`;
                            } else if (order.payoutStatus === "pending") {
                                payoutBlock = `<div class="alert alert-warning py-2 px-3 mb-0"><i class="bi bi-hourglass-split me-1"></i>${sellT("Payout request pending. The store admin is reviewing it.")}</div>`;
                            } else {
                                payoutBlock = `<div class="d-flex flex-column flex-md-row gap-2 align-items-md-center">
                                    <input class="form-control form-control-sm" style="max-width:220px" type="text" inputmode="numeric" maxlength="8" placeholder="${sellT("D17 number (8 digits)")}" aria-label="${sellT("D17 number")}" data-sell-d17-input="${sellEscape(order.id)}" />
                                    <button class="btn btn-sm btn-outline-success" type="button" data-sell-payout-order="${sellEscape(order.id)}"><i class="bi bi-cash-coin me-1"></i>${sellT("Request payout")}</button>
                                </div>`;
                            }
                        }
                        return `
                        <div class="card border-0 shadow-sm mb-3">
                            <div class="card-body p-3">
                                <div class="row g-3 align-items-center">
                                    <div class="col-12 col-md-7">
                                        <h3 class="h6 fw-bold mb-1">${sellEscape(order.id)}</h3>
                                        <p class="small text-secondary mb-1">${sellEscape(new Date(order.createdAt).toLocaleString())}</p>
                                        <p class="small text-secondary mb-0">${(order.items || []).map((item) => `${sellEscape(item.productName)} × ${item.quantity}`).join(", ")}</p>
                                    </div>
                                    <div class="col-12 col-md-5 d-flex flex-column align-items-start align-items-md-end gap-2">
                                        <div class="d-flex flex-wrap gap-2">${sellStatusBadge(sellPaymentLabel(order.paymentStatus), order.paymentStatus)}${sellStatusBadge(sellDeliveryLabel(order.deliveryStatus), order.deliveryStatus)}</div>
                                        <strong>${sellMoney(order.amountDue)}</strong>
                                        <button class="btn btn-outline-primary btn-sm" type="button" data-sell-open-order="${sellEscape(order.id)}"><i class="bi bi-chat-dots me-1"></i>${sellT("View & chat")}</button>
                                    </div>
                                </div>
                                ${payoutBlock ? `<div class="mt-3">${payoutBlock}</div>` : ""}
                            </div>
                        </div>
                    `;
                    },
                )
                .join("");
        })
        .catch((error) => {
            area.innerHTML = `<div class="alert alert-danger" role="alert">${sellEscape(sellTranslateError(error.message || sellT("Could not load orders.")))}</div>`;
        });
}

function sellOrderItemHtml(item) {
    return `
        <div class="admin-order-line">
            <span>${sellEscape(item.quantity > 1 ? `${item.quantity} x ` : "")}${sellEscape(item.productName)}</span>
            <strong>${sellMoney(item.lineTotal)}</strong>
        </div>
    `;
}

function sellRenderOrderDetail(orderId) {
    const area = document.getElementById("sellOrdersArea");
    if (!area) return;
    const order = sellState.orders.find((item) => item.id === orderId);
    if (!order) {
        sellState.activeOrderId = "";
        sellRenderOrdersPane();
        return;
    }
    area.innerHTML = `
        <button class="btn btn-outline-secondary btn-sm mb-3" type="button" data-sell-back-orders><i class="bi bi-arrow-left me-1"></i>${sellT("Back to orders")}</button>
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-body p-4">
                <div class="row g-3 align-items-center mb-3">
                    <div class="col-12 col-md-7">
                        <h3 class="h5 fw-bold mb-1">${sellEscape(order.id)}</h3>
                        <p class="small text-secondary mb-0">${sellEscape(new Date(order.createdAt).toLocaleString())}</p>
                    </div>
                    <div class="col-12 col-md-5 d-flex flex-wrap gap-2 justify-content-md-end">${sellStatusBadge(sellPaymentLabel(order.paymentStatus), order.paymentStatus)}${sellStatusBadge(sellDeliveryLabel(order.deliveryStatus), order.deliveryStatus)}</div>
                </div>
                <div class="admin-order-lines mb-2">${(order.items || []).map(sellOrderItemHtml).join("")}</div>
                <div class="d-flex justify-content-between align-items-center"><span class="text-secondary small">${sellT("Total")}</span><strong>${sellMoney(order.amountDue)}</strong></div>
                <p class="small text-secondary mb-0 mt-3"><i class="bi bi-info-circle me-1"></i>${sellT("Customers receive their order through the store. Payments are settled with the store admin directly.")}</p>
            </div>
        </div>
        <div class="order-chat-panel mt-4" id="sellChatPanel">
            <div class="order-chat-header">
                <span><i class="bi bi-chat-dots me-2"></i>${sellT("Chat with buyer")}</span>
                <small>${sellT("Buyer (via the order)")}</small>
            </div>
            <div class="order-chat-messages" id="sellChatMessages" aria-live="polite"></div>
            <form class="order-chat-composer" id="sellChatForm" novalidate>
                <button class="btn btn-outline-secondary chat-photo-btn" type="button" data-sell-chat-photo aria-label="${sellT("Send photo")}" title="${sellT("Send photo")}"><i class="bi bi-image"></i></button>
                <input class="d-none" type="file" id="sellChatPhoto" accept="image/png,image/jpeg,image/webp" />
                <input class="form-control" id="sellChatInput" type="text" maxlength="1000" autocomplete="off" placeholder="${sellT("Write a message...")}" required />
                <button class="btn btn-primary" type="submit" aria-label="${sellT("Send message")}"><i class="bi bi-send"></i></button>
            </form>
            <div class="alert alert-danger mt-2 mb-0 d-none" id="sellChatAlert" role="alert"></div>
        </div>
    `;
    sellStartChatPolling(orderId);
}

async function sellLoadChatUnread() {
    if (!sellLoggedIn()) return;
    try {
        const result = await sellApi({ action: "public-seller-chat-unread", code: sellState.code, phone: sellState.phone });
        sellState.unreadTotal = Number(result.total || 0);
        sellState.unreadByOrder = result.byOrder || {};
        sellRenderUnreadAlert();
    } catch {
        /* silent */
    }
}

function sellRenderUnreadAlert() {
    const el = document.getElementById("sellUnreadAlert");
    if (!el) return;
    const orderIds = Object.keys(sellState.unreadByOrder || {});
    const totalCount = Number(sellState.unreadTotal || 0);
    const orderCount = orderIds.length;
    if (!totalCount || !orderCount) {
        el.classList.add("d-none");
        el.innerHTML = "";
        el.dataset.sellOpenUnreadOrder = "";
        return;
    }
    el.classList.remove("d-none");
    el.innerHTML = `
        <i class="bi bi-chat-dots"></i>
        <span>${sellT("You have")} ${totalCount} ${sellT(totalCount === 1 ? "new message" : "new messages")} ${sellT("in")} ${orderCount} ${sellT(orderCount === 1 ? "order" : "orders")}.</span>
        <button class="btn btn-sm btn-primary" type="button" data-sell-open-unread><i class="bi bi-chat-dots me-1"></i>${sellT("Open chat")}</button>
    `;
    el.dataset.sellOpenUnreadOrder = orderIds[0];
}

async function sellOpenUnreadChat(orderId) {
    if (!orderId) return;
    sellState.activeOrderId = orderId;
    await sellLoadOrders();
    sellRenderOrdersPane();
    sellLoadChatUnread();
}

async function sellRefreshChat() {
    if (!sellState.activeOrderId || !sellLoggedIn()) return;
    try {
        const result = await sellApi({ action: "public-chat-messages", code: sellState.code, phone: sellState.phone, orderId: sellState.activeOrderId });
        sellState.chatMessages = result.messages || [];
        sellRenderChatMessages();
        sellLoadChatUnread();
    } catch {
        /* keep previous messages on transient errors */
    }
}

function sellRenderChatMessages() {
    const container = document.getElementById("sellChatMessages");
    if (!container) return;
    const messages = sellState.chatMessages || [];
    container.innerHTML =
        messages
            .map(
                (message) => `
                    <div class="chat-bubble ${message.senderType === "seller" ? "chat-bubble--mine" : "chat-bubble--theirs"}">
                        ${message.senderType !== "seller" ? `<div class="chat-bubble-sender">${sellEscape(message.senderName)}</div>` : ""}
                        ${
                            message.messageType === "image" && message.imageUrl
                                ? `<a class="chat-bubble-image-link" href="#" data-sell-chat-lightbox="${sellEscape(message.imageUrl)}"><img class="chat-bubble-image" src="${sellEscape(message.imageUrl)}" alt="${sellT("Photo")}" loading="lazy" /></a>`
                                : `<div class="chat-bubble-text">${sellEscape(message.message)}</div>`
                        }
                        <div class="chat-bubble-time">${sellEscape(sellChatTime(message.createdAt))}</div>
                    </div>
                `,
            )
            .join("") || `<p class="chat-empty text-secondary small mb-0 py-2 text-center">${sellT("No messages yet. The buyer can message you here.")}</p>`;
    container.scrollTop = container.scrollHeight;
}

function sellStartChatPolling(orderId) {
    sellState.activeOrderId = orderId;
    sellStopChatPolling();
    sellState.chatMessages = [];
    sellRefreshChat();
    sellState.chatTimer = setInterval(sellRefreshChat, 10_000);
}

function sellStopChatPolling() {
    if (sellState.chatTimer) {
        clearInterval(sellState.chatTimer);
        sellState.chatTimer = null;
    }
}

async function sellSendChat() {
    const input = document.getElementById("sellChatInput");
    const message = String(input?.value || "").trim();
    const alertBox = document.getElementById("sellChatAlert");
    if (alertBox) alertBox.classList.add("d-none");
    if (!message) return;
    if (sellState.chatSending) return;
    sellState.chatSending = true;
    try {
        await sellApi({ action: "public-chat-send", code: sellState.code, phone: sellState.phone, orderId: sellState.activeOrderId, message });
        if (input) input.value = "";
        await sellRefreshChat();
    } catch (error) {
        if (alertBox) {
            alertBox.textContent = sellTranslateError(error.message || sellT("Could not send the message."));
            alertBox.classList.remove("d-none");
        }
    } finally {
        sellState.chatSending = false;
    }
}

async function sellSendChatPhoto(file) {
    const alertBox = document.getElementById("sellChatAlert");
    if (alertBox) alertBox.classList.add("d-none");
    if (!file) return;
    if (sellState.chatSending) return;
    sellState.chatSending = true;
    try {
        const base64 = await sellCompressImage(file);
        await sellApi({ action: "public-chat-upload-image", code: sellState.code, phone: sellState.phone, orderId: sellState.activeOrderId, image: base64 });
        await sellRefreshChat();
    } catch (error) {
        if (alertBox) {
            alertBox.textContent = sellTranslateError(error.message || sellT("Could not send the photo."));
            alertBox.classList.remove("d-none");
        }
    } finally {
        sellState.chatSending = false;
    }
}

function sellOpenImageLightbox(src) {
    let overlay = document.getElementById("sellImageOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "sellImageOverlay";
        overlay.className = "chat-image-overlay";
        overlay.innerHTML = '<button type="button" class="chat-image-close" aria-label="' + sellT("Close") + '">&times;</button><img class="chat-image-full" alt="" />';
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay || event.target.classList.contains("chat-image-close")) {
                sellCloseImageLightbox();
            }
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") sellCloseImageLightbox();
        });
        document.body.appendChild(overlay);
    }
    overlay.querySelector(".chat-image-full").src = src;
    overlay.classList.add("chat-image-overlay-open");
}

function sellCloseImageLightbox() {
    const overlay = document.getElementById("sellImageOverlay");
    if (overlay) overlay.classList.remove("chat-image-overlay-open");
}

/* ── Event wiring ───────────────────────────────────────────────── */

function sellBindEvents() {
    document.querySelectorAll("#sellTabs [data-sell-tab]").forEach((button) => {
        button.addEventListener("click", () => sellShowPane(button.getAttribute("data-sell-tab")));
    });
    document.getElementById("sellRegisterButton")?.addEventListener("click", sellRegister);
    document.getElementById("sellLoginButton")?.addEventListener("click", () => {
        sellLogin(document.getElementById("sellLoginCode")?.value, document.getElementById("sellLoginPhone")?.value);
    });
    document.getElementById("sellProductForm")?.addEventListener("submit", (event) => {
        event.preventDefault();
        sellSaveProduct();
    });
    document.getElementById("sellCancelEditButton")?.addEventListener("click", sellCancelEdit);
    document.getElementById("sellProductImage")?.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) sellPickImageFile(file);
    });
    document.getElementById("sellProductsLogout")?.addEventListener("click", sellClearSession);
    document.getElementById("sellOrdersLogout")?.addEventListener("click", sellClearSession);

    document.addEventListener("click", function (event) {
        const paneLogin = event.target.closest("[data-sell-pane-login]");
        if (paneLogin) {
            sellPaneLogin(paneLogin.getAttribute("data-sell-pane-login"), paneLogin);
            return;
        }
        const editButton = event.target.closest("[data-sell-edit-product]");
        if (editButton) {
            sellStartEdit(editButton.getAttribute("data-sell-edit-product"));
            return;
        }
        const deleteButton = event.target.closest("[data-sell-delete-product]");
        if (deleteButton) {
            sellDeleteProduct(deleteButton.getAttribute("data-sell-delete-product"));
            return;
        }

        const payoutButton = event.target.closest("[data-sell-payout-order]");
        if (payoutButton) {
            sellRequestPayout(payoutButton.getAttribute("data-sell-payout-order"));
            return;
        }
        const openOrderButton = event.target.closest("[data-sell-open-order]");
        if (openOrderButton) {
            sellRenderOrderDetail(openOrderButton.getAttribute("data-sell-open-order"));
            return;
        }
        const backButton = event.target.closest("[data-sell-back-orders]");
        if (backButton) {
            sellStopChatPolling();
            sellState.activeOrderId = "";
            sellRenderOrdersPane();
            return;
        }
        const unreadButton = event.target.closest("[data-sell-open-unread]");
        if (unreadButton) {
            const alert = unreadButton.closest("#sellUnreadAlert");
            sellOpenUnreadChat(alert?.dataset.sellOpenUnreadOrder);
            return;
        }
        const lightboxLink = event.target.closest("[data-sell-chat-lightbox]");
        if (lightboxLink) {
            event.preventDefault();
            sellOpenImageLightbox(lightboxLink.getAttribute("data-sell-chat-lightbox"));
        }
    });

    document.getElementById("sellOrdersArea")?.addEventListener("submit", (event) => {
        if (event.target.id === "sellChatForm") {
            event.preventDefault();
            sellSendChat();
        }
    });

    document.getElementById("sellOrdersArea")?.addEventListener("change", (event) => {
        if (event.target.id === "sellChatPhoto") {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) sellSendChatPhoto(file);
        }
    });

    document.addEventListener("click", function (event) {
        const photoButton = event.target.closest("[data-sell-chat-photo]");
        if (photoButton) {
            document.getElementById("sellChatPhoto")?.click();
        }
    });
}


document.addEventListener("change", (event) => {
    if (event.target?.id !== "sellProductImage") return;
    const files = event.target.files;
    event.target.value = "";
    if (!files || !files.length) return;
    sellPickImageFile(files[0]);
});
function sellInitPage() {
    sellBindEvents();
    sellUpdateAuthUI();
    sellRenderStartPane();
    sellLoadChatUnread();
    setInterval(sellLoadChatUnread, 5_000);
    if (typeof translatePage === "function") {
        window.addEventListener("load", () => translatePage());
    }
}

window.addEventListener("hk-languagechange", () => {
    sellUpdateAuthUI();
    sellRenderStartPane();
    sellRenderProductsPane();
    sellRenderOrdersPane();
    sellLoadChatUnread();
    if (typeof translatePage === "function") translatePage();
});
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sellInitPage);
} else {
    sellInitPage();
}