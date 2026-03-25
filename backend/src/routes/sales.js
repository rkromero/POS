const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const c = require('../controllers/salesController');

router.use(authenticateToken);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.post('/', c.create);

module.exports = router;
