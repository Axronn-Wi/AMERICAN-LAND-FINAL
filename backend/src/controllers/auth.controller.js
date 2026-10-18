const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const pool = db.pool || db;
const { transaccion, normalizarCorreo, REGEX_CORREO } = require('../utils/sql');
const { enviarCorreo } = require('../utils/correo');

const MENSAJE_CREDENCIALES = 'Correo, contraseña o rol incorrectos.';

async function registro(req, res) {
  try {
    const { nombre_completo, contrasena, telefono, fecha_nacimiento, pais, ciudad } = req.body;
    const correo = normalizarCorreo(req.body.correo);
    const nombre = nombre_completo ? String(nombre_completo).trim() : '';

    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios.' });
    }
    if (nombre.length > 150) {
      return res.status(400).json({ mensaje: 'El nombre no puede superar los 150 caracteres.' });
    }
    if (!REGEX_CORREO.test(correo)) {
      return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
    }
    if (typeof contrasena !== 'string' || contrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existente = await pool.query('SELECT id FROM usuarios WHERE LOWER(correo) = $1', [correo]);
    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    const rolResult = await pool.query("SELECT id FROM roles WHERE LOWER(nombre) = 'estudiante'");
    if (rolResult.rows.length === 0) {
      console.error('No existe el rol "estudiante" en la tabla roles.');
      return res.status(500).json({ mensaje: 'Error en el servidor al registrar usuario.' });
    }
    const id_rol = rolResult.rows[0].id;

    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // Usuario + perfil de estudiante se guardan juntos o no se guarda nada
    const nuevoUsuarioId = await transaccion(async (cliente) => {
      const resUsuario = await cliente.query(
        `INSERT INTO usuarios (rol_id, nombre_completo, correo, contrasena_hash, telefono, fecha_nacimiento, pais, ciudad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [id_rol, nombre, correo, contrasena_hash, telefono || null, fecha_nacimiento || null, pais || null, ciudad || null]
      );

      const id = resUsuario.rows[0].id;
      const codigo_estudiante = `EST${String(id).padStart(4, '0')}`;

      await cliente.query(
        `INSERT INTO estudiantes (usuario_id, codigo_estudiante, estado)
         VALUES ($1, $2, 'activo')`,
        [id, codigo_estudiante]
      );

      return id;
    });

    return res.status(201).json({ mensaje: 'Usuario registrado exitosamente.', id: nuevoUsuarioId });

  } catch (err) {
    // 23505 = correo duplicado (dos registros al mismo tiempo)
    if (err.code === '23505') {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }
    console.error('Error en registro:', err);
    return res.status(500).json({ mensaje: 'Error en el servidor al registrar usuario.' });
  }
}

async function login(req, res) {
  try {
    const { contrasena, rol } = req.body;
    const correo = normalizarCorreo(req.body.correo);

    if (!correo || !contrasena || !rol) {
      return res.status(400).json({ mensaje: 'Correo, contraseña y rol son obligatorios.' });
    }

    const result = await pool.query(
      `SELECT u.id, u.nombre_completo, u.correo, u.contrasena_hash, u.activo, r.nombre AS nombre_rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE LOWER(u.correo) = $1`,
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: MENSAJE_CREDENCIALES });
    }

    const usuario = result.rows[0];

    // Primero la contraseña: así nadie puede averiguar qué rol tiene un correo sin conocer su clave
    const contrasenaValida = await bcrypt.compare(String(contrasena), usuario.contrasena_hash);
    if (!contrasenaValida || usuario.nombre_rol.toLowerCase() !== String(rol).toLowerCase()) {
      return res.status(401).json({ mensaje: MENSAJE_CREDENCIALES });
    }

    if (!usuario.activo) {
      return res.status(403).json({ mensaje: 'Este usuario se encuentra inactivo. Comunícate con la administración.' });
    }

    const token = jwt.sign(
      { id_usuario: usuario.id, rol: usuario.nombre_rol, correo: usuario.correo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        id: usuario.id,
        nombre_completo: usuario.nombre_completo,
        correo: usuario.correo,
        rol: usuario.nombre_rol
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ mensaje: 'Error en el servidor al iniciar sesión.' });
  }
}

const MENSAJE_RECUPERAR = 'Si el correo está registrado, te enviaremos un enlace para restablecer tu contraseña.';
const VIGENCIA_TOKEN_MS = 60 * 60 * 1000; // 1 hora

// El token viaja en el enlace; en la base solo se guarda su hash
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function enviarEnlaceRecuperacion(usuario) {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + VIGENCIA_TOKEN_MS);

  // Un enlace nuevo anula los anteriores que no se usaron
  await transaccion(async (cliente) => {
    await cliente.query(
      'UPDATE tokens_recuperacion SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL',
      [usuario.id]
    );
    await cliente.query(
      'INSERT INTO tokens_recuperacion (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)',
      [usuario.id, hashToken(token), expira]
    );
  });

  // El token va en el "#" para que no quede en registros de servidores ni en el Referer
  const base = (process.env.FRONTEND_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const enlace = `${base}/auth/restablecer.html#token=${token}`;

  await enviarCorreo({
    para: usuario.correo,
    asunto: 'Restablece tu contraseña - Instituto American Land',
    texto: `Hola ${usuario.nombre_completo}:

` +
      `Recibimos una solicitud para restablecer tu contraseña. Abre este enlace para crear una nueva:
${enlace}

` +
      'El enlace vence en 1 hora y solo se puede usar una vez. Si no fuiste tú, ignora este correo.',
    html: `<p>Hola ${escaparHtml(usuario.nombre_completo)}:</p>
      <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva:</p>
      <p><a href="${enlace}" style="display:inline-block;padding:12px 22px;background:#1a3a8f;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Restablecer contraseña</a></p>
      <p>O copia este enlace en tu navegador:<br>${enlace}</p>
      <p>El enlace vence en <strong>1 hora</strong> y solo se puede usar una vez. Si no fuiste tú, ignora este correo.</p>`
  });
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function recuperar(req, res) {
  const correo = normalizarCorreo(req.body && req.body.correo);
  if (!REGEX_CORREO.test(correo)) {
    return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
  }

  // Se responde igual exista o no la cuenta, y sin esperar el envío,
  // así nadie puede averiguar qué correos están registrados
  res.json({ mensaje: MENSAJE_RECUPERAR });

  try {
    const result = await pool.query(
      'SELECT id, nombre_completo, correo FROM usuarios WHERE LOWER(correo) = $1 AND activo = TRUE',
      [correo]
    );
    if (result.rows.length > 0) {
      await enviarEnlaceRecuperacion(result.rows[0]);
    }
  } catch (err) {
    console.error('Error en recuperar contraseña:', err);
  }
}

async function restablecer(req, res) {
  try {
    const { token, contrasena } = req.body || {};

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ mensaje: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
    }
    if (typeof contrasena !== 'string' || contrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    const cambiada = await transaccion(async (cliente) => {
      // Marcar el token como usado en la misma consulta evita que dos peticiones lo usen a la vez
      const resToken = await cliente.query(
        `UPDATE tokens_recuperacion SET usado_en = NOW()
         WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > NOW()
         RETURNING usuario_id`,
        [hashToken(token)]
      );
      if (resToken.rows.length === 0) return false;

      const usuarioId = resToken.rows[0].usuario_id;
      await cliente.query(
        'UPDATE usuarios SET contrasena_hash = $1, actualizado_en = NOW() WHERE id = $2',
        [contrasena_hash, usuarioId]
      );
      // Cualquier otro enlace pendiente de este usuario deja de servir
      await cliente.query(
        'UPDATE tokens_recuperacion SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL',
        [usuarioId]
      );
      return true;
    });

    if (!cambiada) {
      return res.status(400).json({ mensaje: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
    }

    return res.json({ mensaje: 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error en restablecer contraseña:', err);
    return res.status(500).json({ mensaje: 'Error en el servidor al restablecer la contraseña.' });
  }
}

module.exports = { registro, login, recuperar, restablecer };
