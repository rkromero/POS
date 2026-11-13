const router = require('express').Router();
const { authenticateToken, requireAdmin, requireRole } = require('../middleware/auth');
const c = require('../controllers/cashierOrdersController');

router.use(authenticateToken);
router.get('/config', c.getConfig);
router.get('/', requireRole('cajero', 'admin'), c.getAll);
router.post('/', requireRole('local'), c.create);
router.post('/:id/cobrar', requireRole('cajero'), c.cobrar);
router.patch('/:id/cancel', requireAdmin, c.cancel);

module.exports = router;
