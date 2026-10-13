const path = require('path');
const fs = require('fs');
const { sql, getPool } = require('../config/db');

// Misma carpeta que usa material.middleware.js (se define en src/config/uploads.js)
const CARPETA = require('../config/uploads').CARPETA_MATERIAL;

async function descargarMaterial(req, res) {
  try {
    const id_material = parseInt(req.params.id, 10);
    if (isNaN(id_material)) {
      return res.status(400).json({ mensaje: 'Id de material inválido.' });
    }

    const pool = await getPool();

    // 1. Datos del material y de quién es dueño del salón
    const materialResult = await pool.request()
      .input('id_material', sql.Int, id_material)
      .query(`SELECT m.archivo_url, m.salon_id, m.publico, s.docente_id
              FROM Material_Apoyo m
              JOIN Salones s ON m.salon_id = s.id
              WHERE m.id = @id_material`);

    if (materialResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Material no encontrado.' });
    }
    const material = materialResult.recordset[0];

    // 2. ¿Quién pide el archivo?
    const { id_usuario, rol } = req.usuario;
    let autorizado = false;

    if (rol === 'docente') {
      const r = await pool.request()
        .input('usuario_id', sql.Int, id_usuario)
        .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');
      autorizado = r.recordset.length > 0 && r.recordset[0].id === material.docente_id;

    } else if (rol === 'estudiante') {
      // El material debe estar visible
      if (material.publico) {
        const r = await pool.request()
          .input('usuario_id', sql.Int, id_usuario)
          .input('salon_id', sql.Int, material.salon_id)
          .query(`SELECT m.id
                  FROM Estudiantes e
                  JOIN Matriculas m ON m.estudiante_id = e.id
                  WHERE e.usuario_id = @usuario_id
                    AND m.salon_id = @salon_id
                    AND m.estado = 'activa'`);
        autorizado = r.recordset.length > 0;
      }
    }

    if (!autorizado) {
      return res.status(403).json({ mensaje: 'No tienes permiso para descargar este archivo.' });
    }

    // 3. ¿Hay archivo y existe en el disco?
    if (!material.archivo_url) {
      return res.status(404).json({ mensaje: 'Este material no tiene archivo.' });
    }
    const nombreEnDisco = path.basename(material.archivo_url);
    const ruta = path.join(CARPETA, nombreEnDisco);

    if (!fs.existsSync(ruta)) {
      return res.status(404).json({ mensaje: 'El archivo ya no está en el servidor.' });
    }

    // 4. Enviar con un nombre legible
    const extension = path.extname(nombreEnDisco);
    res.download(ruta, 'material-' + id_material + extension);

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al descargar el archivo.' });
  }
}

module.exports = { descargarMaterial };