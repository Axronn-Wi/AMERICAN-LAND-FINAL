const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const pool = db.pool || db;

// ---------------------------------------------------------------
// Archivos subidos guardados en PostgreSQL (tabla "archivos").
//
// El disco de Render es temporal: cada reinicio o despliegue borra lo que
// se haya escrito en él. Por eso fotos, guías, material y entregas se
// guardan en la base de datos. Las tablas siguen guardando solo el nombre
// del archivo (ej. "p3-1792...-ab12.jpg"), que es la llave en "archivos".
// ---------------------------------------------------------------

// El tipo se decide por la extensión (que ya validó cada middleware),
// nunca por lo que diga el navegador
const TIPOS_MIME = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg'
};

function tipoDe(nombre) {
  return TIPOS_MIME[path.extname(nombre).toLowerCase()] || 'application/octet-stream';
}

// Motor de almacenamiento para multer: recibe el archivo en memoria y lo
// inserta en la base de datos. "nombrar(req, file)" devuelve el nombre único.
function almacenEnBD(nombrar) {
  return {
    _handleFile(req, file, cb) {
      let nombre;
      try {
        nombre = nombrar(req, file);
      } catch (err) {
        return cb(err);
      }
      const partes = [];
      let excedido = false;
      file.stream.on('data', (parte) => partes.push(parte));
      // Si supera el límite, multer responde el error: aquí no se guarda nada
      file.stream.on('limit', () => { excedido = true; });
      file.stream.on('error', cb);
      file.stream.on('end', () => {
        if (excedido) return cb(null, { filename: nombre, path: nombre, size: 0 });
        const datos = Buffer.concat(partes);
        pool.query(
          'INSERT INTO archivos (nombre, tipo_mime, tamano, datos) VALUES ($1, $2, $3, $4)',
          [nombre, tipoDe(nombre), datos.length, datos]
        ).then(
          // "path" se deja igual al nombre para que el código existente siga funcionando
          () => cb(null, { filename: nombre, path: nombre, size: datos.length }),
          cb
        );
      });
    },
    _removeFile(req, file, cb) {
      eliminarArchivo(file.filename).then(() => cb(null), cb);
    }
  };
}

// Borra un archivo (por nombre o ruta). Nunca lanza error: un archivo
// huérfano no debe tumbar la acción principal.
async function eliminarArchivo(nombreORuta, carpetaAntigua) {
  if (!nombreORuta) return;
  const nombre = path.basename(nombreORuta);
  try {
    await pool.query('DELETE FROM archivos WHERE nombre = $1', [nombre]);
  } catch (err) {
    console.error('No se pudo borrar el archivo', nombre, err.message);
  }
  // Archivos subidos antes de este cambio (solo existen en el disco local)
  if (carpetaAntigua) {
    fs.unlink(path.join(carpetaAntigua, nombre), () => {});
  }
}

// Envía un archivo al navegador. Devuelve false si no existe, para que
// cada controlador responda su propio 404.
//   opciones.descarga  -> nombre con el que se descarga (Content-Disposition)
//   opciones.cache     -> valor de Cache-Control
//   opciones.carpetaAntigua -> carpeta en disco donde buscar archivos viejos
async function enviarArchivo(res, nombreORuta, opciones) {
  const op = opciones || {};
  if (!nombreORuta) return false;
  const nombre = path.basename(nombreORuta);

  const r = await pool.query('SELECT tipo_mime, datos FROM archivos WHERE nombre = $1', [nombre]);
  if (r.rows.length > 0) {
    if (op.cache) res.set('Cache-Control', op.cache);
    if (op.descarga) res.attachment(op.descarga);
    res.type(r.rows[0].tipo_mime);
    res.send(r.rows[0].datos);
    return true;
  }

  if (op.carpetaAntigua) {
    const ruta = path.join(op.carpetaAntigua, nombre);
    if (fs.existsSync(ruta)) {
      if (op.cache) res.set('Cache-Control', op.cache);
      if (op.descarga) res.download(ruta, op.descarga);
      else res.sendFile(ruta);
      return true;
    }
  }
  return false;
}

module.exports = { almacenEnBD, eliminarArchivo, enviarArchivo };
