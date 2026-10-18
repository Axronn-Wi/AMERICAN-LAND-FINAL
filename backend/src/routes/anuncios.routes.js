const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');
const {
  obtenerAnunciosVigentes, obtenerAnunciosGestion, crearAnuncio, editarAnuncio, eliminarAnuncio
} = require('../controllers/anuncios.controller');

router.param('id', validarId);
router.use(verificarToken);

// Publican: admin, secretaría y docentes (estos solo para sus salones)
const publicadores = permitirRoles('admin', 'secretaria', 'docente');

router.get('/', obtenerAnunciosVigentes);
router.get('/gestion', publicadores, obtenerAnunciosGestion);
router.post('/', publicadores, crearAnuncio);
router.put('/:id', publicadores, editarAnuncio);
router.delete('/:id', publicadores, eliminarAnuncio);

module.exports = router;
