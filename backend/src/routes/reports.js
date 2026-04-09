const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/reportsController');

router.use(authenticateToken);
router.get('/by-local', requireAdmin, c.salesByLocal);
router.get('/by-period', c.salesByPeriod);
router.get('/top-products', c.topProducts);
router.get('/by-cashier', requireAdmin, c.byCashier);
router.get('/comparison', requireAdmin, c.comparisonByLocal);

module.exports = router;
