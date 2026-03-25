const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/wholesalePaymentsController');

router.use(authenticateToken, requireAdmin);
router.get('/client/:client_id', c.getByClient);
router.post('/', c.create);

module.exports = router;
