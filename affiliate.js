const AF_API_URL = window.GAMEVAULT_ORDER_API_URL || "";
const AF_SESSION_KEY = "hyperkey-affiliate-session";
let gMinWithdrawal = 0;

/* ── Utilities ────────────────────────────── */

function getAfSession() {
    try { return JSON.parse(sessionStorage.getItem(AF_SESSION_KEY)) || null; }
    catch { return null; }
}

function saveAfSession(data) {
    sessionStorage.setItem(AF_SESSION_KEY, JSON.stringify(data));
}

function clearAfSession() {
    sessionStorage.removeItem(AF_SESSION_KEY);
}

function afEscape(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function afMoney(amount) {
    return `TND ${Number(amount || 0).toFixed(3)}`;
}

function afT(text) {
    return typeof t === "function" ? t(text) : text;
}

function afTranslateError(msg) {
    const exact = afT(msg);
    if (exact !== msg) return exact;
    const minWd = msg.match(/^(Minimum withdrawal is TND )([\d.]+)$/);
    if (minWd) return afT("Minimum withdrawal is") + " TND " + minWd[2];
    const insuff = msg.match(/^(Insufficient pending commissions. Available: )([\d.]+)( TND)$/);
    if (insuff) return afT("Insufficient pending commissions. Available:") + " " + insuff[2] + " TND";
    return msg;
}

function afToast(message, type) {
    const container = document.getElementById("affToastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `aff-toast aff-toast--${type || "info"}`;
    el.innerHTML = afTranslateError(message);
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("aff-toast--show"));
    setTimeout(() => {
        el.classList.remove("aff-toast--show");
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

/* ── API calls ─────────────────────────────── */

async function loginAffiliate(refCode, password) {
    const response = await fetch(AF_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "affiliate-login", refCode, password }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Login failed");
    return result;
}

async function loadAffiliateStats(token) {
    const response = await fetch(AF_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "affiliate-stats", token }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Could not load stats");
    return result;
}

async function logoutAffiliate(token) {
    await fetch(AF_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "affiliate-logout", token }),
    });
}

async function requestPayout(token, amount, method, recipientDetail) {
    const response = await fetch(AF_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "affiliate-request-payout", token, amount, method, recipientDetail }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Payout request failed");
    return result;
}

/* ── Dashboard rendering ──────────────────── */

function renderDashboard(data) {
    const aff = data.affiliate;
    const stats = data.stats;
    const commissions = data.commissions || [];
    const payouts = data.payouts || [];

    document.getElementById("affiliateGreeting").textContent = `Welcome, ${afEscape(aff.name || aff.refCode)}.`;

    document.getElementById("affiliateTotalOrders").textContent = stats.totalOrders;
    document.getElementById("affiliateTotalCommissions").textContent = afMoney(stats.totalCommissions);
    document.getElementById("affiliatePendingCommissions").textContent = afMoney(stats.pendingCommissions);
    document.getElementById("affiliatePaidCommissions").textContent = afMoney(stats.paidCommissions);

    const avail = Number(stats.totalCommissions || 0) - Number(stats.paidCommissions || 0);
    document.getElementById("affPayoutBalance").textContent = afMoney(Math.max(0, avail));

    gMinWithdrawal = data.minimumWithdrawal || 0;
    const minEl = document.getElementById("affMinWithdrawalDisplay");
    if (minEl) minEl.textContent = afMoney(gMinWithdrawal);

    const linkInput = document.getElementById("affiliateReferralLink");
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "/");
    const refLink = baseUrl + "?ref=" + encodeURIComponent(aff.refCode);
    linkInput.value = refLink;

    /* Commissions table */
    const commissionsTable = document.getElementById("affiliateCommissionsTable");
    if (!commissions.length) {
        commissionsTable.innerHTML = `
            <div class="aff-empty">
                <div class="aff-empty-icon"><i class="bi bi-inbox"></i></div>
                <p class="fw-bold mb-1">No commissions yet</p>
                <p class="text-secondary small mb-0">Start sharing your referral link to earn commissions.</p>
            </div>
        `;
    } else {
        commissionsTable.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm aff-table">
                    <thead>
                        <tr><th>Order</th><th>Product</th><th>Amount</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        ${commissions.map((c) => `
                            <tr>
                                <td><code class="aff-order-id">${afEscape(c.orderId)}</code></td>
                                <td>${afEscape(c.productId)}</td>
                                <td class="fw-bold">${afMoney(c.amount)}</td>
                                <td class="text-secondary small">${new Date(c.createdAt).toLocaleDateString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    /* Payouts table */
    const payoutsTable = document.getElementById("affiliatePayoutsTable");
    if (!payouts.length) {
        payoutsTable.innerHTML = `
            <div class="aff-empty">
                <div class="aff-empty-icon"><i class="bi bi-wallet2"></i></div>
                <p class="fw-bold mb-1">No payouts yet</p>
                <p class="text-secondary small mb-0">Once you have earned commissions, request a payout above.</p>
            </div>
        `;
    } else {
        payoutsTable.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm aff-table">
                    <thead>
                        <tr><th>Amount</th><th>Method</th><th>Recipient</th><th>Status</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        ${payouts.map((p) => `
                            <tr>
                                <td class="fw-bold">${afMoney(p.amount)}</td>
                                <td>${afEscape(p.method)}</td>
                                <td class="small font-monospace">${afEscape(p.recipientDetail || "-")}</td>
                                <td>${afStatusBadge(p.status)}</td>
                                <td class="text-secondary small">${new Date(p.createdAt).toLocaleDateString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }
}

function afStatusBadge(status) {
    const map = {
        pending: "warning",
        paid: "success",
        approved: "success",
        rejected: "danger",
        requested: "warning",
    };
    const labels = {
        pending: "Pending",
        paid: "Paid",
        approved: "Approved",
        rejected: "Rejected",
        requested: "Requested",
    };
    const color = map[status] || "secondary";
    const text = labels[status] || status;
    return `<span class="badge text-bg-${color} aff-badge">${afEscape(text)}</span>`;
}

/* ── Loading state ──────────────────────────── */

function setDashLoading(loading) {
    const overlay = document.getElementById("affDashboardLoading");
    const cards = document.getElementById("affiliateStatsCards");
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

async function refreshDashboard() {
    const session = getAfSession();
    if (!session) return;
    setDashLoading(true);
    try {
        const data = await loadAffiliateStats(session.token);
        renderDashboard(data);
        if (typeof translatePage === "function") translatePage();
    } catch (error) {
        afToast(error.message || "Failed to refresh", "danger");
    } finally {
        setDashLoading(false);
    }
}

/* ── Section toggle ──────────────────────────── */

function showAffSection(sectionId) {
    const login = document.getElementById("affiliateLoginSection");
    const dash = document.getElementById("affiliateDashboardSection");
    if (!login || !dash) return;
    login.style.display = sectionId === "login" ? "" : "none";
    dash.style.display = sectionId === "dashboard" ? "" : "none";
}

/* ── Init ───────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("affiliateLoginForm");
    const loginBtn = document.getElementById("affiliateLoginButton");
    const loginError = document.getElementById("affiliateLoginError");
    const codeInput = document.getElementById("affiliateCodeInput");
    const passInput = document.getElementById("affiliatePasswordInput");

    const session = getAfSession();
    if (session) {
        showAffSection("dashboard");
        setDashLoading(true);
        loadAffiliateStats(session.token)
            .then((data) => { renderDashboard(data); if (typeof translatePage === "function") translatePage(); })
            .catch(() => { clearAfSession(); showAffSection("login"); })
            .finally(() => setDashLoading(false));
    } else {
        showAffSection("login");
    }

    /* Login form */
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const refCode = codeInput.value.trim();
        const password = passInput.value;
        if (!refCode || !password) {
            loginError.textContent = afT("Enter your affiliate code and password.");
            loginError.classList.remove("d-none");
            return;
        }
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + afT("Logging in...");
        loginError.classList.add("d-none");
        try {
            const result = await loginAffiliate(refCode, password);
            saveAfSession({ refCode: result.affiliate.refCode, token: result.token });
            showAffSection("dashboard");
            setDashLoading(true);
            const data = await loadAffiliateStats(result.token);
            renderDashboard(data);
            if (typeof translatePage === "function") translatePage();
        } catch (error) {
            clearAfSession();
            setDashLoading(false);
            showAffSection("login");
            loginError.textContent = error.message ? afTranslateError(error.message) : afT("Login failed");
            loginError.classList.remove("d-none");
        } finally {
            setDashLoading(false);
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>' + afT("Login");
        }
    });

    /* Copy referral link */
    document.getElementById("copyReferralLinkButton").addEventListener("click", () => {
        const input = document.getElementById("affiliateReferralLink");
        if (!input) return;
        navigator.clipboard?.writeText(input.value).then(() => {
            const btn = document.getElementById("copyReferralLinkButton");
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>' + afT("Copied");
            btn.className = "btn btn-success";
            setTimeout(() => { btn.innerHTML = original; btn.className = "btn btn-primary"; }, 2000);
        }).catch(() => {
            input.select();
        });
    });

    /* Payout Max button */
    document.getElementById("affPayoutMaxBtn").addEventListener("click", () => {
        const balance = document.getElementById("affPayoutBalance");
        const input = document.getElementById("payoutAmountInput");
        const num = parseFloat(balance.textContent.replace("TND ", ""));
        if (num > 0) input.value = num.toFixed(3);
    });

    /* Request payout */
    document.getElementById("requestPayoutButton").addEventListener("click", async () => {
        const session = getAfSession();
        if (!session) return;
        const amount = Number(document.getElementById("payoutAmountInput").value);
        const method = document.querySelector("#payoutMethodInput input[type=radio]:checked")?.value || "d17";
        const recipientDetail = document.getElementById("payoutRecipientInput").value.trim();
        const errorEl = document.getElementById("payoutError");
        const button = document.getElementById("requestPayoutButton");
        if (!amount || amount <= 0) {
            errorEl.textContent = afT("Enter a valid amount");
            errorEl.classList.remove("d-none");
            return;
        }
        if (gMinWithdrawal > 0 && amount < gMinWithdrawal) {
            errorEl.textContent = afT("Minimum withdrawal is ") + afMoney(gMinWithdrawal);
            errorEl.classList.remove("d-none");
            return;
        }
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + afT("Requesting...");
        errorEl.classList.add("d-none");
        try {
            await requestPayout(session.token, amount, method, recipientDetail);
            document.getElementById("payoutAmountInput").value = "";
            afToast("Payout requested successfully", "success");
            await refreshDashboard();
        } catch (error) {
            errorEl.textContent = error.message ? afTranslateError(error.message) : afT("Payout request failed");
            errorEl.classList.remove("d-none");
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-send me-1"></i>' + afT("Request payout");
        }
    });

    /* Refresh */
    document.getElementById("affRefreshStats").addEventListener("click", refreshDashboard);

    /* Logout */
    document.getElementById("affiliateLogoutButton").addEventListener("click", async () => {
        const session = getAfSession();
        if (session) await logoutAffiliate(session.token).catch(() => {});
        clearAfSession();
        location.reload();
    });
});