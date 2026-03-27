const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAll, create } = require('../controllers/mermasController');

router.use(authenticateToken);

router.get('/', getAll);
router.post('/', create);

module.exports = router;
