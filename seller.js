const SLR_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const SLR_SESSION_KEY = "hyperkey-seller-session";
let slrMinWithdrawal = 0;
let slrEditProductId = null;

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
    return msg;
}

function slrToast(message, type) {
    const container = document.getElementById("slrToastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `aff-toast aff-toast--${type || "info"}`;
    el.innerHTML = slrTranslateError(message);
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
    document.getElementById("slrProductModalTitle").textContent = product ? "Edit product" : "Add product";
    document.getElementById("slrProductName").value = product ? product.name || "" : "";
    document.getElementById("slrProductPrice").value = product ? product.price || "" : "";
    document.getElementById("slrProductShortDesc").value = product ? product.shortDescription || "" : "";
    document.getElementById("slrProductDesc").value = product ? product.description || "" : "";
    document.getElementById("slrProductVisible").checked = product ? product.visible !== false : true;
    document.getElementById("slrProductInStock").checked = product ? product.inStock !== false : true;
    const ci = product ? product.customerInput || {} : {};
    document.getElementById("slrProductCustomerInput").checked = ci.enabled || false;
    document.getElementById("slrProductCustomerInputLabel").value = ci.label || "";
    document.getElementById("slrProductCustomerInputLabelWrap").style.display = ci.enabled ? "" : "none";

    /* Variations */
    const varsEl = document.getElementById("slrVariationsList");
    const variations = product ? product.variations || [] : [];
    varsEl.innerHTML = variations.map((v, i) => `
        <div class="row g-2 mb-2 slr-variation-row">
            <div class="col-5"><input class="form-control form-control-sm" type="text" placeholder="Label" value="${slrEscape(v.label || "")}" data-slr-var-label="${i}" /></div>
            <div class="col-4"><input class="form-control form-control-sm" type="number" step="0.001" min="0" placeholder="Price" value="${v.price || ""}" data-slr-var-price="${i}" /></div>
            <div class="col-3"><button class="btn btn-sm btn-outline-danger" type="button" data-slr-var-remove="${i}">Remove</button></div>
        </div>
    `).join("");

    const modal = new bootstrap.Modal(document.getElementById("slrProductModal"));
    modal.show();
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
    const saveBtn = document.getElementById("slrSaveProductButton");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const session = getSlrSession();
            if (!session) return;
            const errorEl = document.getElementById("slrProductFormError");
            const name = document.getElementById("slrProductName").value.trim();
            const price = Number(document.getElementById("slrProductPrice").value);
            if (!name || !price) {
                errorEl.textContent = "Product name and price are required.";
                errorEl.classList.remove("d-none");
                return;
            }
            const variations = [];
            document.querySelectorAll(".slr-variation-row").forEach((row) => {
                const label = row.querySelector("input[data-slr-var-label]")?.value?.trim();
                const priceVal = Number(row.querySelector("input[data-slr-var-price]")?.value);
                if (label && priceVal > 0) variations.push({ id: label.toLowerCase().replace(/\s+/g, "-"), label, price: priceVal });
            });
            const customerInputEnabled = document.getElementById("slrProductCustomerInput").checked;
            saveBtn.disabled = true;
            errorEl.classList.add("d-none");
            try {
                await saveSellerProduct(session.token, {
                    productId: slrEditProductId,
                    name,
                    price,
                    image: "",
                    shortDescription: document.getElementById("slrProductShortDesc").value.trim(),
                    description: document.getElementById("slrProductDesc").value.trim(),
                    visible: document.getElementById("slrProductVisible").checked,
                    inStock: document.getElementById("slrProductInStock").checked,
                    variations,
                    customerInput: customerInputEnabled ? { enabled: true, label: document.getElementById("slrProductCustomerInputLabel").value.trim() || "Customer input" } : { enabled: false, label: "" },
                });
                bootstrap.Modal.getInstance(document.getElementById("slrProductModal")).hide();
                slrToast("Product saved", "success");
                await refreshSlrDashboard();
            } catch (error) {
                errorEl.textContent = error.message;
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
            }).catch(() => {});
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
        const removeVar = event.target.closest("[data-slr-var-remove]");
        if (removeVar) {
            removeVar.closest(".slr-variation-row").remove();
        }
    });

    /* Variation add */
    const addVarBtn = document.getElementById("slrAddVariationBtn");
    if (addVarBtn) {
        addVarBtn.addEventListener("click", () => {
            const varsEl = document.getElementById("slrVariationsList");
            const idx = varsEl.children.length;
            const div = document.createElement("div");
            div.className = "row g-2 mb-2 slr-variation-row";
            div.innerHTML = `
                <div class="col-5"><input class="form-control form-control-sm" type="text" placeholder="Label" data-slr-var-label="${idx}" /></div>
                <div class="col-4"><input class="form-control form-control-sm" type="number" step="0.001" min="0" placeholder="Price" data-slr-var-price="${idx}" /></div>
                <div class="col-3"><button class="btn btn-sm btn-outline-danger" type="button" data-slr-var-remove="${idx}">Remove</button></div>
            `;
            varsEl.appendChild(div);
        });
    }

    /* Customer input toggle */
    const ciToggle = document.getElementById("slrProductCustomerInput");
    if (ciToggle) {
        ciToggle.addEventListener("change", () => {
            document.getElementById("slrProductCustomerInputLabelWrap").style.display = ciToggle.checked ? "" : "none";
        });
    }

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

    /* Image upload */
});
