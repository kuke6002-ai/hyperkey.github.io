-- ================================================================
-- Order Database (env.DB)
-- Tables: orders, affiliates, referral_commissions, affiliate_payouts,
--         affiliate_sessions, order_items, payment_proofs,
--         order_deliveries, order_customer_inputs
-- ================================================================

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    checkout_request_id TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    telegram_username TEXT,
    product_total REAL NOT NULL,
    amount_due REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TND',
    payment_method TEXT NOT NULL,
    payment_method_label TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    delivery_status TEXT NOT NULL DEFAULT 'waiting',
    payment_status_reason TEXT,
    delivery_status_reason TEXT,
    updated_at TEXT,
    telegram_notified_at TEXT,
    referred_by TEXT,
    customer_confirmed_at TEXT,
    delivered_at TEXT,
    disputed INTEGER NOT NULL DEFAULT 0,
    dispute_reported_at TEXT,
    auto_completed_at TEXT
);

CREATE TABLE IF NOT EXISTS affiliates (
    ref_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    total_earnings REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    ref_code TEXT NOT NULL,
    product_id TEXT,
    commission_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    paid_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (ref_code) REFERENCES affiliates(ref_code)
);

CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_code TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    recipient_detail TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (ref_code) REFERENCES affiliates(ref_code)
);

CREATE TABLE IF NOT EXISTS affiliate_sessions (
    token TEXT PRIMARY KEY,
    ref_code TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    variation_id TEXT,
    product_name TEXT NOT NULL,
    option_label TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS payment_proofs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    proof_type TEXT NOT NULL,
    proof_label TEXT,
    proof_value TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    delivery_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS order_customer_inputs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    variation_id TEXT,
    product_name TEXT NOT NULL,
    input_label TEXT NOT NULL,
    input_value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    sender_name TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    image_url TEXT,
    created_at TEXT NOT NULL,
    customer_read INTEGER NOT NULL DEFAULT 0,
    seller_read INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS chat_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS seller_order_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    value TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

-- ================================================================
-- Catalog Database (env.product_db)
-- Tables: categories, products, store_config, settings
-- ================================================================

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    label TEXT,
    page TEXT,
    photo TEXT DEFAULT 'assets/hyperlogo.png',
    icon TEXT DEFAULT 'bi-box',
    teaser TEXT,
    heading TEXT,
    description TEXT,
    visible INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    commission_percent REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    category TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- ================================================================
-- Indexes (Order DB)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_referred_by ON orders(referred_by);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_deliveries_order_id ON order_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_customer_inputs_order_id ON order_customer_inputs(order_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_order_id ON referral_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_ref_code ON referral_commissions(ref_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_ref_code ON affiliate_payouts(ref_code);
CREATE INDEX IF NOT EXISTS idx_chat_messages_order ON chat_messages(order_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(sender_type, seller_read);
CREATE INDEX IF NOT EXISTS idx_chat_images_order ON chat_images(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_order_deliveries_order ON seller_order_deliveries(order_id);

-- ================================================================
-- Indexes (Catalog DB)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

CREATE TABLE IF NOT EXISTS marketplace_products (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ================================================================
-- Community sellers (Orders DB)
-- ================================================================

CREATE TABLE IF NOT EXISTS public_sellers (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_products (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    mime TEXT NOT NULL DEFAULT '',
    approved INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    warranty_days INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_products_seller ON public_products(seller_id);
CREATE TABLE IF NOT EXISTS public_product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    image TEXT NOT NULL,
    mime TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_product_images_product ON public_product_images(product_id);

