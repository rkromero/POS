require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cantidad efectivamente recibida por ítem (NULL = todavía no recepcionado)
    await client.query(`
      ALTER TABLE factory_order_items
        ADD COLUMN IF NOT EXISTS cantidad_recibida INTEGER
    `);

    // Datos de recepción a nivel pedido
    await client.query(`
      ALTER TABLE factory_orders
        ADD COLUMN IF NOT EXISTS recepcionado_at TIMESTAMPTZ
    `);
    await client.query(`
      ALTER TABLE factory_orders
        ADD COLUMN IF NOT EXISTS recepcionado_por INTEGER REFERENCES users(id)
    `);
    await client.query(`
      ALTER TABLE factory_orders
        ADD COLUMN IF NOT EXISTS notas_recepcion TEXT
    `);

    // Ampliar el estado para permitir 'recepcionado'
    await client.query(`ALTER TABLE factory_orders DROP CONSTRAINT IF EXISTS factory_orders_estado_check`);
    await client.query(`
      ALTER TABLE factory_orders
        ADD CONSTRAINT factory_orders_estado_check
        CHECK (estado IN ('nuevo','completado','recepcionado'))
    `);

    await client.query('COMMIT');
    console.log('✅ Migración recepción de pedidos a fábrica completada');
    console.log('   factory_order_items.cantidad_recibida');
    console.log('   factory_orders.recepcionado_at, recepcionado_por, notas_recepcion');
    console.log("   estado ahora permite: nuevo, completado, recepcionado");
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
