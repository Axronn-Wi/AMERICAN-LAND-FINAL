const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const pool = db.pool || db;
const { sqlFecha } = require('../utils/sql');
const { CARPETA_PERFILES } = require('../config/uploads');
const { olvidarUsuario } = require('../middleware/auth.middleware');

const REGEX_TELEFONO = /^[0-9+()\s-]{7,20}$/;

function borrarArchivo(nombre) {
  if (!nombre) return;
  fs.unlink(path.join(CARPETA_PERFILES, path.basename(nombre)), function (err) {
    if (err && err.code !== 'ENOENT') console.error('No se pudo borrar la foto anterior:', err.message);
  });
}

// Texto opcional: recortado, vacío -> null; devuelve { error } si supera el máximo
function textoOpcional(valor, maximo, nombreCampo) {
  if (valor === undefined || valor === null) return { valor: null };
  const limpio = String(valor).trim();
  if (limpio.length > maximo) return { error: `${nombreCampo} no puede superar los ${maximo} caracteres.` };
  return { valor: limpio || null };
}

// ---------------------------------------------------------------
// GET /api/perfil — datos del usuario logueado + resumen según su rol
// ---------------------------------------------------------------
async function obtenerMiPerfil(req, res) {
  try {
    const { id_usuario } = req.usuario;
    const r = await pool.query(
      `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.pais, u.ciudad,
              ${sqlFecha('u.fecha_nacimiento')} AS fecha_nacimiento,
              u.titular, u.descripcion, u.foto_url, u.creado_en,
              r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1`,
      [id_usuario]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }
    const u = r.rows[0];
    const perfil = {
      id: u.id,
      nombre_completo: u.nombre_completo,
      correo: u.correo,
      telefono: u.telefono,
      pais: u.pais,
      ciudad: u.ciudad,
      fecha_nacimiento: u.fecha_nacimiento,
      titular: u.titular,
      descripcion: u.descripcion,
      rol: u.rol,
      miembro_desde: u.creado_en,
      // La versión cambia con cada foto nueva, así el navegador no muestra la vieja
      foto: u.foto_url ? { url: `/perfil/foto/${u.id}`, version: path.basename(u.foto_url) } : null,
      extra: {}
    };

    if (u.rol === 'docente') {
      const d = await pool.query(
        `SELECT d.especialidad, ${sqlFecha('d.fecha_ingreso')} AS fecha_ingreso,
                (SELECT COUNT(*)::int FROM salones s WHERE s.docente_id = d.id) AS salones,
                (SELECT COUNT(*)::int FROM matriculas m JOIN salones s ON s.id = m.salon_id
                 WHERE s.docente_id = d.id AND m.estado = 'activa') AS alumnos,
                (SELECT COUNT(*)::int FROM tareas t JOIN salones s ON s.id = t.salon_id
                 WHERE s.docente_id = d.id) AS tareas
         FROM docentes d WHERE d.usuario_id = $1`,
        [id_usuario]
      );
      perfil.extra = d.rows[0] || {};
    } else if (u.rol === 'estudiante') {
      const e = await pool.query(
        `SELECT e.id, e.codigo_estudiante,
                (SELECT s.nombre FROM matriculas m JOIN salones s ON s.id = m.salon_id
                 WHERE m.estudiante_id = e.id AND m.estado = 'activa' ORDER BY m.id DESC LIMIT 1) AS salon,
                (SELECT n.nombre FROM matriculas m JOIN salones s ON s.id = m.salon_id JOIN niveles n ON n.id = s.nivel_id
                 WHERE m.estudiante_id = e.id AND m.estado = 'activa' ORDER BY m.id DESC LIMIT 1) AS nivel,
                (SELECT ROUND(AVG(promedio), 1)::float8 FROM notas WHERE estudiante_id = e.id AND promedio IS NOT NULL) AS promedio,
                (SELECT COUNT(*)::int FROM entregas_tareas WHERE estudiante_id = e.id) AS entregas,
                (SELECT CASE WHEN COUNT(*) FILTER (WHERE a.estado <> 'excusa') = 0 THEN NULL
                             ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE a.estado IN ('presente', 'tarde'))
                                        / COUNT(*) FILTER (WHERE a.estado <> 'excusa'), 0)::float8 END
                 FROM asistencias a WHERE a.estudiante_id = e.id) AS asistencia
         FROM estudiantes e WHERE e.usuario_id = $1`,
        [id_usuario]
      );
      const fila = e.rows[0] || {};
      delete fila.id;
      perfil.extra = fila;
    } else if (u.rol === 'secretaria' || u.rol === 'admin') {
      const tabla = u.rol === 'admin' ? 'admin' : 'secretarias';
      const a = await pool.query(`SELECT cargo, sede FROM ${tabla} WHERE usuario_id = $1`, [id_usuario]);
      perfil.extra = a.rows[0] || {};
    }

    res.json({ perfil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el perfil.' });
  }
}

// ---------------------------------------------------------------
// PUT /api/perfil — el usuario edita sus propios datos
// (nombre, correo y rol solo los cambia la administración)
// ---------------------------------------------------------------
async function actualizarMiPerfil(req, res) {
  try {
    const { id_usuario, rol } = req.usuario;
    const body = req.body || {};

    const campos = {};
    for (const [clave, maximo, nombre] of [
      ['titular', 120, 'El titular'],
      ['descripcion', 1000, 'La descripción'],
      ['ciudad', 100, 'La ciudad'],
      ['pais', 100, 'El país'],
      ['telefono', 20, 'El teléfono']
    ]) {
      const t = textoOpcional(body[clave], maximo, nombre);
      if (t.error) return res.status(400).json({ mensaje: t.error });
      campos[clave] = t.valor;
    }
    if (campos.telefono && !REGEX_TELEFONO.test(campos.telefono)) {
      return res.status(400).json({ mensaje: 'El teléfono no es válido.' });
    }

    let fecha = body.fecha_nacimiento ? String(body.fecha_nacimiento).slice(0, 10) : null;
    if (fecha) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
        return res.status(400).json({ mensaje: 'La fecha de nacimiento no es válida.' });
      }
      const anio = Number(fecha.slice(0, 4));
      if (fecha > new Date().toISOString().slice(0, 10) || anio < 1920) {
        return res.status(400).json({ mensaje: 'Revisa la fecha de nacimiento.' });
      }
    }

    await pool.query(
      `UPDATE usuarios
       SET titular = $1, descripcion = $2, ciudad = $3, pais = $4, telefono = $5,
           fecha_nacimiento = $6, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [campos.titular, campos.descripcion, campos.ciudad, campos.pais, campos.telefono, fecha, id_usuario]
    );

    if (rol === 'docente' && body.especialidad !== undefined) {
      const esp = textoOpcional(body.especialidad, 100, 'La especialidad');
      if (esp.error) return res.status(400).json({ mensaje: esp.error });
      await pool.query('UPDATE docentes SET especialidad = $1 WHERE usuario_id = $2', [esp.valor, id_usuario]);
    }

    res.json({ mensaje: 'Perfil actualizado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el perfil.' });
  }
}

// ---------------------------------------------------------------
// POST /api/perfil/foto (campo "foto") y DELETE /api/perfil/foto
// ---------------------------------------------------------------
async function subirMiFoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ mensaje: 'Adjunta una imagen en el campo "foto".' });
  }
  try {
    const anterior = await pool.query('SELECT foto_url FROM usuarios WHERE id = $1', [req.usuario.id_usuario]);
    await pool.query(
      'UPDATE usuarios SET foto_url = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2',
      [req.file.filename, req.usuario.id_usuario]
    );
    if (anterior.rows[0]) borrarArchivo(anterior.rows[0].foto_url);
    res.status(201).json({
      mensaje: 'Foto actualizada.',
      foto: { url: `/perfil/foto/${req.usuario.id_usuario}`, version: req.file.filename }
    });
  } catch (err) {
    console.error(err);
    borrarArchivo(req.file.filename);
    res.status(500).json({ mensaje: 'Error al guardar la foto.' });
  }
}

async function eliminarMiFoto(req, res) {
  try {
    const r = await pool.query(
      `UPDATE usuarios u SET foto_url = NULL FROM usuarios v
       WHERE u.id = v.id AND u.id = $1
       RETURNING v.foto_url AS anterior`,
      [req.usuario.id_usuario]
    );
    if (r.rows[0]) borrarArchivo(r.rows[0].anterior);
    res.json({ mensaje: 'Foto eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar la foto.' });
  }
}

// ---------------------------------------------------------------
// GET /api/perfil/foto/:id — pública (las etiquetas <img> no envían token)
// ---------------------------------------------------------------
async function verFoto(req, res) {
  try {
    const r = await pool.query('SELECT foto_url FROM usuarios WHERE id = $1 AND activo = TRUE', [req.params.id]);
    const nombre = r.rows[0] && r.rows[0].foto_url;
    if (!nombre) return res.status(404).json({ mensaje: 'Este usuario no tiene foto.' });

    const ruta = path.join(CARPETA_PERFILES, path.basename(nombre));
    if (!fs.existsSync(ruta)) return res.status(404).json({ mensaje: 'La foto ya no está en el servidor.' });

    // El frontend vive en otro dominio (Vercel): hay que permitir que muestre la imagen
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=604800');
    res.sendFile(ruta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener la foto.' });
  }
}

// ---------------------------------------------------------------
// PUT /api/perfil/contrasena  { actual, nueva }
// ---------------------------------------------------------------
async function cambiarMiContrasena(req, res) {
  try {
    const { actual, nueva } = req.body || {};
    if (typeof actual !== 'string' || typeof nueva !== 'string' || !actual) {
      return res.status(400).json({ mensaje: 'Escribe tu contraseña actual y la nueva.' });
    }
    if (nueva.length < 6) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    if (nueva === actual) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe ser diferente a la actual.' });
    }

    const r = await pool.query('SELECT contrasena_hash FROM usuarios WHERE id = $1', [req.usuario.id_usuario]);
    if (r.rows.length === 0 || !(await bcrypt.compare(actual, r.rows[0].contrasena_hash))) {
      return res.status(400).json({ mensaje: 'La contraseña actual no es correcta.' });
    }

    const hash = await bcrypt.hash(nueva, 10);
    await pool.query(
      'UPDATE usuarios SET contrasena_hash = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2',
      [hash, req.usuario.id_usuario]
    );
    olvidarUsuario(req.usuario.id_usuario);
    res.json({ mensaje: 'Tu contraseña se actualizó.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al cambiar la contraseña.' });
  }
}

module.exports = { obtenerMiPerfil, actualizarMiPerfil, subirMiFoto, eliminarMiFoto, verFoto, cambiarMiContrasena };
