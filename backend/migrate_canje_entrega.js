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

    // Entrega de canjes (para evitar entregar el mismo beneficio dos veces)
    await client.query(`
      ALTER TABLE loyalty_movimientos
        ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMPTZ
    `);
    await client.query(`
      ALTER TABLE loyalty_movimientos
        ADD COLUMN IF NOT EXISTS entregado_por INTEGER REFERENCES users(id)
    `);
    await client.query(`
      ALTER TABLE loyalty_movimientos
        ADD COLUMN IF NOT EXISTS entregado_local_id INTEGER REFERENCES locals(id)
    `);

    await client.query('COMMIT');
    console.log('✅ Migración entrega de canjes completada');
    console.log('   loyalty_movimientos.entregado_at, entregado_por, entregado_local_id');
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
