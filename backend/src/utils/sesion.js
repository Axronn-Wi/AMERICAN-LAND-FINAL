const jwt = require('jsonwebtoken');

// Firma el token de sesión. sesion_version viaja en el token: cuando la contraseña
// cambia, la versión sube en la base y los tokens anteriores dejan de servir
// (lo revisa verificarToken en auth.middleware.js)
function firmarToken({ id, rol, correo, sesion_version }) {
  return jwt.sign(
    { id_usuario: id, rol, correo, sesion_version: sesion_version || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

module.exports = { firmarToken };
