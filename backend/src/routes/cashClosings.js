const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/cashClosingsController');

router.use(authenticateToken);
router.get('/summary', c.getDaySummary);
router.get('/consolidated', requireAdmin, c.getConsolidated);
router.get('/', c.getAll);
router.post('/', c.create);

module.exports = router;
