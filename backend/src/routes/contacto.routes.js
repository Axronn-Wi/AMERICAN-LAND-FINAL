const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');
const {
  enviarContacto, obtenerContactos, cambiarEstadoContacto, eliminarContacto
} = require('../controllers/contacto.controller');

router.param('id', validarId);

// Formulario público: máximo 5 mensajes por hora desde la misma IP
const limiteContacto = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: 'Ya enviaste varios mensajes. Intenta de nuevo más tarde o llámanos.' }
});

router.post('/', limiteContacto, enviarContacto);

// Bandeja: admin y secretaría; borrar solo el admin
router.get('/', verificarToken, permitirRoles('admin', 'secretaria'), obtenerContactos);
router.put('/:id', verificarToken, permitirRoles('admin', 'secretaria'), cambiarEstadoContacto);
router.delete('/:id', verificarToken, permitirRoles('admin'), eliminarContacto);

module.exports = router;
