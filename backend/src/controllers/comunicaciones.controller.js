const db = require('../config/db');
const pool = db.pool || db;

const MAX_MENSAJE = 2000;

// ---------------------------------------------------------------
// Con quién puede chatear cada rol (ids de la tabla usuarios)
//   estudiante -> docentes de sus salones activos + administración
//   docente    -> estudiantes activos de sus salones + administración
//   admin y secretaria -> cualquier usuario activo
// Además, siempre se puede responder a quien ya nos escribió.
// ---------------------------------------------------------------
const SQL_ADMINS = `
  SELECT u.id FROM usuarios u JOIN roles r ON u.rol_id = r.id
  WHERE r.nombre IN ('admin', 'secretaria') AND u.activo = TRUE`;

const SQL_CONTACTOS = {
  estudiante: `
    SELECT du.id
    FROM estudiantes e
    JOIN matriculas m ON m.estudiante_id = e.id AND m.estado = 'activa'
    JOIN salones s ON s.id = m.salon_id
    JOIN docentes d ON d.id = s.docente_id
    JOIN usuarios du ON du.id = d.usuario_id
    WHERE e.usuario_id = $1
    UNION ${SQL_ADMINS}`,
  docente: `
    SELECT eu.id
    FROM docentes d
    JOIN salones s ON s.docente_id = d.id
    JOIN matriculas m ON m.salon_id = s.id AND m.estado = 'activa'
    JOIN estudiantes e ON e.id = m.estudiante_id
    JOIN usuarios eu ON eu.id = e.usuario_id
    WHERE d.usuario_id = $1
    UNION ${SQL_ADMINS}`,
  admin: `SELECT id FROM usuarios WHERE activo = TRUE`,
  secretaria: `SELECT id FROM usuarios WHERE activo = TRUE`
};

function sqlIdsPermitidos(rol) {
  const base = SQL_CONTACTOS[rol] || 'SELECT NULL::int AS id WHERE FALSE';
  return `(${base}
           UNION SELECT remitente_id FROM mensajes_chat WHERE destinatario_id = $1)`;
}

async function puedeChatear(usuario, otroId) {
  if (otroId === usuario.id_usuario) return false;
  const r = await pool.query(
    `SELECT 1 FROM ${sqlIdsPermitidos(usuario.rol)} AS p
     JOIN usuarios u ON u.id = p.id
     WHERE p.id = $2 AND u.activo = TRUE`,
    [usuario.id_usuario, otroId]
  );
  return r.rows.length > 0;
}

// ---------------------------------------------------------------
// GET /api/comunicaciones/resumen  (consulta liviana para el sondeo)
// ---------------------------------------------------------------
async function obtenerResumen(req, res) {
  try {
    const id = req.usuario.id_usuario;
    const r = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM notificaciones WHERE usuario_id = $1 AND leida = FALSE) AS notificaciones,
         (SELECT COUNT(*)::int FROM mensajes_chat WHERE destinatario_id = $1 AND leido_en IS NULL) AS mensajes`,
      [id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el resumen.' });
  }
}

// ---------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------
async function obtenerNotificaciones(req, res) {
  try {
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 30, 1), 100);
    const r = await pool.query(
      `SELECT id, tipo, titulo, mensaje, enlace, leida, creada_en
       FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY creada_en DESC, id DESC
       LIMIT $2`,
      [req.usuario.id_usuario, limite]
    );
    const noLeidas = await pool.query(
      'SELECT COUNT(*)::int AS total FROM notificaciones WHERE usuario_id = $1 AND leida = FALSE',
      [req.usuario.id_usuario]
    );
    res.json({ notificaciones: r.rows, no_leidas: noLeidas.rows[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las notificaciones.' });
  }
}

async function marcarNotificacionLeida(req, res) {
  try {
    const r = await pool.query(
      'UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [req.params.id, req.usuario.id_usuario]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Notificación no encontrada.' });
    }
    res.json({ mensaje: 'Notificación marcada como leída.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar la notificación.' });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    const r = await pool.query(
      'UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1 AND leida = FALSE',
      [req.usuario.id_usuario]
    );
    res.json({ mensaje: 'Todas las notificaciones quedaron leídas.', actualizadas: r.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar las notificaciones.' });
  }
}

async function eliminarNotificacion(req, res) {
  try {
    const r = await pool.query(
      'DELETE FROM notificaciones WHERE id = $1 AND usuario_id = $2 RETURNING id',
      [req.params.id, req.usuario.id_usuario]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Notificación no encontrada.' });
    }
    res.json({ mensaje: 'Notificación eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar la notificación.' });
  }
}

// ---------------------------------------------------------------
// Chat
// ---------------------------------------------------------------
async function obtenerContactos(req, res) {
  try {
    const { id_usuario, rol } = req.usuario;
    const r = await pool.query(
      `WITH permitidos AS (SELECT DISTINCT id FROM ${sqlIdsPermitidos(rol)} AS p WHERE id <> $1)
       SELECT u.id, u.nombre_completo, r.nombre AS rol,
              ult.contenido AS ultimo_mensaje, ult.enviado_en AS ultimo_en,
              ult.remitente_id = $1 AS ultimo_es_mio,
              (SELECT COUNT(*)::int FROM mensajes_chat x
               WHERE x.remitente_id = u.id AND x.destinatario_id = $1 AND x.leido_en IS NULL) AS no_leidos
       FROM permitidos p
       JOIN usuarios u ON u.id = p.id AND u.activo = TRUE
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN LATERAL (
         SELECT contenido, enviado_en, remitente_id
         FROM mensajes_chat
         WHERE (remitente_id = $1 AND destinatario_id = u.id)
            OR (remitente_id = u.id AND destinatario_id = $1)
         ORDER BY id DESC LIMIT 1
       ) ult ON TRUE
       ORDER BY ult.enviado_en DESC NULLS LAST, u.nombre_completo ASC
       LIMIT 300`,
      [id_usuario]
    );
    res.json({ contactos: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los contactos.' });
  }
}

async function obtenerMensajes(req, res) {
  try {
    const yo = req.usuario.id_usuario;
    const otro = Number(req.params.id);
    const despues = parseInt(req.query.despues, 10) || 0;

    if (!(await puedeChatear(req.usuario, otro))) {
      return res.status(403).json({ mensaje: 'No puedes chatear con este usuario.' });
    }

    // Los últimos 100 (o solo los nuevos si llega "despues"), en orden cronológico
    const r = await pool.query(
      `SELECT * FROM (
         SELECT id, remitente_id, contenido, enviado_en, leido_en, remitente_id = $1 AS es_mio
         FROM mensajes_chat
         WHERE ((remitente_id = $1 AND destinatario_id = $2) OR (remitente_id = $2 AND destinatario_id = $1))
           AND id > $3
         ORDER BY id DESC LIMIT 100
       ) t ORDER BY id ASC`,
      [yo, otro, despues]
    );

    // Abrir la conversación marca como leídos los mensajes recibidos
    await pool.query(
      `UPDATE mensajes_chat SET leido_en = NOW()
       WHERE remitente_id = $1 AND destinatario_id = $2 AND leido_en IS NULL`,
      [otro, yo]
    );

    res.json({ mensajes: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los mensajes.' });
  }
}

async function enviarMensaje(req, res) {
  try {
    const yo = req.usuario.id_usuario;
    const otro = Number(req.params.id);
    const contenido = typeof (req.body && req.body.contenido) === 'string' ? req.body.contenido.trim() : '';

    if (!contenido) {
      return res.status(400).json({ mensaje: 'El mensaje no puede estar vacío.' });
    }
    if (contenido.length > MAX_MENSAJE) {
      return res.status(400).json({ mensaje: `El mensaje no puede superar los ${MAX_MENSAJE} caracteres.` });
    }
    if (!(await puedeChatear(req.usuario, otro))) {
      return res.status(403).json({ mensaje: 'No puedes chatear con este usuario.' });
    }

    const r = await pool.query(
      `INSERT INTO mensajes_chat (remitente_id, destinatario_id, contenido)
       VALUES ($1, $2, $3)
       RETURNING id, remitente_id, contenido, enviado_en, leido_en, TRUE AS es_mio`,
      [yo, otro, contenido]
    );

    res.status(201).json({ mensaje: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al enviar el mensaje.' });
  }
}

module.exports = {
  obtenerResumen,
  obtenerNotificaciones, marcarNotificacionLeida, marcarTodasLeidas, eliminarNotificacion,
  obtenerContactos, obtenerMensajes, enviarMensaje
};
