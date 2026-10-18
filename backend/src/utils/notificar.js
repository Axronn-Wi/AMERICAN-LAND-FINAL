const db = require('../config/db');
const pool = db.pool || db;

// Crea la misma notificación para varios usuarios (ids de la tabla usuarios).
// Nunca lanza error: una notificación que falla no debe tumbar la acción principal.
async function notificar(usuarioIds, { tipo, titulo, mensaje, enlace }) {
  const ids = Array.from(new Set((usuarioIds || []).map(Number).filter(Number.isInteger)));
  if (ids.length === 0) return;

  try {
    await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, enlace)
       SELECT unnest($1::int[]), $2, $3, $4, $5`,
      [ids, tipo || 'general', String(titulo).slice(0, 150), String(mensaje || '').slice(0, 500), enlace || null]
    );
  } catch (err) {
    console.error('No se pudo crear la notificación:', err.message);
  }
}

// Usuarios de los estudiantes con matrícula activa en un salón
async function usuariosDelSalon(salonId) {
  const r = await pool.query(
    `SELECT e.usuario_id
     FROM matriculas m JOIN estudiantes e ON m.estudiante_id = e.id
     WHERE m.salon_id = $1 AND m.estado = 'activa'`,
    [salonId]
  );
  return r.rows.map((f) => f.usuario_id);
}

// Usuarios de administración activos (admin y secretaría)
async function usuariosAdmin() {
  const r = await pool.query(
    `SELECT u.id FROM usuarios u JOIN roles r ON u.rol_id = r.id
     WHERE r.nombre IN ('admin', 'secretaria') AND u.activo = TRUE`
  );
  return r.rows.map((f) => f.id);
}

module.exports = { notificar, usuariosDelSalon, usuariosAdmin };
