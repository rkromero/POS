const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/arcaController');

router.use(authenticateToken);

// Datos del emisor (razón social, domicilio, IIBB, inicio de actividades)
router.get('/config', c.getConfig);
router.put('/config', requireAdmin, c.updateConfig);

// Diagnóstico de la conexión con ARCA
router.get('/status', requireAdmin, c.getStatus);

module.exports = router;
