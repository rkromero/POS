const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/productsController');

router.use(authenticateToken);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', requireAdmin, c.create);
router.put('/:id', c.update);
router.delete('/:id', requireAdmin, c.remove);

module.exports = router;
