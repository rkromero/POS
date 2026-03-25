-- Mimí POS — Schema

CREATE TABLE IF NOT EXISTS locals (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(200),
  telefono VARCHAR(30),
  logo_url VARCHAR(500),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'local')),
  local_id INTEGER REFERENCES locals(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  precio NUMERIC(10,2) NOT NULL,
  categoria_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  stock INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS numero_comprobante_seq START 1;

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  numero_comprobante INTEGER UNIQUE DEFAULT nextval('numero_comprobante_seq'),
  local_id INTEGER NOT NULL REFERENCES locals(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  cliente_nombre VARCHAR(100) NOT NULL,
  cliente_email VARCHAR(150),
  cliente_whatsapp VARCHAR(30),
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo','debito','credito','transferencia')),
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL
);
