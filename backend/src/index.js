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
