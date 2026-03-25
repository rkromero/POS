require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminHash = await bcrypt.hash('admin1234', 10);
    const localHash = await bcrypt.hash('local1234', 10);

    await client.query(`
      INSERT INTO locals (nombre, direccion, telefono, logo_url) VALUES
        ('Mimí Centro', 'Av. Principal 123, Centro', '11-2233-4455', 'https://placehold.co/200x60/E91E8C/white?text=Mimi'),
        ('Mimí Norte', 'Calle Norte 456, Barrio Norte', '11-6677-8899', 'https://placehold.co/200x60/E91E8C/white?text=Mimi')
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      INSERT INTO users (nombre, email, password_hash, role, local_id)
      VALUES ('Administrador', 'admin@mimi.com', $1, 'admin', NULL)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash]);

    const locals = await client.query('SELECT id FROM locals ORDER BY id LIMIT 2');
    const localIds = locals.rows.map(r => r.id);

    await client.query(`
      INSERT INTO users (nombre, email, password_hash, role, local_id)
      VALUES ('María García', 'maria@mimi.com', $1, 'local', $2)
      ON CONFLICT (email) DO NOTHING
    `, [localHash, localIds[0]]);

    await client.query(`
      INSERT INTO users (nombre, email, password_hash, role, local_id)
      VALUES ('Juan López', 'juan@mimi.com', $1, 'local', $2)
      ON CONFLICT (email) DO NOTHING
    `, [localHash, localIds[1]]);

    await client.query(`
      INSERT INTO categories (nombre, descripcion) VALUES
        ('Panadería', 'Panes artesanales y tradicionales'),
        ('Pastelería', 'Tortas, facturas y masas finas'),
        ('Bebidas', 'Infusiones, jugos y refrescos'),
        ('Varios', 'Otros productos del local')
      ON CONFLICT DO NOTHING
    `);

    const cats = await client.query('SELECT id, nombre FROM categories ORDER BY id');
    const catMap = {};
    cats.rows.forEach(c => { catMap[c.nombre] = c.id; });

    const products = [
      ['Pan Francés', 'Pan crujiente tradicional (unidad)', 150.00, 'Panadería', 100],
      ['Pan de Miga', 'Pan de miga blanco (bolsa x12)', 850.00, 'Panadería', 30],
      ['Medialunas x6', 'Medialunas de manteca, pack x6', 1200.00, 'Pastelería', 50],
      ['Torta de Chocolate', 'Torta húmeda de chocolate (porción)', 1800.00, 'Pastelería', 15],
      ['Facturas Surtidas x4', 'Vigilantes, cañoncitos, berlinesas', 950.00, 'Pastelería', 40],
      ['Café con Leche', 'Café con leche en taza grande', 600.00, 'Bebidas', 999],
      ['Té con Limón', 'Té en saquito con limón y azúcar', 500.00, 'Bebidas', 999],
      ['Jugo de Naranja', 'Jugo exprimido natural 300ml', 750.00, 'Bebidas', 20],
      ['Budín de Vainilla', 'Budín casero de vainilla (porción)', 700.00, 'Pastelería', 25],
      ['Alfajor de Maicena', 'Alfajor triple con dulce de leche', 400.00, 'Varios', 60],
    ];

    for (const [nombre, descripcion, precio, cat, stock] of products) {
      await client.query(`
        INSERT INTO products (nombre, descripcion, precio, categoria_id, stock)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [nombre, descripcion, precio, catMap[cat], stock]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed completado');
    console.log('   admin@mimi.com  / admin1234');
    console.log('   maria@mimi.com  / local1234');
    console.log('   juan@mimi.com   / local1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en seed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
