const path = require('path');
const db = require('../config/db');
const { enviarArchivo } = require('../utils/archivos');
const pool = db.pool || db;

// Misma carpeta que usa material.middleware.js (se define en src/config/uploads.js)
const CARPETA = require('../config/uploads').CARPETA_MATERIAL;

async function descargarMaterial(req, res) {
  try {
    const id_material = parseInt(req.params.id, 10);
    if (isNaN(id_material)) {
      return res.status(400).json({ mensaje: 'Id de material inválido.' });
    }

    // 1. Datos del material y de quién es dueño del salón
    const materialResult = await pool.query(
      `SELECT m.archivo_url, m.salon_id, m.publico, s.docente_id
       FROM material_apoyo m
       JOIN salones s ON m.salon_id = s.id
       WHERE m.id = $1`,
      [id_material]
    );

    if (materialResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Material no encontrado.' });
    }
    const material = materialResult.rows[0];

    // 2. ¿Quién pide el archivo?
    const { id_usuario, rol } = req.usuario;
    let autorizado = false;

    if (rol === 'docente') {
      const r = await pool.query('SELECT id FROM docentes WHERE usuario_id = $1', [id_usuario]);
      autorizado = r.rows.length > 0 && r.rows[0].id === material.docente_id;

    } else if (rol === 'estudiante') {
      // El material debe estar visible
      if (material.publico) {
        const r = await pool.query(
          `SELECT m.id
           FROM estudiantes e
           JOIN matriculas m ON m.estudiante_id = e.id
           WHERE e.usuario_id = $1
             AND m.salon_id = $2
             AND m.estado = 'activa'`,
          [id_usuario, material.salon_id]
        );
        autorizado = r.rows.length > 0;
      }
    }

    if (!autorizado) {
      return res.status(403).json({ mensaje: 'No tienes permiso para descargar este archivo.' });
    }

    // 3. ¿Hay archivo?
    if (!material.archivo_url) {
      return res.status(404).json({ mensaje: 'Este material no tiene archivo.' });
    }

    // 4. Enviar con un nombre legible
    const extension = path.extname(material.archivo_url);
    const enviado = await enviarArchivo(res, material.archivo_url, {
      descarga: 'material-' + id_material + extension,
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

// ---------------------------------------------------------------
// GET /api/tareas/:id/archivo  (guía o taller adjunto a una tarea)
// Lo descargan el docente del salón y los estudiantes con matrícula activa.
// ---------------------------------------------------------------
async function descargarArchivoTarea(req, res) {
  try {
    const r = await pool.query(
      `SELECT t.archivo_url, t.archivo_nombre, t.salon_id, s.docente_id
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada.' });
    }
    const tarea = r.rows[0];

    const { id_usuario, rol } = req.usuario;
    let autorizado = false;
    if (rol === 'docente') {
      const d = await pool.query('SELECT id FROM docentes WHERE usuario_id = $1', [id_usuario]);
      autorizado = d.rows.length > 0 && d.rows[0].id === tarea.docente_id;
    } else if (rol === 'estudiante') {
      const m = await pool.query(
        `SELECT m.id
         FROM estudiantes e
         JOIN matriculas m ON m.estudiante_id = e.id
         WHERE e.usuario_id = $1 AND m.salon_id = $2 AND m.estado = 'activa'`,
        [id_usuario, tarea.salon_id]
      );
      autorizado = m.rows.length > 0;
    }
    if (!autorizado) {
      return res.status(403).json({ mensaje: 'No tienes permiso para descargar este archivo.' });
    }

    if (!tarea.archivo_url) {
      return res.status(404).json({ mensaje: 'Esta tarea no tiene archivo adjunto.' });
    }
    const extension = path.extname(tarea.archivo_url);
    const enviado = await enviarArchivo(res, tarea.archivo_url, {
      descarga: tarea.archivo_nombre || ('tarea-' + req.params.id + extension),
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

module.exports = { descargarMaterial, descargarArchivoTarea };