const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/loyaltyController');

router.use(authenticateToken);

// Config (admin only)
router.get('/config', ctrl.getConfig);
router.put('/config', requireAdmin, ctrl.updateConfig);

// Niveles
router.get('/levels', ctrl.getLevels);
router.put('/levels', requireAdmin, ctrl.updateLevels);

// Beneficios
router.get('/beneficios', ctrl.getBeneficios);
router.post('/beneficios', requireAdmin, ctrl.createBeneficio);
router.put('/beneficios/:id', requireAdmin, ctrl.updateBeneficio);
router.delete('/beneficios/:id', requireAdmin, ctrl.deleteBeneficio);

// Clientes
router.get('/clientes', requireAdmin, ctrl.getClientes);
router.get('/clientes/:id', requireAdmin, ctrl.getClienteDetail);
router.post('/clientes/:id/ajuste', requireAdmin, ctrl.ajustarPuntos);

// Movimientos
router.get('/movimientos', requireAdmin, ctrl.getMovimientos);

// Canje
router.post('/canje', ctrl.canjear);

// Búsqueda rápida
router.get('/search', ctrl.searchCliente);

// Dashboard
router.get('/dashboard', requireAdmin, ctrl.getDashboard);

module.exports = router;
