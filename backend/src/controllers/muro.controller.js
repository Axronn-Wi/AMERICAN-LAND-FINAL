const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const pool = db.pool || db;
const { CARPETA_MURO } = require('../config/uploads');
const { notificar } = require('../utils/notificar');

const MODERADORES = ['admin', 'secretaria'];
const MAX_TEXTO = 2200;
const MAX_COMENTARIO = 500;

function borrarImagen(nombre) {
  if (!nombre) return;
  fs.unlink(path.join(CARPETA_MURO, path.basename(nombre)), function (err) {
    if (err && err.code !== 'ENOENT') console.error('No se pudo borrar la imagen del muro:', err.message);
  });
}

// A los visitantes sin sesión solo se les muestra "Nombre A." (cuida la privacidad
// de los estudiantes); quien inició sesión ve el nombre completo
function nombreVisible(nombreCompleto, conSesion) {
  if (conSesion) return nombreCompleto;
  const partes = String(nombreCompleto || '').trim().split(/\s+/);
  if (partes.length < 2) return partes[0] || 'Usuario';
  return partes[0] + ' ' + partes[partes.length - 1].charAt(0).toUpperCase() + '.';
}

function autorPublico(fila, req) {
  return {
    id: fila.autor_id,
    nombre: nombreVisible(fila.autor_nombre, !!req.usuario),
    rol: fila.autor_rol,
    foto: fila.autor_foto ? `/perfil/foto/${fila.autor_id}?v=${encodeURIComponent(path.basename(fila.autor_foto))}` : null
  };
}

function puedeBorrar(req, autorId, duenoPublicacion) {
  if (!req.usuario) return false;
  return req.usuario.id_usuario === autorId ||
    req.usuario.id_usuario === duenoPublicacion ||
    MODERADORES.includes(req.usuario.rol);
}

const SQL_AUTOR = `
  u.id AS autor_id, u.nombre_completo AS autor_nombre, u.foto_url AS autor_foto, r.nombre AS autor_rol`;

// ---------------------------------------------------------------
// GET /api/muro/publicaciones?antes=ID&limite=12  (público)
// ---------------------------------------------------------------
async function listarPublicaciones(req, res) {
  try {
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 12, 1), 30);
    const antes = parseInt(req.query.antes, 10) || null;
    const yo = req.usuario ? req.usuario.id_usuario : null;

    const r = await pool.query(
      `SELECT p.id, p.texto, p.imagen_url, p.creada_en, ${SQL_AUTOR},
              (SELECT COUNT(*)::int FROM publicacion_likes l WHERE l.publicacion_id = p.id) AS likes,
              (SELECT COUNT(*)::int FROM publicacion_comentarios c WHERE c.publicacion_id = p.id) AS comentarios,
              EXISTS (SELECT 1 FROM publicacion_likes l WHERE l.publicacion_id = p.id AND l.usuario_id = $3) AS me_gusta
       FROM publicaciones p
       JOIN usuarios u ON u.id = p.usuario_id AND u.activo = TRUE
       JOIN roles r ON r.id = u.rol_id
       WHERE ($1::int IS NULL OR p.id < $1)
       ORDER BY p.id DESC
       LIMIT $2`,
      [antes, limite + 1, yo]
    );
    const hayMas = r.rows.length > limite;
    const filas = r.rows.slice(0, limite);

    // Últimos 2 comentarios de cada publicación (vista previa)
    const ids = filas.map((f) => f.id);
    const previos = {};
    if (ids.length > 0) {
      const c = await pool.query(
        `SELECT * FROM (
           SELECT c.id, c.publicacion_id, c.texto, c.creado_en, ${SQL_AUTOR},
                  ROW_NUMBER() OVER (PARTITION BY c.publicacion_id ORDER BY c.id DESC) AS n
           FROM publicacion_comentarios c
           JOIN usuarios u ON u.id = c.usuario_id AND u.activo = TRUE
           JOIN roles r ON r.id = u.rol_id
           WHERE c.publicacion_id = ANY($1::int[])
         ) t WHERE n <= 2 ORDER BY id ASC`,
        [ids]
      );
      c.rows.forEach((fila) => {
        (previos[fila.publicacion_id] = previos[fila.publicacion_id] || []).push({
          id: fila.id, texto: fila.texto, creado_en: fila.creado_en, autor: autorPublico(fila, req)
        });
      });
    }

    res.json({
      publicaciones: filas.map((f) => ({
        id: f.id,
        texto: f.texto,
        creada_en: f.creada_en,
        imagen: `/muro/imagen/${f.id}?v=${encodeURIComponent(path.basename(f.imagen_url))}`,
        autor: autorPublico(f, req),
        likes: f.likes,
        comentarios: f.comentarios,
        me_gusta: f.me_gusta,
        puede_borrar: puedeBorrar(req, f.autor_id, f.autor_id),
        vista_comentarios: previos[f.id] || []
      })),
      hay_mas: hayMas,
      con_sesion: !!req.usuario
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al cargar el muro.' });
  }
}

// ---------------------------------------------------------------
// GET /api/muro/publicaciones/:id/comentarios  (público)
// ---------------------------------------------------------------
async function listarComentarios(req, res) {
  try {
    const pub = await pool.query('SELECT usuario_id FROM publicaciones WHERE id = $1', [req.params.id]);
    if (pub.rows.length === 0) return res.status(404).json({ mensaje: 'La publicación ya no existe.' });
    const dueno = pub.rows[0].usuario_id;

    const r = await pool.query(
      `SELECT c.id, c.texto, c.creado_en, ${SQL_AUTOR}
       FROM publicacion_comentarios c
       JOIN usuarios u ON u.id = c.usuario_id AND u.activo = TRUE
       JOIN roles r ON r.id = u.rol_id
       WHERE c.publicacion_id = $1
       ORDER BY c.id ASC
       LIMIT 300`,
      [req.params.id]
    );
    res.json({
      comentarios: r.rows.map((f) => ({
        id: f.id, texto: f.texto, creado_en: f.creado_en,
        autor: autorPublico(f, req),
        puede_borrar: puedeBorrar(req, f.autor_id, dueno)
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al cargar los comentarios.' });
  }
}

// ---------------------------------------------------------------
// GET /api/muro/imagen/:id  (pública)
// ---------------------------------------------------------------
async function verImagen(req, res) {
  try {
    const r = await pool.query('SELECT imagen_url FROM publicaciones WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ mensaje: 'Imagen no encontrada.' });
    const ruta = path.join(CARPETA_MURO, path.basename(r.rows[0].imagen_url));
    if (!fs.existsSync(ruta)) return res.status(404).json({ mensaje: 'La imagen ya no está en el servidor.' });
    // El frontend vive en otro dominio (Vercel): hay que permitir que muestre la imagen
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=2592000, immutable');
    res.sendFile(ruta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener la imagen.' });
  }
}

// ---------------------------------------------------------------
// POST /api/muro/publicaciones  (campo "imagen" + "texto")
// ---------------------------------------------------------------
async function crearPublicacion(req, res) {
  if (!req.file) {
    return res.status(400).json({ mensaje: 'Agrega una foto para publicar.' });
  }
  try {
    const texto = typeof (req.body && req.body.texto) === 'string' ? req.body.texto.trim() : '';
    if (texto.length > MAX_TEXTO) {
      borrarImagen(req.file.filename);
      return res.status(400).json({ mensaje: `La descripción no puede superar los ${MAX_TEXTO} caracteres.` });
    }
    const r = await pool.query(
      'INSERT INTO publicaciones (usuario_id, texto, imagen_url) VALUES ($1, $2, $3) RETURNING id',
      [req.usuario.id_usuario, texto, req.file.filename]
    );
    res.status(201).json({ mensaje: 'Publicación compartida.', id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    borrarImagen(req.file.filename);
    res.status(500).json({ mensaje: 'Error al publicar.' });
  }
}

// ---------------------------------------------------------------
// DELETE /api/muro/publicaciones/:id  (autor, admin o secretaría)
// ---------------------------------------------------------------
async function eliminarPublicacion(req, res) {
  try {
    const r = await pool.query('SELECT usuario_id, imagen_url FROM publicaciones WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ mensaje: 'La publicación ya no existe.' });
    const pub = r.rows[0];
    if (!puedeBorrar(req, pub.usuario_id, pub.usuario_id)) {
      return res.status(403).json({ mensaje: 'Solo el autor o la administración pueden eliminar esta publicación.' });
    }
    await pool.query('DELETE FROM publicaciones WHERE id = $1', [req.params.id]);
    borrarImagen(pub.imagen_url);
    res.json({ mensaje: 'Publicación eliminada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar la publicación.' });
  }
}

// ---------------------------------------------------------------
// POST /api/muro/publicaciones/:id/me-gusta  (alterna)
// ---------------------------------------------------------------
async function alternarMeGusta(req, res) {
  try {
    const yo = req.usuario.id_usuario;
    const existe = await pool.query('SELECT 1 FROM publicaciones WHERE id = $1', [req.params.id]);
    if (existe.rows.length === 0) return res.status(404).json({ mensaje: 'La publicación ya no existe.' });

    const nuevo = await pool.query(
      `INSERT INTO publicacion_likes (publicacion_id, usuario_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING 1`,
      [req.params.id, yo]
    );
    let meGusta = true;
    if (nuevo.rows.length === 0) {
      await pool.query('DELETE FROM publicacion_likes WHERE publicacion_id = $1 AND usuario_id = $2', [req.params.id, yo]);
      meGusta = false;
    }
    const total = await pool.query('SELECT COUNT(*)::int AS n FROM publicacion_likes WHERE publicacion_id = $1', [req.params.id]);
    res.json({ me_gusta: meGusta, likes: total.rows[0].n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar el me gusta.' });
  }
}

// ---------------------------------------------------------------
// POST /api/muro/publicaciones/:id/comentarios  { texto }
// ---------------------------------------------------------------
async function comentar(req, res) {
  try {
    const texto = typeof (req.body && req.body.texto) === 'string' ? req.body.texto.trim() : '';
    if (!texto) return res.status(400).json({ mensaje: 'Escribe un comentario.' });
    if (texto.length > MAX_COMENTARIO) {
      return res.status(400).json({ mensaje: `El comentario no puede superar los ${MAX_COMENTARIO} caracteres.` });
    }
    const pub = await pool.query('SELECT usuario_id FROM publicaciones WHERE id = $1', [req.params.id]);
    if (pub.rows.length === 0) return res.status(404).json({ mensaje: 'La publicación ya no existe.' });

    const r = await pool.query(
      'INSERT INTO publicacion_comentarios (publicacion_id, usuario_id, texto) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, req.usuario.id_usuario, texto]
    );

    // Aviso al autor de la publicación (si no es él mismo quien comenta)
    const dueno = pub.rows[0].usuario_id;
    if (dueno !== req.usuario.id_usuario) {
      const quien = await pool.query('SELECT nombre_completo FROM usuarios WHERE id = $1', [req.usuario.id_usuario]);
      notificar([dueno], {
        tipo: 'muro',
        titulo: 'Nuevo comentario en tu publicación',
        mensaje: `${quien.rows[0] ? quien.rows[0].nombre_completo : 'Alguien'}: "${texto.slice(0, 120)}"`,
        enlace: '/index.html#muro'
      });
    }

    res.status(201).json({ mensaje: 'Comentario publicado.', id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al comentar.' });
  }
}

// ---------------------------------------------------------------
// DELETE /api/muro/comentarios/:id  (autor, dueño de la publicación o administración)
// ---------------------------------------------------------------
async function eliminarComentario(req, res) {
  try {
    const r = await pool.query(
      `SELECT c.usuario_id, p.usuario_id AS dueno
       FROM publicacion_comentarios c JOIN publicaciones p ON p.id = c.publicacion_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ mensaje: 'El comentario ya no existe.' });
    if (!puedeBorrar(req, r.rows[0].usuario_id, r.rows[0].dueno)) {
      return res.status(403).json({ mensaje: 'No puedes eliminar este comentario.' });
    }
    await pool.query('DELETE FROM publicacion_comentarios WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Comentario eliminado.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar el comentario.' });
  }
}

module.exports = {
  listarPublicaciones, listarComentarios, verImagen,
  crearPublicacion, eliminarPublicacion, alternarMeGusta, comentar, eliminarComentario
};
