const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// Recuerda por 30 s si un usuario sigue activo y su versión de sesión,
// para no consultar la base en cada petición
const CACHE_MS = 30 * 1000;
const cacheActivos = new Map();

async function estadoUsuario(idUsuario) {
  const guardado = cacheActivos.get(idUsuario);
  if (guardado && guardado.expira > Date.now()) return guardado;

  const r = await db.query('SELECT activo, sesion_version FROM usuarios WHERE id = $1', [idUsuario]);
  const estado = {
    activo: r.rows.length > 0 && r.rows[0].activo === true,
    version: r.rows.length > 0 ? r.rows[0].sesion_version : 0,
    expira: Date.now() + CACHE_MS
  };
  cacheActivos.set(idUsuario, estado);
  return estado;
}

// Los tokens firmados antes de existir sesion_version no la traen: cuentan como 0
function versionDelToken(usuario) {
  return Number.isInteger(usuario.sesion_version) ? usuario.sesion_version : 0;
}

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, usuario) => {
    // 401 (no 403): el frontend lo usa para mandar al usuario de vuelta al login
    if (err) {
      return res.status(401).json({ mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    }

    try {
      // Un usuario desactivado o eliminado pierde el acceso aunque su token no haya vencido
      const estado = await estadoUsuario(usuario.id_usuario);
      if (!estado.activo) {
        return res.status(401).json({ mensaje: 'Tu cuenta está inactiva. Comunícate con la administración.' });
      }
      // Si la contraseña cambió después de iniciar sesión, este token ya no sirve
      if (versionDelToken(usuario) !== estado.version) {
        return res.status(401).json({ mensaje: 'Tu contraseña cambió. Inicia sesión de nuevo.' });
      }
    } catch (errDb) {
      console.error('Error al verificar el usuario:', errDb.message);
      return res.status(503).json({ mensaje: 'Servicio no disponible. Intenta de nuevo en un momento.' });
    }

    req.usuario = usuario;
    next();
  });
}

// Se llama al activar, desactivar o eliminar un usuario y al cambiar su contraseña
function olvidarUsuario(idUsuario) {
  cacheActivos.delete(Number(idUsuario));
}

function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tienes permisos para esta acción.' });
    }
    next();
  };
}

// Para rutas públicas que muestran algo extra a quien inició sesión
// (por ejemplo, si ya le dio "me gusta" a una publicación). Nunca responde 401.
function sesionOpcional(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, process.env.JWT_SECRET, async (err, usuario) => {
    if (!err) {
      try {
        const estado = await estadoUsuario(usuario.id_usuario);
        if (estado.activo && versionDelToken(usuario) === estado.version) req.usuario = usuario;
      } catch (_) { /* sin base: se sigue como visitante */ }
    }
    next();
  });
}

module.exports = { verificarToken, sesionOpcional, permitirRoles, olvidarUsuario };
