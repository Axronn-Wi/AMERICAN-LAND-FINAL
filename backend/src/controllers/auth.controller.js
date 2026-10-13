const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Detectar si pool viene directo o dentro de una propiedad { pool }
const pool = db.pool || db;

require('dotenv').config();

async function registro(req, res) {
  try {
    const { nombre_completo, correo, contrasena, telefono, fecha_nacimiento, pais, ciudad } = req.body;

    // El registro público SIEMPRE crea estudiantes.
    const rol = 'estudiante';

    if (!nombre_completo || !correo || !contrasena) {
      return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios.' });
    }

    // 1. Verificar si el correo ya existe
    const existente = await pool.query(
      'SELECT id FROM "Usuarios" WHERE LOWER(correo) = LOWER(\$1)', 
      [correo]
    );
    if (existente.rows && existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // 2. Buscar el id del rol "estudiante"
    let rolResult = await pool.query(
      'SELECT id FROM "Roles" WHERE LOWER(nombre) = LOWER(\$1)', 
      [rol]
    );

    // Intento alternativo en minúsculas por si la tabla no usa comillas dobles
    if (!rolResult.rows || rolResult.rows.length === 0) {
      rolResult = await pool.query(
        'SELECT id FROM roles WHERE LOWER(nombre) = LOWER(\$1)', 
        [rol]
      );
    }

    if (!rolResult.rows || rolResult.rows.length === 0) {
      return res.status(500).json({ mensaje: 'El rol "estudiante" no existe en la base de datos.' });
    }
    const id_rol = rolResult.rows[0].id;

    // 3. Encriptar contraseña
    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // 4. Insertar en la tabla Usuarios
    const insertUsuarioQuery = `
      INSERT INTO "Usuarios" (rol_id, nombre_completo, correo, contrasena_hash, telefono, fecha_nacimiento, pais, ciudad)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const resUsuario = await pool.query(insertUsuarioQuery, [
      id_rol,
      nombre_completo,
      correo,
      contrasena_hash,
      telefono || null,
      fecha_nacimiento || null,
      pais || null,
      ciudad || null
    ]);

    const nuevoUsuarioId = resUsuario.rows[0].id;
    const codigo_estudiante = `EST${String(nuevoUsuarioId).padStart(4, '0')}`;

    // 5. Insertar en la tabla Estudiantes
    const insertEstudianteQuery = `
      INSERT INTO "Estudiantes" (usuario_id, codigo_estudiante, estado)
      VALUES ($1, $2, 'activo')
    `;
    await pool.query(insertEstudianteQuery, [nuevoUsuarioId, codigo_estudiante]);

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente.', id: nuevoUsuarioId });

  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ mensaje: 'Error en el servidor al registrar usuario.' });
  }
}

async function login(req, res) {
  try {
    const { correo, contrasena, rol } = req.body;

    if (!correo || !contrasena || !rol) {
      return res.status(400).json({ mensaje: 'Correo, contraseña y rol son obligatorios.' });
    }

    const query = `
      SELECT u.id, u.nombre_completo, u.correo, u.contrasena_hash, u.activo,
             r.nombre AS nombre_rol
      FROM "Usuarios" u
      JOIN "Roles" r ON u.rol_id = r.id
      WHERE LOWER(u.correo) = LOWER($1)
    `;
    const result = await pool.query(query, [correo]);

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