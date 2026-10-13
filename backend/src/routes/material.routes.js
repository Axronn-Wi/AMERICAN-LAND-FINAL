const express = require('express');
const router = express.Router();
const { descargarMaterial } = require('../controllers/material.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/:id/archivo', verificarToken, descargarMaterial);

module.exports = router;