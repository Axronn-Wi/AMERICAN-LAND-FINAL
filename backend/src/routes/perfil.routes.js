const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');
const { verificarToken } = require('../middleware/auth.middleware');
const { recibirFoto } = require('../middleware/foto.middleware');
const {
  obtenerMiPerfil, actualizarMiPerfil, subirMiFoto, eliminarMiFoto, verFoto, cambiarMiContrasena
} = require('../controllers/perfil.controller');

router.param('id', validarId);

// Máximo 10 intentos de cambio de contraseña cada 15 minutos por usuario
const limiteContrasena = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => 'u' + req.usuario.id_usuario,
  message: { mensaje: 'Demasiados intentos. Espera unos minutos.' }
});

// Pública: la foto se muestra con <img>, que no envía el token
router.get('/foto/:id', verFoto);

// Todo lo demás es del usuario que inició sesión
router.get('/', verificarToken, obtenerMiPerfil);
router.put('/', verificarToken, actualizarMiPerfil);
router.post('/foto', verificarToken, recibirFoto, subirMiFoto);
router.delete('/foto', verificarToken, eliminarMiFoto);
router.put('/contrasena', verificarToken, limiteContrasena, cambiarMiContrasena);

module.exports = router;
