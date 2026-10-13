const path = require('path');
const fs = require('fs');
const { sql, getPool } = require('../config/db');

// Misma carpeta que usa upload.middleware.js (se define en src/config/uploads.js)
const CARPETA = require('../config/uploads').CARPETA_ENTREGAS;

async function descargarEntrega(req, res) {
  try {
    const id_entrega = parseInt(req.params.id, 10);
    if (isNaN(id_entrega)) {
      return res.status(400).json({ mensaje: 'Id de entrega inválido.' });
    }

    const pool = await getPool();

    // 1. Datos de la entrega y de quién es dueño del salón
    const entregaResult = await pool.request()
      .input('id_entrega', sql.Int, id_entrega)
      .query(`SELECT e.archivo_url, e.estudiante_id, s.docente_id
              FROM Entregas_Tareas e
              JOIN Tareas t ON e.tarea_id = t.id
              JOIN Salones s ON t.salon_id = s.id
              WHERE e.id = @id_entrega`);

    if (entregaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Entrega no encontrada.' });
    }
    const entrega = entregaResult.recordset[0];

    // 2. ¿Quién pide el archivo? Se compara con el dueño según el rol
    const { id_usuario, rol } = req.usuario;
    let autorizado = false;

    if (rol === 'estudiante') {
      const r = await pool.request()
        .input('usuario_id', sql.Int, id_usuario)
        .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');
      autorizado = r.recordset.length > 0 && r.recordset[0].id === entrega.estudiante_id;
    } else if (rol === 'docente') {
      const r = await pool.request()
        .input('usuario_id', sql.Int, id_usuario)
        .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');
      autorizado = r.recordset.length > 0 && r.recordset[0].id === entrega.docente_id;
    }

    if (!autorizado) {
      return res.status(403).json({ mensaje: 'No tienes permiso para descargar este archivo.' });
    }

    // 3. ¿Hay archivo y existe en el disco?
    if (!entrega.archivo_url) {
      return res.status(404).json({ mensaje: 'Esta entrega no tiene archivo.' });
    }
    const nombreEnDisco = path.basename(entrega.archivo_url);
    const ruta = path.join(CARPETA, nombreEnDisco);

    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ mensaje: 'El archivo ya no está en el servidor.' });
    }

    // 4. Enviar con un nombre legible
    const extension = path.extname(nombreEnDisco);
    res.download(ruta, 'entrega-' + id_entrega + extension);

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al descargar el archivo.' });
  }
}

module.exports = { descargarEntrega };