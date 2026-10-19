const path = require('path');
const db = require('../config/db');
const { enviarArchivo } = require('../utils/archivos');
const pool = db.pool || db;

// Misma carpeta que usa upload.middleware.js (se define en src/config/uploads.js)
const CARPETA = require('../config/uploads').CARPETA_ENTREGAS;

async function descargarEntrega(req, res) {
  try {
    const id_entrega = parseInt(req.params.id, 10);
    if (isNaN(id_entrega)) {
      return res.status(400).json({ mensaje: 'Id de entrega inválido.' });
    }

    // 1. Datos de la entrega y de quién es dueño del salón
    const entregaResult = await pool.query(
      `SELECT e.archivo_url, e.estudiante_id, s.docente_id
       FROM entregas_tareas e
       JOIN tareas t ON e.tarea_id = t.id
       JOIN salones s ON t.salon_id = s.id
       WHERE e.id = $1`,
      [id_entrega]
    );

    if (entregaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Entrega no encontrada.' });
    }
    const entrega = entregaResult.rows[0];

    // 2. ¿Quién pide el archivo? Se compara con el dueño según el rol
    const { id_usuario, rol } = req.usuario;
    let autorizado = false;

      if (rol === 'estudiante') {
      const r = await pool.query('SELECT id FROM estudiantes WHERE usuario_id = $1', [id_usuario]);
      autorizado = r.rows.length > 0 && r.rows[0].id === entrega.estudiante_id;
    } else if (rol === 'docente') {
      const r = await pool.query('SELECT id FROM docentes WHERE usuario_id = $1', [id_usuario]);
      autorizado = r.rows.length > 0 && r.rows[0].id === entrega.docente_id;
    }

    if (!autorizado) {
      return res.status(403).json({ mensaje: 'No tienes permiso para descargar este archivo.' });
    }

    // 3. ¿Hay archivo?
    if (!entrega.archivo_url) {
      return res.status(404).json({ mensaje: 'Esta entrega no tiene archivo.' });
    }

    // 4. Enviar con un nombre legible
    const extension = path.extname(entrega.archivo_url);
    const enviado = await enviarArchivo(res, entrega.archivo_url, {
      descarga: 'entrega-' + id_entrega + extension,
      carpetaAntigua: CARPETA
    });
    if (!enviado) {
      return res.status(404).json({ mensaje: 'El archivo ya no está en el servidor.' });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al descargar el archivo.' });
  }
}

module.exports = { descargarEntrega };