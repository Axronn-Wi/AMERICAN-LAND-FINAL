const db = require('../config/db');
const pool = db.pool || db;
const { normalizarCorreo, REGEX_CORREO } = require('../utils/sql');
const { notificar, usuariosAdmin } = require('../utils/notificar');

const ESTADOS = ['nuevo', 'en_proceso', 'atendido'];

// ---------------------------------------------------------------
// POST /api/contacto  (público, desde la página principal)
// ---------------------------------------------------------------
async function enviarContacto(req, res) {
  try {
    const body = req.body || {};

    // Campo trampa: las personas no lo ven; si viene lleno es un robot.
    // Se responde "ok" para no darle pistas.
    if (body.sitio_web) {
      return res.status(201).json({ mensaje: '¡Gracias! Te contactaremos pronto.' });
    }

    const nombre = typeof body.nombre_apellido === 'string' ? body.nombre_apellido.trim() : '';
    const correo = normalizarCorreo(body.correo);
    const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';

    if (nombre.length < 3 || nombre.length > 150) {
      return res.status(400).json({ mensaje: 'Escribe tu nombre y apellido.' });
    }
    if (!REGEX_CORREO.test(correo) || correo.length > 150) {
      return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
    }
    if (telefono && !/^[0-9+()\s-]{7,20}$/.test(telefono)) {
      return res.status(400).json({ mensaje: 'El teléfono no es válido.' });
    }
    if (mensaje.length < 10 || mensaje.length > 2000) {
      return res.status(400).json({ mensaje: 'El mensaje debe tener entre 10 y 2000 caracteres.' });
    }

    await pool.query(
      `INSERT INTO contacto_web (nombre_apellido, telefono, correo, mensaje)
       VALUES ($1, $2, $3, $4)`,
      [nombre, telefono || null, correo, mensaje]
    );

    usuariosAdmin()
      .then((ids) => notificar(ids, {
        tipo: 'contacto',
        titulo: 'Nuevo mensaje de contacto',
        mensaje: `${nombre} escribió desde la página web.`,
        enlace: '/admin/contactos.html'
      }))
      .catch(() => {});

    res.status(201).json({ mensaje: '¡Gracias! Recibimos tu mensaje y te contactaremos pronto.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'No se pudo enviar tu mensaje. Intenta de nuevo.' });
  }
}

// ---------------------------------------------------------------
// GET /api/contacto?estado=nuevo  (admin y secretaría)
// ---------------------------------------------------------------
async function obtenerContactos(req, res) {
  try {
    const estado = req.query.estado;
    if (estado && !ESTADOS.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado inválido.' });
    }
    const r = await pool.query(
      `SELECT c.id, c.nombre_apellido, c.telefono, c.correo, c.mensaje, c.estado,
              c.recibido_en, c.atendido_en, u.nombre_completo AS atendido_por
       FROM contacto_web c
       LEFT JOIN usuarios u ON u.id = c.atendido_por
       WHERE ($1::text IS NULL OR c.estado = $1)
       ORDER BY (c.estado = 'nuevo') DESC, c.recibido_en DESC
       LIMIT 300`,
      [estado || null]
    );
    const conteo = await pool.query(
      'SELECT estado, COUNT(*)::int AS total FROM contacto_web GROUP BY estado'
    );
    const totales = { nuevo: 0, en_proceso: 0, atendido: 0 };
    conteo.rows.forEach((f) => { totales[f.estado] = f.total; });

    res.json({ contactos: r.rows, totales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los mensajes de contacto.' });
  }
}

// ---------------------------------------------------------------
// PUT /api/contacto/:id  { estado }
// ---------------------------------------------------------------
async function cambiarEstadoContacto(req, res) {
  try {
    const { estado } = req.body || {};
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado inválido. Usa: nuevo, en_proceso o atendido.' });
    }
    const r = await pool.query(
      `UPDATE contacto_web
       SET estado = $1::varchar,
           atendido_por = CASE WHEN $1::varchar = 'nuevo' THEN NULL ELSE $2::int END,
           atendido_en = CASE WHEN $1::varchar = 'atendido' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $3
       RETURNING id, estado`,
      [estado, req.usuario.id_usuario, req.params.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Mensaje no encontrado.' });
    }
    res.json({ mensaje: 'Estado actualizado.', contacto: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el mensaje.' });
  }
}

// ---------------------------------------------------------------
// DELETE /api/contacto/:id  (solo admin)
// ---------------------------------------------------------------
async function eliminarContacto(req, res) {
  try {
    const r = await pool.query('DELETE FROM contacto_web WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Mensaje no encontrado.' });
    }
    res.json({ mensaje: 'Mensaje eliminado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar el mensaje.' });
  }
}

module.exports = { enviarContacto, obtenerContactos, cambiarEstadoContacto, eliminarContacto };
