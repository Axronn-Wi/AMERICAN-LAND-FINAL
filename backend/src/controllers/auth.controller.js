const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const pool = db.pool || db;
const { transaccion, normalizarCorreo, REGEX_CORREO } = require('../utils/sql');
const { enviarCorreo } = require('../utils/correo');
const { firmarToken } = require('../utils/sesion');
const { olvidarUsuario } = require('../middleware/auth.middleware');
const {
  LARGO, textoOpcional, textoObligatorio, telefonoOpcional, fechaNacimientoOpcional, errorContrasena
} = require('../utils/textos');

const MENSAJE_CREDENCIALES = 'Correo, contraseña o rol incorrectos.';

async function registro(req, res) {
  try {
    const body = req.body || {};
    const correo = normalizarCorreo(body.correo);

    if (!body.nombre_completo || !correo || !body.contrasena) {
      return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios.' });
    }
    // Cada campo con el largo de su columna en la base de datos
    const nombre = textoObligatorio(body.nombre_completo, LARGO.nombre, 'El nombre');
    const telefono = telefonoOpcional(body.telefono);
    const pais = textoOpcional(body.pais, LARGO.pais, 'El país');
    const ciudad = textoOpcional(body.ciudad, LARGO.ciudad, 'La ciudad');
    const fecha = fechaNacimientoOpcional(body.fecha_nacimiento);
    const errorCampo = [nombre, telefono, pais, ciudad, fecha].find((c) => c.error);
    if (errorCampo) {
      return res.status(400).json({ mensaje: errorCampo.error });
    }
    if (!REGEX_CORREO.test(correo) || correo.length > LARGO.correo) {
      return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
    }
    const errorClave = errorContrasena(body.contrasena);
    if (errorClave) {
      return res.status(400).json({ mensaje: errorClave });
    }
    const contrasena = body.contrasena;

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
        [id_rol, nombre.valor, correo, contrasena_hash, telefono.valor, fecha.valor, pais.valor, ciudad.valor]
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
      `SELECT u.id, u.nombre_completo, u.correo, u.contrasena_hash, u.activo, u.sesion_version,
              r.nombre AS nombre_rol
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

    const token = firmarToken({
      id: usuario.id,
      rol: usuario.nombre_rol,
      correo: usuario.correo,
      sesion_version: usuario.sesion_version
    });

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

// ---------------------------------------------------------------
// Recuperación de contraseña con código de 6 dígitos
// 1. POST /auth/recuperar   { correo }                       -> envía el código al correo
// 2. POST /auth/restablecer { correo, codigo, contrasena }   -> cambia la contraseña
// ---------------------------------------------------------------
const MENSAJE_RECUPERAR = 'Si el correo está registrado, te enviamos un código de 6 dígitos para restablecer tu contraseña.';
const MENSAJE_CODIGO_INVALIDO = 'El código no es válido o ya venció. Revisa el correo o solicita uno nuevo.';
const VIGENCIA_CODIGO_MIN = 15;
const MAX_INTENTOS_CODIGO = 5;
const ESPERA_REENVIO_SEG = 30; // la página deja reenviar cada 30 s

// En la base no queda el código sino su HMAC (con una sal por solicitud):
// quien lea la tabla no puede usarlo ni probar los 6 dígitos sin el secreto del servidor
function hashCodigo(sal, codigo) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`recuperacion:${sal}:${codigo}`).digest('hex');
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function enviarCodigoRecuperacion(usuario) {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const sal = crypto.randomBytes(16).toString('hex');

  // Un código nuevo anula los anteriores. Si el último se pidió hace muy poco
  // no se manda otro (evita llenar de correos a alguien)
  const creado = await transaccion(async (cliente) => {
    await cliente.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuario.id]);
    const reciente = await cliente.query(
      `SELECT 1 FROM tokens_recuperacion
       WHERE usuario_id = $1 AND creado_en > NOW() - make_interval(secs => $2)`,
      [usuario.id, ESPERA_REENVIO_SEG - 2]
    );
    if (reciente.rows.length > 0) return false;

    await cliente.query(
      'UPDATE tokens_recuperacion SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL',
      [usuario.id]
    );
    await cliente.query(
      `INSERT INTO tokens_recuperacion (usuario_id, token_hash, sal, expira_en)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
      [usuario.id, hashCodigo(sal, codigo), sal, VIGENCIA_CODIGO_MIN]
    );
    return true;
  });
  if (!creado) return;

  // El enlace abre la página con el correo y el código ya escritos. Van después
  // del "#": así no quedan en los registros de ningún servidor
  const base = (process.env.FRONTEND_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const enlace = `${base}/auth/recover_pass.html#correo=${encodeURIComponent(usuario.correo)}&codigo=${codigo}`;

  await enviarCorreo({
    para: usuario.correo,
    asunto: `${codigo} es tu código para restablecer la contraseña - Instituto American Land`,
    texto: `Hola ${usuario.nombre_completo}:\n\n` +
      `Tu código para restablecer la contraseña es: ${codigo}\n\n` +
      `Escríbelo en la página donde lo pediste, o abre este enlace:\n${enlace}\n\n` +
      `El código vence en ${VIGENCIA_CODIGO_MIN} minutos y solo se puede usar una vez. ` +
      'Si no fuiste tú, ignora este correo: tu contraseña no cambia.',
    html: `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:480px">
      <p>Hola ${escaparHtml(usuario.nombre_completo)}:</p>
      <p>Tu código para restablecer la contraseña es:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f0ff;color:#5b21b6;padding:14px 0;text-align:center;border-radius:10px">${codigo}</p>
      <p>Escríbelo en la página donde lo pediste, o usa este botón:</p>
      <p><a href="${enlace}" style="display:inline-block;padding:12px 22px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Crear mi nueva contraseña</a></p>
      <p style="color:#6b7280;font-size:13px">El código vence en <strong>${VIGENCIA_CODIGO_MIN} minutos</strong> y solo se puede usar una vez.
      Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>
    </div>`
  });
}

async function recuperar(req, res) {
  const correo = normalizarCorreo(req.body && req.body.correo);
  if (!REGEX_CORREO.test(correo) || correo.length > LARGO.correo) {
    return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
  }

  // Se responde igual exista o no la cuenta, y sin esperar el envío,
  // así nadie puede averiguar qué correos están registrados
  res.json({ mensaje: MENSAJE_RECUPERAR, vigencia_minutos: VIGENCIA_CODIGO_MIN });

  try {
    const result = await pool.query(
      'SELECT id, nombre_completo, correo FROM usuarios WHERE LOWER(correo) = $1 AND activo = TRUE',
      [correo]
    );
    if (result.rows.length > 0) {
      await enviarCodigoRecuperacion(result.rows[0]);
    }
  } catch (err) {
    console.error('Error en recuperar contraseña:', err);
  }
}

async function restablecer(req, res) {
  try {
    const body = req.body || {};
    const correo = normalizarCorreo(body.correo);
    const codigo = String(body.codigo || '').replace(/\s+/g, '');

    if (!REGEX_CORREO.test(correo) || !/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ mensaje: 'Escribe tu correo y el código de 6 dígitos que te enviamos.' });
    }
    const errorClave = errorContrasena(body.contrasena);
    if (errorClave) {
      return res.status(400).json({ mensaje: errorClave });
    }

    const contrasena_hash = await bcrypt.hash(body.contrasena, 10);

    const resultado = await transaccion(async (cliente) => {
      // Último código vigente de esa cuenta (bloqueado: dos intentos a la vez no se cruzan)
      const r = await cliente.query(
        `SELECT t.id, t.usuario_id, t.token_hash, t.sal, t.intentos
         FROM tokens_recuperacion t
         JOIN usuarios u ON u.id = t.usuario_id
         WHERE LOWER(u.correo) = $1 AND u.activo = TRUE
           AND t.usado_en IS NULL AND t.expira_en > NOW() AND t.sal IS NOT NULL
         ORDER BY t.id DESC LIMIT 1
         FOR UPDATE OF t`,
        [correo]
      );
      if (r.rows.length === 0) return { ok: false, mensaje: MENSAJE_CODIGO_INVALIDO };
      const token = r.rows[0];

      const esperado = Buffer.from(token.token_hash);
      const recibido = Buffer.from(hashCodigo(token.sal, codigo));
      if (esperado.length !== recibido.length || !crypto.timingSafeEqual(esperado, recibido)) {
        // Código equivocado: se cuenta el intento (y se guarda, por eso no se lanza error)
        const intentos = token.intentos + 1;
        await cliente.query(
          `UPDATE tokens_recuperacion
           SET intentos = $1::int, usado_en = CASE WHEN $1::int >= $2::int THEN NOW() ELSE usado_en END
           WHERE id = $3`,
          [intentos, MAX_INTENTOS_CODIGO, token.id]
        );
        const quedan = MAX_INTENTOS_CODIGO - intentos;
        return {
          ok: false,
          mensaje: quedan > 0
            ? `El código no es correcto. Te quedan ${quedan} ${quedan === 1 ? 'intento' : 'intentos'}.`
            : 'Escribiste mal el código demasiadas veces. Solicita uno nuevo.'
        };
      }

      // Código correcto: nueva contraseña y se cierran las sesiones abiertas
      await cliente.query(
        `UPDATE usuarios SET contrasena_hash = $1, sesion_version = sesion_version + 1, actualizado_en = NOW()
         WHERE id = $2`,
        [contrasena_hash, token.usuario_id]
      );
      // Este código y cualquier otro pendiente de la cuenta dejan de servir
      await cliente.query(
        'UPDATE tokens_recuperacion SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL',
        [token.usuario_id]
      );
      return { ok: true, usuarioId: token.usuario_id };
    });

    if (!resultado.ok) {
      return res.status(400).json({ mensaje: resultado.mensaje });
    }
    olvidarUsuario(resultado.usuarioId);

    return res.json({ mensaje: 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error en restablecer contraseña:', err);
    return res.status(500).json({ mensaje: 'Error en el servidor al restablecer la contraseña.' });
  }
}

module.exports = { registro, login, recuperar, restablecer };
