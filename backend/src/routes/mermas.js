const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getAll, create } = require('../controllers/mermasController');

router.use(authenticateToken, requireRole('admin', 'local'));

router.get('/', getAll);
router.post('/', create);

module.exports = router;
