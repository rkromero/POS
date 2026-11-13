const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const c = require('../controllers/salesController');

router.use(authenticateToken);
router.get('/', c.getAll);
router.get('/:id', c.getById);
// El cajero no hace ventas directas: cobra pedidos vía /api/pedidos-caja
router.post('/', requireRole('admin', 'local'), c.create);

module.exports = router;
