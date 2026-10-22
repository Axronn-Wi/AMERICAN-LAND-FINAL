const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { registro, login, recuperar, restablecer } = require('../controllers/auth.controller');
const { normalizarCorreo } = require('../utils/sql');

// Login: solo cuentan los intentos fallidos, por IP + correo. Así una sala de cómputo
// que sale a internet con una sola IP no se bloquea, y adivinar la contraseña de una
// cuenta sigue limitado a 10 intentos cada 15 minutos
const limiteLoginCorreo = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + '|' + normalizarCorreo(req.body && req.body.correo).slice(0, 150),
  message: { mensaje: 'Demasiados intentos fallidos con este correo. Espera 15 minutos o recupera tu contraseña.' }
});

// Tope por IP para quien prueba muchas cuentas distintas (también solo intentos fallidos)
const limiteLoginIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' }
});

// Registro y recuperación de contraseña: 20 cada 15 minutos por IP
const limiteCuentas = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' }
});

router.post('/registro', limiteCuentas, registro);
router.post('/login', limiteLoginIp, limiteLoginCorreo, login);
router.post('/recuperar', limiteCuentas, recuperar);
router.post('/restablecer', limiteCuentas, restablecer);

module.exports = router;
