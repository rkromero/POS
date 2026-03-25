const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/factoryOrdersController');

router.use(authenticateToken);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);
router.patch('/:id/complete', c.complete);

module.exports = router;
