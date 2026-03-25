require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS wholesale_clients (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        telefono VARCHAR(50),
        email VARCHAR(100),
        direccion TEXT,
        notas TEXT,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wholesale_orders (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES wholesale_clients(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','entregado','cancelado')),
        total NUMERIC(12,2) NOT NULL DEFAULT 0,
        notas TEXT,
        fecha_entrega DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wholesale_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES wholesale_orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        descripcion VARCHAR(200),
        cantidad NUMERIC(10,2) NOT NULL,
        precio_unitario NUMERIC(10,2) NOT NULL,
        subtotal NUMERIC(12,2) NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wholesale_payments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES wholesale_clients(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        monto NUMERIC(12,2) NOT NULL,
        notas TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Migración mayoristas completada');
    console.log('   Tablas creadas: wholesale_clients, wholesale_orders, wholesale_order_items, wholesale_payments');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
