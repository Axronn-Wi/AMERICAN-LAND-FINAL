const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');
const { verificarToken } = require('../middleware/auth.middleware');
const { descargarArchivoTarea } = require('../controllers/material.controller');

// Todo :id de estas rutas debe ser un entero positivo
router.param('id', validarId);

// Guía o taller adjunto de una tarea (docente del salón o estudiante matriculado)
router.get('/:id/archivo', verificarToken, descargarArchivoTarea);

module.exports = router;
