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
    telegram_notified_at TEXT
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

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
