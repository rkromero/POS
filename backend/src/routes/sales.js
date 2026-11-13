const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const c = require('../controllers/salesController');

router.use(authenticateToken);
router.get('/', c.getAll);
router.get('/:id', c.getById);
// El cajero también vende directo desde el POS (la venta queda a su nombre y entra en su cierre)
router.post('/', requireRole('admin', 'local', 'cajero'), c.create);

module.exports = router;
