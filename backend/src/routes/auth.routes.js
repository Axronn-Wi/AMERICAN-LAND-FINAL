const express = require('express');
const router = express.Router();
const { registro, login, recuperar, restablecer } = require('../controllers/auth.controller');

router.post('/registro', registro);
router.post('/login', login);
router.post('/recuperar', recuperar);
router.post('/restablecer', restablecer);

module.exports = router;
