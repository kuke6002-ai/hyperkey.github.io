-- ============================================================
-- HyperKey Store – Order Database Schema (env.DB / getOrderDb)
-- Paste each CREATE TABLE one at a time in the D1 Console.
-- ============================================================

CREATE TABLE IF NOT EXISTS orders ( id TEXT PRIMARY KEY, checkout_request_id TEXT, created_at TEXT NOT NULL, customer_phone TEXT NOT NULL, telegram_username TEXT, product_total REAL NOT NULL, amount_due REAL NOT NULL, currency TEXT NOT NULL, payment_method TEXT, payment_method_label TEXT, payment_status TEXT NOT NULL DEFAULT 'pending', delivery_status TEXT NOT NULL DEFAULT 'waiting', payment_status_reason TEXT DEFAULT '', delivery_status_reason TEXT DEFAULT '', updated_at TEXT, referred_by TEXT, telegram_notified_at TEXT );

CREATE TABLE IF NOT EXISTS order_items ( order_id TEXT NOT NULL, product_id TEXT NOT NULL, variation_id TEXT, product_name TEXT NOT NULL, option_label TEXT, quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL, line_total REAL NOT NULL, sold_by TEXT );

CREATE TABLE IF NOT EXISTS payment_proofs ( order_id TEXT NOT NULL, proof_type TEXT NOT NULL, proof_label TEXT NOT NULL, proof_value TEXT NOT NULL, created_at TEXT NOT NULL );

CREATE TABLE IF NOT EXISTS order_customer_inputs ( id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, product_id TEXT NOT NULL, variation_id TEXT, product_name TEXT NOT NULL, input_label TEXT NOT NULL, input_value TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY (order_id) REFERENCES orders(id) );

CREATE INDEX IF NOT EXISTS idx_order_customer_inputs_order_id ON order_customer_inputs(order_id);

-- Affiliates

CREATE TABLE IF NOT EXISTS affiliates ( ref_code TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, password_hash TEXT NOT NULL, total_earnings REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL );

CREATE TABLE IF NOT EXISTS referral_commissions ( id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, ref_code TEXT NOT NULL, product_id TEXT, commission_amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, paid_at TEXT );

CREATE TABLE IF NOT EXISTS affiliate_payouts ( id INTEGER PRIMARY KEY AUTOINCREMENT, ref_code TEXT NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL, recipient_detail TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL, updated_at TEXT );

CREATE TABLE IF NOT EXISTS affiliate_sessions ( token TEXT PRIMARY KEY, ref_code TEXT NOT NULL, created_at TEXT NOT NULL );

-- Sellers

CREATE TABLE IF NOT EXISTS sellers ( id TEXT PRIMARY KEY, name TEXT NOT NULL, display_name TEXT NOT NULL, phone TEXT NOT NULL, password_hash TEXT NOT NULL, total_earnings REAL NOT NULL DEFAULT 0, platform_fee_percent REAL NOT NULL DEFAULT 10, active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL );

CREATE TABLE IF NOT EXISTS seller_sessions ( token TEXT PRIMARY KEY, seller_id TEXT NOT NULL, created_at TEXT NOT NULL );

CREATE TABLE IF NOT EXISTS seller_earnings ( id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id TEXT NOT NULL, order_id TEXT NOT NULL, product_id TEXT NOT NULL, line_total REAL NOT NULL, fee_percent REAL NOT NULL, earnings_amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, paid_at TEXT );

CREATE TABLE IF NOT EXISTS seller_payouts ( id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id TEXT NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL, recipient_detail TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL, updated_at TEXT );

-- Settings

CREATE TABLE IF NOT EXISTS settings ( key TEXT PRIMARY KEY, value TEXT NOT NULL );
