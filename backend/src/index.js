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
const loyaltyRoutes = require('./routes/loyalty');
const publicLoyaltyRoutes = require('./routes/publicLoyalty');
const wholesaleClientRoutes = require('./routes/wholesaleClients');
const wholesaleOrderRoutes = require('./routes/wholesaleOrders');
const wholesalePaymentRoutes = require('./routes/wholesalePayments');
const cashierOrderRoutes = require('./routes/cashierOrders');
const arcaRoutes = require('./routes/arca');

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
    // Precio mayorista en products
    await client.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS precio_mayorista NUMERIC(10,2)
    `);
    // Tipo de cliente en wholesale_clients
    await client.query(`
      ALTER TABLE wholesale_clients
      ADD COLUMN IF NOT EXISTS tipo_cliente VARCHAR(30) DEFAULT 'mayorista'
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
    // ── Tablas de fidelización por puntos ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        puntos_por_monto INTEGER NOT NULL DEFAULT 100,
        monto_base NUMERIC NOT NULL DEFAULT 1000,
        vencimiento_meses INTEGER NOT NULL DEFAULT 6,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`INSERT INTO loyalty_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_levels (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(30) NOT NULL,
        puntos_minimos INTEGER NOT NULL DEFAULT 0,
        orden INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      INSERT INTO loyalty_levels (nombre, puntos_minimos, orden) VALUES
        ('Bronce', 0, 1),
        ('Plata', 5000, 2),
        ('Oro', 15000, 3)
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_clients (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL DEFAULT 'Cliente',
        whatsapp VARCHAR(30) UNIQUE,
        email VARCHAR(100) UNIQUE,
        puntos_vigentes INTEGER NOT NULL DEFAULT 0,
        puntos_total_historico INTEGER NOT NULL DEFAULT 0,
        nivel VARCHAR(30) NOT NULL DEFAULT 'Bronce',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_beneficios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('descuento','producto','envio_gratis')),
        puntos_necesarios INTEGER NOT NULL,
        descripcion TEXT,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_movimientos (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES loyalty_clients(id),
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('acumulacion','canje','ajuste_manual','anulacion','vencimiento')),
        puntos INTEGER NOT NULL,
        sale_id INTEGER REFERENCES sales(id),
        beneficio_id INTEGER REFERENCES loyalty_beneficios(id),
        notas TEXT,
        creado_por INTEGER REFERENCES users(id),
        fecha_vencimiento DATE,
        vencido BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
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
    // Rol 'cajero': reemplaza el CHECK de users.role solo si todavía no incluye 'cajero'
    await client.query(`
      DO $$
      DECLARE c RECORD;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'users'::regclass AND contype = 'c'
            AND conname = 'users_role_check'
            AND pg_get_constraintdef(oid) LIKE '%cajero%'
        ) THEN
          FOR c IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'users'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%role%'
          LOOP
            EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c.conname);
          END LOOP;
          ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','local','cajero'));
        END IF;
      END $$
    `);
    // Pedidos enviados a caja desde el POS (se cobran en la pantalla del cajero)
    await client.query(`
      CREATE TABLE IF NOT EXISTS cashier_orders (
        id SERIAL PRIMARY KEY,
        local_id INTEGER NOT NULL REFERENCES locals(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        nombre_carrito VARCHAR(100),
        cliente_nombre VARCHAR(100),
        cliente_email VARCHAR(150),
        cliente_whatsapp VARCHAR(30),
        total_estimado NUMERIC(10,2) NOT NULL DEFAULT 0,
        estado VARCHAR(20) NOT NULL DEFAULT 'por_cobrar'
          CHECK (estado IN ('por_cobrar','cobrado','cancelado')),
        cobrado_por INTEGER REFERENCES users(id),
        cobrado_at TIMESTAMPTZ,
        sale_id INTEGER REFERENCES sales(id),
        cancelado_por INTEGER REFERENCES users(id),
        cancelado_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE cashier_orders ADD COLUMN IF NOT EXISTS cancelado_por INTEGER REFERENCES users(id)`);
    await client.query(`ALTER TABLE cashier_orders ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cashier_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES cashier_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        precio_unitario NUMERIC(10,2) NOT NULL,
        subtotal NUMERIC(10,2) NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cashier_orders_local_estado ON cashier_orders (local_id, estado)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cashier_order_items_order ON cashier_order_items (order_id)`);
    // ── Facturación electrónica ARCA (Factura C, emisor monotributista) ──
    await client.query(`ALTER TABLE locals ADD COLUMN IF NOT EXISTS arca_punto_venta INTEGER`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS tipo_ticket VARCHAR(10) NOT NULL DEFAULT 'mostrador'`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS factura_estado VARCHAR(12)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cbte_tipo INTEGER`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS punto_venta INTEGER`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cbte_nro BIGINT`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cae VARCHAR(20)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cae_vto DATE`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS factura_fecha DATE`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS imp_neto NUMERIC(12,2)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS imp_iva NUMERIC(12,2)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS imp_op_ex NUMERIC(12,2)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS doc_tipo INTEGER`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS doc_nro BIGINT`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS factura_error TEXT`);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_tipo_ticket_check') THEN
          ALTER TABLE sales ADD CONSTRAINT sales_tipo_ticket_check CHECK (tipo_ticket IN ('mostrador','fiscal'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_factura_estado_check') THEN
          ALTER TABLE sales ADD CONSTRAINT sales_factura_estado_check
            CHECK (factura_estado IS NULL OR factura_estado IN ('pendiente','autorizada','error'));
        END IF;
      END $$
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_comprobante_unico
      ON sales (cbte_tipo, punto_venta, cbte_nro) WHERE cae IS NOT NULL
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_factura_estado ON sales (factura_estado) WHERE factura_estado IS NOT NULL`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS arca_config (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        razon_social VARCHAR(150),
        domicilio_comercial VARCHAR(200),
        iibb VARCHAR(30),
        inicio_actividades DATE,
        condicion_iva VARCHAR(60) NOT NULL DEFAULT 'Responsable Monotributo',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`INSERT INTO arca_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    // Tickets de acceso de WSAA (cacheados: WSAA no da otro mientras haya uno vigente)
    await client.query(`
      CREATE TABLE IF NOT EXISTS arca_ta (
        env VARCHAR(15) NOT NULL,
        service VARCHAR(30) NOT NULL,
        token TEXT NOT NULL,
        sign TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (env, service)
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
app.use('/api/public/loyalty', publicLoyaltyRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/wholesale-clients', wholesaleClientRoutes);
app.use('/api/wholesale-orders', wholesaleOrderRoutes);
app.use('/api/wholesale-payments', wholesalePaymentRoutes);
app.use('/api/pedidos-caja', cashierOrderRoutes);
app.use('/api/arca', arcaRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Mimí POS' }));

// Manejador de errores centralizado
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mimí POS backend corriendo en puerto ${PORT}`));
