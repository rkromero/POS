const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/wholesaleOrdersController');

router.use(authenticateToken, requireAdmin);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);
router.patch('/:id/estado', c.updateEstado);

module.exports = router;
