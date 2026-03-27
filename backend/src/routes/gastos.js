const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getAll, create, remove } = require('../controllers/gastosController');

router.use(authenticateToken);

router.get('/', getAll);
router.post('/', create);
router.delete('/:id', remove);

module.exports = router;
