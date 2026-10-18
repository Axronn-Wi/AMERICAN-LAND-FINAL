const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');

// Todo :id de estas rutas debe ser un entero positivo
router.param('id', validarId);
const { descargarMaterial } = require('../controllers/material.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/:id/archivo', verificarToken, descargarMaterial);

module.exports = router;