const { sql, getPool } = require('../config/db');
const bcrypt = require('bcrypt');

async function obtenerUsuarios(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.activo, u.creado_en,
                     u.fecha_nacimiento, u.pais, u.ciudad,
                     r.nombre AS rol
              FROM Usuarios u
              JOIN Roles r ON u.rol_id = r.id
              ORDER BY u.creado_en DESC`);

    res.json({ usuarios: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los usuarios.' });
  }
}

async function cambiarEstadoUsuario(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ mensaje: 'El campo activo debe ser true o false.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('activo', sql.Bit, activo)
      .query(`UPDATE Usuarios SET activo = @activo, actualizado_en = GETDATE()
              OUTPUT INSERTED.id, INSERTED.nombre_completo, INSERTED.activo
              WHERE id = @id`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    res.json({ mensaje: 'Estado actualizado correctamente.', usuario: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el estado del usuario.' });
  }
}

async function obtenerSalones(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT s.id, s.nombre, s.capacidad_max, s.estado, s.ciclo_actual, s.anno,
       s.fecha_inicio, s.fecha_fin, s.docente_id,
       n.nombre AS nivel, u.nombre_completo AS docente,
       ht.dias_semana, ht.hora_inicio, ht.hora_fin
              FROM Salones s
              JOIN Niveles n ON s.nivel_id = n.id
              JOIN Docentes d ON s.docente_id = d.id
              JOIN Usuarios u ON d.usuario_id = u.id
              JOIN Horarios_Tipo ht ON s.horario_tipo_id = ht.id
              ORDER BY s.anno DESC, s.nombre ASC`);

    res.json({ salones: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los salones.' });
  }
}

async function crearSalon(req, res) {
  try {
    const { docente_id, nivel_id, horario_tipo_id, nombre, capacidad_max, anno, fecha_inicio, fecha_fin } = req.body;

    if (!docente_id || !nivel_id || !horario_tipo_id || !nombre || !anno) {
      return res.status(400).json({ mensaje: 'docente_id, nivel_id, horario_tipo_id, nombre y anno son obligatorios.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('docente_id', sql.Int, docente_id)
      .input('nivel_id', sql.Int, nivel_id)
      .input('horario_tipo_id', sql.Int, horario_tipo_id)
      .input('nombre', sql.VarChar, nombre)
      .input('capacidad_max', sql.Int, capacidad_max || 20)
      .input('anno', sql.Int, anno)
      .input('fecha_inicio', sql.Date, fecha_inicio || null)
      .input('fecha_fin', sql.Date, fecha_fin || null)
      .query(`INSERT INTO Salones (docente_id, nivel_id, horario_tipo_id, nombre, capacidad_max, anno, fecha_inicio, fecha_fin)
              OUTPUT INSERTED.id
              VALUES (@docente_id, @nivel_id, @horario_tipo_id, @nombre, @capacidad_max, @anno, @fecha_inicio, @fecha_fin)`);

    res.status(201).json({ mensaje: 'Salón creado exitosamente.', id: result.recordset[0].id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear el salón.' });
  }
}

async function actualizarSalon(req, res) {
  try {
    const { id } = req.params;
    const { nombre, capacidad_max, estado, ciclo_actual, fecha_inicio, fecha_fin } = req.body;

    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('nombre', sql.VarChar, nombre)
      .input('capacidad_max', sql.Int, capacidad_max)
      .input('estado', sql.VarChar, estado)
      .input('ciclo_actual', sql.Int, ciclo_actual)
      .input('fecha_inicio', sql.Date, fecha_inicio || null)
      .input('fecha_fin', sql.Date, fecha_fin || null)
      .query(`UPDATE Salones
              SET nombre = @nombre, capacidad_max = @capacidad_max, estado = @estado,
                  ciclo_actual = @ciclo_actual, fecha_inicio = @fecha_inicio, fecha_fin = @fecha_fin
              OUTPUT INSERTED.*
              WHERE id = @id`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado.' });
    }

    res.json({ mensaje: 'Salón actualizado correctamente.', salon: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el salón.' });
  }
}

async function eliminarSalon(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM Salones OUTPUT DELETED.id WHERE id = @id`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado.' });
    }

    res.json({ mensaje: 'Salón eliminado correctamente.' });

  } catch (err) {
    console.error(err);
    if (err.number === 547) {
      return res.status(409).json({ mensaje: 'No se puede eliminar: este salón tiene matrículas, tareas u otros datos asociados.' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar el salón.' });
  }
}

async function obtenerMatriculas(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT m.id, m.fecha_matricula, m.estado, m.valor_total, m.descuento, m.saldo_pendiente, m.anno,
                     ue.nombre_completo AS estudiante, s.nombre AS salon, us.nombre_completo AS registrado_por
              FROM Matriculas m
              JOIN Estudiantes e ON m.estudiante_id = e.id
              JOIN Usuarios ue ON e.usuario_id = ue.id
              JOIN Salones s ON m.salon_id = s.id
              LEFT JOIN Secretarias sec ON m.secretaria_id = sec.id
              LEFT JOIN Usuarios us ON sec.usuario_id = us.id
              ORDER BY m.fecha_matricula DESC`);

    res.json({ matriculas: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las matrículas.' });
  }
}

async function cambiarEstadoMatricula(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'activa', 'cancelada'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ mensaje: 'Estado inválido. Usa: pendiente, activa o cancelada.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('estado', sql.VarChar, estado)
      .query(`UPDATE Matriculas SET estado = @estado
              OUTPUT INSERTED.*
              WHERE id = @id`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Matrícula no encontrada.' });
    }

    res.json({ mensaje: 'Estado de matrícula actualizado.', matricula: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar la matrícula.' });
  }
}

async function registrarPago(req, res) {
  try {
    const { matricula_id, monto, metodo_pago, referencia_transaccion } = req.body;
    const id_secretaria_usuario = req.usuario.id_usuario;

    if (!matricula_id || !monto || !metodo_pago) {
      return res.status(400).json({ mensaje: 'matricula_id, monto y metodo_pago son obligatorios.' });
    }

    const pool = await getPool();

    // Buscar el id de Secretarias a partir del usuario admin logueado
    const secretariaResult = await pool.request()
      .input('usuario_id', sql.Int, id_secretaria_usuario)
      .query('SELECT id FROM Secretarias WHERE usuario_id = @usuario_id');

    if (secretariaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de secretaria/admin para este usuario.' });
    }

    const id_secretaria = secretariaResult.recordset[0].id;

    // Verificar que la matrícula exista y traer su saldo actual
    const matriculaResult = await pool.request()
      .input('matricula_id', sql.Int, matricula_id)
      .query('SELECT id, saldo_pendiente FROM Matriculas WHERE id = @matricula_id');

    if (matriculaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Matrícula no encontrada.' });
    }

    const saldoActual = matriculaResult.recordset[0].saldo_pendiente;

    if (monto > saldoActual) {
      return res.status(400).json({ mensaje: `El monto supera el saldo pendiente ($${saldoActual}).` });
    }

    // Registrar el pago
    const pagoResult = await pool.request()
      .input('matricula_id', sql.Int, matricula_id)
      .input('secretaria_id', sql.Int, id_secretaria)
      .input('monto', sql.Decimal(10, 2), monto)
      .input('metodo_pago', sql.VarChar, metodo_pago)
      .input('referencia_transaccion', sql.VarChar, referencia_transaccion || null)
      .query(`INSERT INTO Pagos (matricula_id, secretaria_id, monto, metodo_pago, referencia_transaccion, estado)
              OUTPUT INSERTED.id
              VALUES (@matricula_id, @secretaria_id, @monto, @metodo_pago, @referencia_transaccion, 'exitoso')`);

    // Descontar el pago del saldo pendiente de la matrícula
    const nuevoSaldo = saldoActual - monto;
    await pool.request()
      .input('matricula_id', sql.Int, matricula_id)
      .input('nuevo_saldo', sql.Decimal(10, 2), nuevoSaldo)
      .query(`UPDATE Matriculas SET saldo_pendiente = @nuevo_saldo WHERE id = @matricula_id`);

    res.status(201).json({
      mensaje: 'Pago registrado exitosamente.',
      id_pago: pagoResult.recordset[0].id,
      saldo_pendiente_restante: nuevoSaldo
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar el pago.' });
  }
}
async function crearUsuario(req, res) {
  try {
    const { nombre_completo, correo, contrasena, rol, telefono, fecha_nacimiento, pais, ciudad, datosPerfil } = req.body;

    if (!nombre_completo || !correo || !contrasena || !rol) {
      return res.status(400).json({ mensaje: 'nombre_completo, correo, contrasena y rol son obligatorios.' });
    }

    const rolesValidos = ['estudiante', 'docente', 'admin'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ mensaje: 'Rol inválido. Usa: estudiante, docente o admin.' });
    }

    if (contrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const pool = await getPool();

    // Verificar que el correo no esté repetido
    const existente = await pool.request()
      .input('correo', sql.VarChar, correo)
      .query('SELECT id FROM Usuarios WHERE correo = @correo');

    if (existente.recordset.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // Buscar el id del rol en la base de datos
    const rolResult = await pool.request()
      .input('nombre_rol', sql.VarChar, rol)
      .query('SELECT id FROM Roles WHERE nombre = @nombre_rol');

    if (rolResult.recordset.length === 0) {
      return res.status(400).json({ mensaje: 'Ese rol no existe en la base de datos.' });
    }

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

      if (rol === 'estudiante') {
        const codigo_estudiante = `EST${String(nuevoUsuarioId).padStart(4, '0')}`;

        await new sql.Request(transaction)
          .input('usuario_id', sql.Int, nuevoUsuarioId)
          .input('codigo_estudiante', sql.VarChar, codigo_estudiante)
          .query(`INSERT INTO Estudiantes (usuario_id, codigo_estudiante, estado)
                  VALUES (@usuario_id, @codigo_estudiante, 'activo')`);

      } else if (rol === 'docente') {
        await new sql.Request(transaction)
          .input('usuario_id', sql.Int, nuevoUsuarioId)
          .input('especialidad', sql.VarChar, datosPerfil?.especialidad || null)
          .query(`INSERT INTO Docentes (usuario_id, especialidad, activo, fecha_ingreso)
                  VALUES (@usuario_id, @especialidad, 1, GETDATE())`);

      } else if (rol === 'admin') {
        await new sql.Request(transaction)
          .input('usuario_id', sql.Int, nuevoUsuarioId)
          .input('cargo', sql.VarChar, datosPerfil?.cargo || null)
          .input('sede', sql.VarChar, datosPerfil?.sede || null)
          .query(`INSERT INTO Secretarias (usuario_id, cargo, sede, activo)
                  VALUES (@usuario_id, @cargo, @sede, 1)`);
      }

      await transaction.commit();

    } catch (errTransaccion) {
      try { await transaction.rollback(); } catch (_) { /* SQL Server ya la había revertido */ }
      throw errTransaccion;
    }

    res.status(201).json({ mensaje: 'Usuario creado exitosamente.', id: nuevoUsuarioId, rol });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear el usuario.' });
  }
}
async function obtenerDocentes(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT d.id, d.usuario_id, d.especialidad, d.activo, d.fecha_ingreso,
                     u.nombre_completo, u.correo, u.telefono
              FROM Docentes d
              JOIN Usuarios u ON d.usuario_id = u.id
              ORDER BY u.nombre_completo ASC`);

    res.json({ docentes: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los docentes.' });
  }
}
async function obtenerHorariosTipo(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT id, dias_semana, hora_inicio, hora_fin
              FROM Horarios_Tipo
              ORDER BY id ASC`);

    res.json({ horarios: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los horarios.' });
  }
}
async function obtenerNiveles(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT id, nombre
              FROM Niveles
              ORDER BY id ASC`);

    res.json({ niveles: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los niveles.' });
  }
}
async function editarUsuario(req, res) {
  try {
    const { id } = req.params;
    const { nombre_completo, correo, telefono, fecha_nacimiento, pais, ciudad, contrasena, datosPerfil } = req.body;

    if (!nombre_completo || !correo) {
      return res.status(400).json({ mensaje: 'nombre_completo y correo son obligatorios.' });
    }

    if (contrasena && contrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const pool = await getPool();

    // Verificar que el usuario exista y traer su rol (el rol no se puede cambiar)
    const usuarioResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT u.id, r.nombre AS rol
              FROM Usuarios u
              JOIN Roles r ON u.rol_id = r.id
              WHERE u.id = @id`);

    if (usuarioResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    const rol = usuarioResult.recordset[0].rol;

    // Verificar que el correo no lo tenga otro usuario
    const repetido = await pool.request()
      .input('correo', sql.VarChar, correo)
      .input('id', sql.Int, id)
      .query('SELECT id FROM Usuarios WHERE correo = @correo AND id <> @id');

    if (repetido.recordset.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // Si no llega contraseña, se deja la actual
    const contrasena_hash = contrasena ? await bcrypt.hash(contrasena, 10) : null;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let usuarioActualizado;

    try {
      const resultadoUsuario = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('nombre_completo', sql.VarChar, nombre_completo)
        .input('correo', sql.VarChar, correo)
        .input('telefono', sql.VarChar, telefono || null)
        .input('fecha_nacimiento', sql.Date, fecha_nacimiento || null)
        .input('pais', sql.VarChar, pais || null)
        .input('ciudad', sql.VarChar, ciudad || null)
        .input('contrasena_hash', sql.VarChar, contrasena_hash)
        .query(`UPDATE Usuarios
                SET nombre_completo = @nombre_completo, correo = @correo,
    telefono = COALESCE(@telefono, telefono),
    fecha_nacimiento = COALESCE(@fecha_nacimiento, fecha_nacimiento),
    pais = COALESCE(@pais, pais),
    ciudad = COALESCE(@ciudad, ciudad),
    contrasena_hash = COALESCE(@contrasena_hash, contrasena_hash),
    actualizado_en = GETDATE()
                OUTPUT INSERTED.id, INSERTED.nombre_completo, INSERTED.correo
                WHERE id = @id`);

      usuarioActualizado = resultadoUsuario.recordset[0];

      if (rol === 'docente' && datosPerfil && typeof datosPerfil.especialidad === 'string') {
        await new sql.Request(transaction)
          .input('usuario_id', sql.Int, id)
          .input('especialidad', sql.VarChar, datosPerfil.especialidad || null)
          .query('UPDATE Docentes SET especialidad = @especialidad WHERE usuario_id = @usuario_id');
      }

      await transaction.commit();

    } catch (errTransaccion) {
      try { await transaction.rollback(); } catch (_) { /* SQL Server ya la había revertido */ }
      throw errTransaccion;
    }

    res.json({ mensaje: 'Usuario actualizado correctamente.', usuario: usuarioActualizado });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el usuario.' });
  }
}
async function obtenerEstudiantes(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT e.id, e.usuario_id, e.codigo_estudiante, e.estado,
                     u.nombre_completo, u.correo, u.telefono, u.activo
              FROM Estudiantes e
              JOIN Usuarios u ON e.usuario_id = u.id
              ORDER BY u.nombre_completo ASC`);

    res.json({ estudiantes: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los estudiantes.' });
  }
}
async function crearMatricula(req, res) {
  try {
    const { estudiante_id, salon_id } = req.body;
    const id_admin_usuario = req.usuario.id_usuario;

    if (!estudiante_id || !salon_id) {
      return res.status(400).json({ mensaje: 'estudiante_id y salon_id son obligatorios.' });
    }

    const pool = await getPool();

    // El estudiante debe existir y estar activo (estudiante_id es Estudiantes.id)
    const estudianteResult = await pool.request()
      .input('estudiante_id', sql.Int, estudiante_id)
      .query(`SELECT e.id, e.estado, u.activo
              FROM Estudiantes e
              JOIN Usuarios u ON e.usuario_id = u.id
              WHERE e.id = @estudiante_id`);

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }

    if (!estudianteResult.recordset[0].activo) {
      return res.status(409).json({ mensaje: 'El estudiante está inactivo. Actívalo antes de matricularlo.' });
    }

    // El salón debe existir, estar activo, y traemos el precio de su nivel
    const salonResult = await pool.request()
      .input('salon_id', sql.Int, salon_id)
      .query(`SELECT s.id, s.anno, s.capacidad_max, n.precio,
                     (SELECT COUNT(*) FROM Matriculas m
                      WHERE m.salon_id = s.id
                      AND m.estado IN ('pendiente', 'activa')) AS ocupados
              FROM Salones s
              JOIN Niveles n ON s.nivel_id = n.id
              WHERE s.id = @salon_id AND s.estado = 'activo'`);

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no disponible.' });
    }

    const salon = salonResult.recordset[0];

    if (salon.ocupados >= salon.capacidad_max) {
      return res.status(409).json({ mensaje: 'Este salón ya no tiene cupos disponibles.' });
    }

    // No permitir matrículas duplicadas en el mismo salón
    const existente = await pool.request()
      .input('estudiante_id', sql.Int, estudiante_id)
      .input('salon_id', sql.Int, salon_id)
      .query(`SELECT id FROM Matriculas
              WHERE estudiante_id = @estudiante_id AND salon_id = @salon_id
              AND estado IN ('pendiente', 'activa')`);

    if (existente.recordset.length > 0) {
      return res.status(409).json({ mensaje: 'Este estudiante ya tiene una matrícula pendiente o activa en este salón.' });
    }

    // Quién registra: el perfil de Secretarias del admin logueado (si no tiene, queda sin registrar)
    const secretariaResult = await pool.request()
      .input('usuario_id', sql.Int, id_admin_usuario)
      .query('SELECT id FROM Secretarias WHERE usuario_id = @usuario_id');

    const id_secretaria = secretariaResult.recordset.length > 0 ? secretariaResult.recordset[0].id : null;

    const result = await pool.request()
      .input('estudiante_id', sql.Int, estudiante_id)
      .input('salon_id', sql.Int, salon_id)
      .input('secretaria_id', sql.Int, id_secretaria)
      .input('valor_total', sql.Decimal(10, 2), salon.precio)
      .input('anno', sql.Int, salon.anno)
      .query(`INSERT INTO Matriculas (estudiante_id, salon_id, secretaria_id, estado, valor_total, descuento, saldo_pendiente, anno)
              OUTPUT INSERTED.id, INSERTED.estado, INSERTED.valor_total, INSERTED.saldo_pendiente
              VALUES (@estudiante_id, @salon_id, @secretaria_id, 'pendiente', @valor_total, 0, @valor_total, @anno)`);

    res.status(201).json({ mensaje: 'Matrícula creada. Queda pendiente hasta registrar el pago.', matricula: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear la matrícula.' });
  }
}
module.exports = { obtenerUsuarios, cambiarEstadoUsuario, crearUsuario, editarUsuario, obtenerEstudiantes, obtenerDocentes, obtenerHorariosTipo, obtenerNiveles, obtenerSalones, crearSalon, actualizarSalon, eliminarSalon, obtenerMatriculas, crearMatricula, cambiarEstadoMatricula, registrarPago };