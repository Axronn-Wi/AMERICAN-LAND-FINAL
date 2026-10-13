const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Resolver si db exporta { pool }, pool o el cliente directo
const pool = db.pool || db;

require('dotenv').config();

async function registro(req, res) {
  try {
    const { nombre_completo, correo, contrasena, telefono, fecha_nacimiento, pais, ciudad } = req.body;

    const rol = 'estudiante';

    if (!nombre_completo || !correo || !contrasena) {
      return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios.' });
    }

    // 1. Verificar si el correo existe (probando minúsculas y mayúsculas)
    let existente;
    try {
      existente = await pool.query('SELECT id FROM usuarios WHERE LOWER(correo) = LOWER(\$1)', [correo]);
    } catch (_) {
      existente = await pool.query('SELECT id FROM "Usuarios" WHERE LOWER(correo) = LOWER(\$1)', [correo]);
    }

    if (existente.rows && existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // 2. Buscar el ID del rol "estudiante"
    let rolResult;
    try {
      rolResult = await pool.query('SELECT id FROM roles WHERE LOWER(nombre) = LOWER(\$1)', [rol]);
    } catch (_) {
      rolResult = await pool.query('SELECT id FROM "Roles" WHERE LOWER(nombre) = LOWER(\$1)', [rol]);
    }

    let id_rol = 1; // ID por defecto para estudiante si no existe tabla roles
    if (rolResult && rolResult.rows && rolResult.rows.length > 0) {
      id_rol = rolResult.rows[0].id;
    }

    // 3. Encriptar contraseña
    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // 4. Insertar Usuario
    let resUsuario;
    const paramsUsuario = [
      id_rol,
      nombre_completo,
      correo,
      contrasena_hash,
      telefono || null,
      fecha_nacimiento || null,
      pais || null,
      ciudad || null
    ];

    try {
      resUsuario = await pool.query(`
        INSERT INTO usuarios (rol_id, nombre_completo, correo, contrasena_hash, telefono, fecha_nacimiento, pais, ciudad)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, paramsUsuario);
    } catch (_) {
      resUsuario = await pool.query(`
        INSERT INTO "Usuarios" (rol_id, nombre_completo, correo, contrasena_hash, telefono, fecha_nacimiento, pais, ciudad)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, paramsUsuario);
    }

    const nuevoUsuarioId = resUsuario.rows[0].id;
    const codigo_estudiante = `EST${String(nuevoUsuarioId).padStart(4, '0')}`;

    // 5. Insertar Estudiante
    try {
      await pool.query(`
        INSERT INTO estudiantes (usuario_id, codigo_estudiante, estado)
        VALUES ($1, $2, 'activo')
      `, [nuevoUsuarioId, codigo_estudiante]);
    } catch (_) {
      await pool.query(`
        INSERT INTO "Estudiantes" (usuario_id, codigo_estudiante, estado)
        VALUES ($1, $2, 'activo')
      `, [nuevoUsuarioId, codigo_estudiante]);
    }

    return res.status(201).json({ mensaje: 'Usuario registrado exitosamente.', id: nuevoUsuarioId });

  } catch (err) {
    console.error('Error detallado en registro:', err);
    return res.status(500).json({ mensaje: 'Error en el servidor al registrar usuario.' });
  }
}

async function login(req, res) {
  try {
    const { correo, contrasena, rol } = req.body;

    if (!correo || !contrasena || !rol) {
      return res.status(400).json({ mensaje: 'Correo, contraseña y rol son obligatorios.' });
    }

    let result;
    try {
      result = await pool.query(`
        SELECT u.id, u.nombre_completo, u.correo, u.contrasena_hash, u.activo, r.nombre AS nombre_rol
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE LOWER(u.correo) = LOWER($1)
      `, [correo]);
    } catch (_) {
      result = await pool.query(`
        SELECT u.id, u.nombre_completo, u.correo, u.contrasena_hash, u.activo, r.nombre AS nombre_rol
        FROM "Usuarios" u
        JOIN "Roles" r ON u.rol_id = r.id
        WHERE LOWER(u.correo) = LOWER($1)
      `, [correo]);
    }

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }

    const usuario = result.rows[0];

    if (usuario.nombre_rol.toLowerCase() !== rol.toLowerCase()) {
      return res.status(401).json({ mensaje: 'El rol seleccionado no coincide con el usuario.' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ mensaje: 'Este usuario se encuentra inactivo.' });
    }

    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!contrasenaValida) {
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
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

module.exports = { registro, login };