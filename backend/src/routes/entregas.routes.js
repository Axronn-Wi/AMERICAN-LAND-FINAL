const express = require('express');
const router = express.Router();
const { descargarEntrega } = require('../controllers/entregas.controller');
const { verificarToken } = require('../middleware/auth.middleware');

router.get('/:id/archivo', verificarToken, descargarEntrega);

module.exports = router;