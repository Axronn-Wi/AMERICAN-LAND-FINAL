const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../config/db');
require('dotenv').config();

async function registro(req, res) {
  try {
            const { nombre_completo, correo, contrasena, telefono, fecha_nacimiento, pais, ciudad } = req.body;

    // El registro público SIEMPRE crea estudiantes. El rol no lo decide el cliente.
    const rol = 'estudiante';

    if (!nombre_completo || !correo || !contrasena) {
      return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios.' });
    }

    const pool = await getPool();

    // Verificar si el correo ya existe
    const existente = await pool.request()
      .input('correo', sql.VarChar, correo)
      .query('SELECT id FROM Usuarios WHERE correo = @correo');

    if (existente.recordset.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // Buscar el id del rol
    const rolResult = await pool.request()
      .input('nombre_rol', sql.VarChar, rol)
      .query('SELECT id FROM Roles WHERE nombre = @nombre_rol');

    const id_rol = rolResult.recordset[0].id;

    const contrasena_hash = await bcrypt.hash(contrasena, 10);

            const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let nuevoUsuarioId;

    try {
      const resultadoUsuario = await new sql.Request(transaction)
        .input('rol_id', sql.Int, id_rol)
        .input('nombre_completo', sql.VarChar, nombre_completo)
        .input('correo', sql.VarChar, correo)
        .input('contrasena_hash', sql.VarChar, contrasena_hash)
        .input('telefono', sql.VarChar, telefono || null)
        .input('fecha_nacimiento', sql.Date, fecha_nacimiento || null)
        .input('pais', sql.VarChar, pais || null)
        .input('ciudad', sql.VarChar, ciudad || null)
        .query(`INSERT INTO Usuarios (rol_id, nombre_completo, correo, contrasena_hash, telefono, fecha_nacimiento, pais, ciudad)
                OUTPUT INSERTED.id
                VALUES (@rol_id, @nombre_completo, @correo, @contrasena_hash, @telefono, @fecha_nacimiento, @pais, @ciudad)`);

      nuevoUsuarioId = resultadoUsuario.recordset[0].id;

      const codigo_estudiante = `EST${String(nuevoUsuarioId).padStart(4, '0')}`;

      await new sql.Request(transaction)
        .input('usuario_id', sql.Int, nuevoUsuarioId)
        .input('codigo_estudiante', sql.VarChar, codigo_estudiante)
        .query(`INSERT INTO Estudiantes (usuario_id, codigo_estudiante, estado)
                VALUES (@usuario_id, @codigo_estudiante, 'activo')`);

      await transaction.commit();

    } catch (errTransaccion) {
      try { await transaction.rollback(); } catch (_) { /* SQL Server ya la había revertido */ }
      throw errTransaccion;
    }

    res.status(201).json({ mensaje: 'Usuario registrado exitosamente.', id: nuevoUsuarioId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error en el servidor al registrar usuario.' });
  }
}

async function login(req, res) {
  try {
    const { correo, contrasena, rol } = req.body;

    if (!correo || !contrasena || !rol) {
      return res.status(400).json({ mensaje: 'Correo, contraseña y rol son obligatorios.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('correo', sql.VarChar, correo)
      .query(`SELECT u.id, u.nombre_completo, u.correo, u.contrasena_hash, u.activo,
                     r.nombre AS nombre_rol
              FROM Usuarios u
              JOIN Roles r ON u.rol_id = r.id
              WHERE u.correo = @correo`);

    if (result.recordset.length === 0) {
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }

    const usuario = result.recordset[0];

    if (usuario.nombre_rol !== rol) {
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
    console.error(err);
    res.status(500).json({ mensaje: 'Error en el servidor al iniciar sesión.' });
  }
}

module.exports = { registro, login };