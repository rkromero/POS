require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const localRoutes = require('./routes/locals');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const factoryOrderRoutes = require('./routes/factoryOrders');
const cashClosingRoutes = require('./routes/cashClosings');
const gastosRoutes = require('./routes/gastos');
const mermasRoutes = require('./routes/mermas');
const wholesaleClientRoutes = require('./routes/wholesaleClients');
const wholesaleOrderRoutes = require('./routes/wholesaleOrders');
const wholesalePaymentRoutes = require('./routes/wholesalePayments');

const pool = require('./db/pool');

const app = express();

// Crear tablas de mayoristas si no existen (migración automática)
async function runMigrations() {
  const client = await pool.connect();
  try {
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
    // Columna unidad_medida en products
    await client.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(10) DEFAULT 'unidad'
    `);
    // Migración cierre de caja multi-turno: columnas de montos declarados por cajera
    await client.query(`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS declarado_efectivo NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS declarado_debito NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS declarado_credito NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS declarado_transferencia NUMERIC(12,2) DEFAULT 0`);
    await client.query(`ALTER TABLE cash_closings ADD COLUMN IF NOT EXISTS declarado_total NUMERIC(12,2) DEFAULT 0`);
    // Cambiar constraint único de (local_id, fecha) a (local_id, fecha, user_id) para multi-turno
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_local_id_fecha_key') THEN
          ALTER TABLE cash_closings DROP CONSTRAINT cash_closings_local_id_fecha_key;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_closings_local_id_fecha_user_id_key') THEN
          ALTER TABLE cash_closings ADD CONSTRAINT cash_closings_local_id_fecha_user_id_key UNIQUE (local_id, fecha, user_id);
        END IF;
      END $$
    `);
    // Tablas de merma de productos
    await client.query(`
      CREATE TABLE IF NOT EXISTS mermas (
        id SERIAL PRIMARY KEY,
        local_id INTEGER NOT NULL REFERENCES locals(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        motivo VARCHAR(20) NOT NULL DEFAULT 'Desperfecto'
          CHECK (motivo IN ('Desperfecto','Vencimiento','Otro')),
        notas TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS merma_items (
        id SERIAL PRIMARY KEY,
        merma_id INTEGER NOT NULL REFERENCES mermas(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        cantidad NUMERIC(10,2) NOT NULL
      )
    `);
    // Tabla de gastos del local
    await client.query(`
      CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        local_id INTEGER NOT NULL REFERENCES locals(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Mercaderia','Sueldo','Vales','Servicios','Otros')),
        descripcion TEXT,
        monto NUMERIC(12,2) NOT NULL,
        abonado_con VARCHAR(20) NOT NULL DEFAULT 'Efectivo Caja'
          CHECK (abonado_con IN ('Efectivo Caja','Transferencia')),
        fecha DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Tablas de mayoristas verificadas/creadas');
  } catch (err) {
    console.error('⚠️ Error en migración automática:', err.message);
  } finally {
    client.release();
  }
}

runMigrations();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/locals', localRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/factory-orders', factoryOrderRoutes);
app.use('/api/cash-closings', cashClosingRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/mermas', mermasRoutes);
app.use('/api/wholesale-clients', wholesaleClientRoutes);
app.use('/api/wholesale-orders', wholesaleOrderRoutes);
app.use('/api/wholesale-payments', wholesalePaymentRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Mimí POS' }));

// Manejador de errores centralizado
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mimí POS backend corriendo en puerto ${PORT}`));
