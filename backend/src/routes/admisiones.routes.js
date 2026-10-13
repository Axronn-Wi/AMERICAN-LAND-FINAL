const express = require('express');
const router = express.Router();
const { obtenerNiveles, obtenerSalonesPorNivel, crearMatricula, procesarPago } = require('../controllers/admisiones.controller');
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');

// Públicas: cualquier visitante puede ver niveles y salones
router.get('/niveles', obtenerNiveles);
router.get('/niveles/:id/salones', obtenerSalonesPorNivel);

// Protegidas: solo un estudiante con sesión iniciada
router.post('/matricula', verificarToken, permitirRoles('estudiante'), crearMatricula);
router.post('/pago', verificarToken, permitirRoles('estudiante'), procesarPago);

module.exports = router;