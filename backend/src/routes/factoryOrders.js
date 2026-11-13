const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const c = require('../controllers/factoryOrdersController');

router.use(authenticateToken, requireRole('admin', 'local'));
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);
router.patch('/:id/complete', c.complete);
router.patch('/:id/receive', c.receive);

module.exports = router;
