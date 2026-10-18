const db = require('../config/db');
const pool = db.pool || db;
const { notificar } = require('../utils/notificar');

const DIRIGIDO = ['todos', 'estudiantes', 'docentes'];
const ADMINISTRACION = ['admin', 'secretaria'];

const COLUMNAS = `
  an.id, an.titulo, an.contenido, an.dirigido_a, an.activo, an.salon_id,
  an.publicado_en, an.expira_en, an.usuario_id AS autor_id,
  u.nombre_completo AS autor, r.nombre AS autor_rol, s.nombre AS salon`;

const FROM = `
  FROM anuncios an
  JOIN usuarios u ON u.id = an.usuario_id
  JOIN roles r ON r.id = u.rol_id
  LEFT JOIN salones s ON s.id = an.salon_id`;

// Valida y limpia el cuerpo de un anuncio; devuelve { error } o { datos }
function leerAnuncio(body) {
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : '';
  const dirigido_a = body.dirigido_a || 'todos';
  const expira_en = body.expira_en || null;

  if (!titulo || !contenido) return { error: 'El título y el contenido son obligatorios.' };
  if (titulo.length > 150) return { error: 'El título no puede superar los 150 caracteres.' };
  if (contenido.length > 2000) return { error: 'El contenido no puede superar los 2000 caracteres.' };
  if (!DIRIGIDO.includes(dirigido_a)) return { error: 'Destinatarios inválidos. Usa: todos, estudiantes o docentes.' };
  if (expira_en !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(expira_en) || Number.isNaN(Date.parse(expira_en)))) {
    return { error: 'La fecha de vencimiento no es válida (usa AAAA-MM-DD).' };
  }
  return { datos: { titulo, contenido, dirigido_a, expira_en } };
}

async function idsSalonesDocente(idUsuario) {
  const r = await pool.query(
    'SELECT s.id FROM salones s JOIN docentes d ON d.id = s.docente_id WHERE d.usuario_id = $1',
    [idUsuario]
  );
  return r.rows.map((f) => f.id);
}

// Usuarios que deben recibir la notificación de un anuncio nuevo
async function destinatarios(anuncio, autorId) {
  let r;
  if (anuncio.salon_id) {
    r = await pool.query(
      `SELECT e.usuario_id AS id FROM matriculas m JOIN estudiantes e ON e.id = m.estudiante_id
       WHERE m.salon_id = $1 AND m.estado = 'activa'`,
      [anuncio.salon_id]
    );
  } else {
    const roles = anuncio.dirigido_a === 'todos' ? ['estudiante', 'docente'] : [anuncio.dirigido_a.replace(/s$/, '')];
    r = await pool.query(
      `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.activo = TRUE AND r.nombre = ANY($1::text[])`,
      [roles]
    );
  }
  return r.rows.map((f) => f.id).filter((id) => id !== autorId);
}

// ---------------------------------------------------------------
// GET /api/anuncios  — anuncios vigentes que le corresponden al usuario
// ---------------------------------------------------------------
async function obtenerAnunciosVigentes(req, res) {
  try {
    const { id_usuario, rol } = req.usuario;
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 10, 1), 50);
    const vigente = `an.activo = TRUE AND (an.expira_en IS NULL OR an.expira_en >= CURRENT_DATE)`;
    let r;

    if (ADMINISTRACION.includes(rol)) {
      r = await pool.query(
        `SELECT ${COLUMNAS} ${FROM} WHERE ${vigente} ORDER BY an.publicado_en DESC LIMIT $1`,
        [limite]
      );
    } else if (rol === 'docente') {
      r = await pool.query(
        `SELECT ${COLUMNAS} ${FROM}
         WHERE ${vigente}
           AND ((an.salon_id IS NULL AND an.dirigido_a IN ('todos', 'docentes'))
                OR an.salon_id IN (SELECT s2.id FROM salones s2 JOIN docentes d ON d.id = s2.docente_id WHERE d.usuario_id = $1))
         ORDER BY an.publicado_en DESC LIMIT $2`,
        [id_usuario, limite]
      );
    } else {
      r = await pool.query(
        `SELECT ${COLUMNAS} ${FROM}
         WHERE ${vigente}
           AND ((an.salon_id IS NULL AND an.dirigido_a IN ('todos', 'estudiantes'))
                OR an.salon_id IN (SELECT m.salon_id FROM matriculas m JOIN estudiantes e ON e.id = m.estudiante_id
                                   WHERE e.usuario_id = $1 AND m.estado = 'activa'))
         ORDER BY an.publicado_en DESC LIMIT $2`,
        [id_usuario, limite]
      );
    }

    res.json({ anuncios: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los anuncios.' });
  }
}

// ---------------------------------------------------------------
// GET /api/anuncios/gestion — para editar: admin/secretaría ven todos, el docente los suyos
// ---------------------------------------------------------------
async function obtenerAnunciosGestion(req, res) {
  try {
    const { id_usuario, rol } = req.usuario;
    const r = ADMINISTRACION.includes(rol)
      ? await pool.query(`SELECT ${COLUMNAS} ${FROM} ORDER BY an.publicado_en DESC LIMIT 200`)
      : await pool.query(`SELECT ${COLUMNAS} ${FROM} WHERE an.usuario_id = $1 ORDER BY an.publicado_en DESC LIMIT 200`, [id_usuario]);
    res.json({ anuncios: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los anuncios.' });
  }
}

// ---------------------------------------------------------------
// POST /api/anuncios
// ---------------------------------------------------------------
async function crearAnuncio(req, res) {
  try {
    const { id_usuario, rol } = req.usuario;
    const leido = leerAnuncio(req.body || {});
    if (leido.error) return res.status(400).json({ mensaje: leido.error });
    const datos = leido.datos;

    let salonId = req.body.salon_id ? Number(req.body.salon_id) : null;

    if (rol === 'docente') {
      // El docente solo publica para los estudiantes de uno de sus salones
      const propios = await idsSalonesDocente(id_usuario);
      if (!salonId || !propios.includes(salonId)) {
        return res.status(403).json({ mensaje: 'Elige uno de tus salones para publicar el anuncio.' });
      }
      datos.dirigido_a = 'estudiantes';
    } else if (salonId !== null && !Number.isInteger(salonId)) {
      return res.status(400).json({ mensaje: 'Salón inválido.' });
    }

    const r = await pool.query(
      `INSERT INTO anuncios (usuario_id, titulo, contenido, dirigido_a, salon_id, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [id_usuario, datos.titulo, datos.contenido, datos.dirigido_a, salonId, datos.expira_en]
    );

    const anuncio = { dirigido_a: datos.dirigido_a, salon_id: salonId };
    destinatarios(anuncio, id_usuario)
      .then((ids) => notificar(ids, {
        tipo: 'anuncio',
        titulo: 'Nuevo anuncio: ' + datos.titulo,
        mensaje: datos.contenido.slice(0, 160),
        enlace: null
      }))
      .catch((err) => console.error('No se pudo notificar el anuncio:', err.message));

    res.status(201).json({ mensaje: 'Anuncio publicado.', id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ mensaje: 'El salón seleccionado no existe.' });
    }
    res.status(500).json({ mensaje: 'Error al publicar el anuncio.' });
  }
}

// El autor siempre puede editar o borrar; admin y secretaría también los de otros
async function puedeGestionar(usuario, idAnuncio) {
  const r = await pool.query('SELECT usuario_id FROM anuncios WHERE id = $1', [idAnuncio]);
  if (r.rows.length === 0) return { existe: false };
  const esAutor = r.rows[0].usuario_id === usuario.id_usuario;
  return { existe: true, permitido: esAutor || ADMINISTRACION.includes(usuario.rol) };
}

// ---------------------------------------------------------------
// PUT /api/anuncios/:id
// ---------------------------------------------------------------
async function editarAnuncio(req, res) {
  try {
    const acceso = await puedeGestionar(req.usuario, req.params.id);
    if (!acceso.existe) return res.status(404).json({ mensaje: 'Anuncio no encontrado.' });
    if (!acceso.permitido) return res.status(403).json({ mensaje: 'No puedes editar este anuncio.' });

    const leido = leerAnuncio(req.body || {});
    if (leido.error) return res.status(400).json({ mensaje: leido.error });
    const datos = leido.datos;
    const activo = req.body.activo === undefined ? true : req.body.activo === true;

    const r = await pool.query(
      `UPDATE anuncios
       SET titulo = $1, contenido = $2,
           dirigido_a = CASE WHEN salon_id IS NULL THEN $3 ELSE dirigido_a END,
           expira_en = $4, activo = $5
       WHERE id = $6
       RETURNING id`,
      [datos.titulo, datos.contenido, datos.dirigido_a, datos.expira_en, activo, req.params.id]
    );
    res.json({ mensaje: 'Anuncio actualizado.', id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el anuncio.' });
  }
}

// ---------------------------------------------------------------
// DELETE /api/anuncios/:id
// ---------------------------------------------------------------
async function eliminarAnuncio(req, res) {
  try {
    const acceso = await puedeGestionar(req.usuario, req.params.id);
    if (!acceso.existe) return res.status(404).json({ mensaje: 'Anuncio no encontrado.' });
    if (!acceso.permitido) return res.status(403).json({ mensaje: 'No puedes eliminar este anuncio.' });

    await pool.query('DELETE FROM anuncios WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Anuncio eliminado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar el anuncio.' });
  }
}

module.exports = { obtenerAnunciosVigentes, obtenerAnunciosGestion, crearAnuncio, editarAnuncio, eliminarAnuncio };
