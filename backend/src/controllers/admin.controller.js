const db = require('../config/db');
const pool = db.pool || db;
const { sqlHora, sqlFecha, transaccion, normalizarCorreo, REGEX_CORREO } = require('../utils/sql');
const bcrypt = require('bcrypt');
const { notificar } = require('../utils/notificar');
const { olvidarUsuario } = require('../middleware/auth.middleware');

// Devuelve el id del perfil en la tabla admin del usuario logueado.
// Si el usuario tiene rol admin pero aun no tiene perfil, se crea en el momento.
async function obtenerIdPerfilAdmin(usuarioId) {
  const existente = await pool.query('SELECT id FROM admin WHERE usuario_id = $1', [usuarioId]);
  if (existente.rows.length > 0) {
    return existente.rows[0].id;
  }
  const nuevo = await pool.query(
    `INSERT INTO admin (usuario_id, cargo, sede, activo)
     VALUES ($1, NULL, NULL, TRUE)
     RETURNING id`,
    [usuarioId]
  );
  return nuevo.rows[0].id;
}

// Perfil con el que se firma una matrícula o un pago: el admin usa su perfil de la
// tabla admin (secretaria_id); la secretaria no tiene, así que solo queda registrado_por
async function datosDeRegistro(usuario) {
  const secretariaId = usuario.rol === 'admin' ? await obtenerIdPerfilAdmin(usuario.id_usuario) : null;
  return { secretariaId, registradoPor: usuario.id_usuario };
}

// Rol (texto) de un usuario, o null si no existe
async function rolDeUsuario(idUsuario) {
  const r = await pool.query(
    'SELECT r.nombre AS rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1',
    [idUsuario]
  );
  return r.rows.length > 0 ? r.rows[0].rol : null;
}

async function totalAdminsActivos() {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS total FROM usuarios u JOIN roles r ON u.rol_id = r.id
     WHERE r.nombre = 'admin' AND u.activo = TRUE`
  );
  return r.rows[0].total;
}

// La secretaría solo administra estudiantes; el resto de cuentas son del admin
const MENSAJE_SOLO_ESTUDIANTES = 'La secretaría solo puede gestionar cuentas de estudiantes.';

async function obtenerUsuarios(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.activo, u.creado_en,
              ${sqlFecha('u.fecha_nacimiento')} AS fecha_nacimiento, u.pais, u.ciudad,
              r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       ORDER BY u.creado_en DESC`
    );

    res.json({ usuarios: result.rows });

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

    if (Number(id) === req.usuario.id_usuario && activo === false) {
      return res.status(400).json({ mensaje: 'No puedes desactivar tu propia cuenta.' });
    }

    const rolObjetivo = await rolDeUsuario(id);
    if (rolObjetivo === null) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }
    if (req.usuario.rol === 'secretaria' && rolObjetivo !== 'estudiante') {
      return res.status(403).json({ mensaje: MENSAJE_SOLO_ESTUDIANTES });
    }
    if (rolObjetivo === 'admin' && activo === false && (await totalAdminsActivos()) <= 1) {
      return res.status(409).json({ mensaje: 'Debe quedar al menos un administrador activo.' });
    }

    const result = await pool.query(
      `UPDATE usuarios SET activo = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, nombre_completo, activo`,
      [activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    olvidarUsuario(id);
    res.json({ mensaje: 'Estado actualizado correctamente.', usuario: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el estado del usuario.' });
  }
}

async function obtenerSalones(req, res) {
  try {
    const result = await pool.query(
      `SELECT s.id, s.nombre, s.capacidad_max, s.estado, s.ciclo_actual, s.anno,
              ${sqlFecha('s.fecha_inicio')} AS fecha_inicio,
              ${sqlFecha('s.fecha_fin')} AS fecha_fin,
              s.docente_id,
              n.nombre AS nivel, u.nombre_completo AS docente,
              ht.dias_semana,
              ${sqlHora('ht.hora_inicio')} AS hora_inicio,
              ${sqlHora('ht.hora_fin')} AS hora_fin
       FROM salones s
       JOIN niveles n ON s.nivel_id = n.id
       JOIN docentes d ON s.docente_id = d.id
       JOIN usuarios u ON d.usuario_id = u.id
       JOIN horarios_tipo ht ON s.horario_tipo_id = ht.id
       ORDER BY s.anno DESC, s.nombre ASC`
    );

    res.json({ salones: result.rows });

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

    const capacidad = capacidad_max === undefined || capacidad_max === null || capacidad_max === '' ? 20 : Number(capacidad_max);
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100) {
      return res.status(400).json({ mensaje: 'La capacidad debe ser un número entero entre 1 y 100.' });
    }
    if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
      return res.status(400).json({ mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
    }

    // Salón + sus ciclos se crean juntos: sin ciclos el docente no puede crear tareas ni notas
    const resultado = await transaccion(async (cliente) => {
      const nivel = await cliente.query('SELECT ciclos_totales FROM niveles WHERE id = $1', [nivel_id]);
      if (nivel.rows.length === 0) {
        return { status: 404, cuerpo: { mensaje: 'El nivel seleccionado no existe.' } };
      }
      const docente = await cliente.query('SELECT usuario_id FROM docentes WHERE id = $1 AND activo = TRUE', [docente_id]);
      if (docente.rows.length === 0) {
        return { status: 404, cuerpo: { mensaje: 'El docente no existe o está inactivo.' } };
      }

      const salon = await cliente.query(
        `INSERT INTO salones (docente_id, nivel_id, horario_tipo_id, nombre, capacidad_max, anno, fecha_inicio, fecha_fin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [docente_id, nivel_id, horario_tipo_id, String(nombre).trim(), capacidad, anno, fecha_inicio || null, fecha_fin || null]
      );
      const idSalon = salon.rows[0].id;
      const totalCiclos = Math.max(1, nivel.rows[0].ciclos_totales || 1);

      // Un ciclo por cada ciclos_totales del nivel; solo el primero queda "en curso"
      await cliente.query(
        `INSERT INTO ciclos (salon_id, numero_ciclo, estado)
         SELECT $1, g, CASE WHEN g = 1 THEN 'en curso' ELSE 'pendiente' END
         FROM generate_series(1, $2::int) AS g`,
        [idSalon, totalCiclos]
      );

      return {
        status: 201,
        cuerpo: { mensaje: `Salón creado con ${totalCiclos} ciclos.`, id: idSalon, ciclos: totalCiclos },
        usuarioDocente: docente.rows[0].usuario_id
      };
    });

    if (resultado.usuarioDocente) {
      notificar([resultado.usuarioDocente], {
        tipo: 'salon',
        titulo: 'Nuevo salón asignado',
        mensaje: `Se te asignó el salón "${String(nombre).trim()}".`,
        enlace: '/docentes/inicio.html'
      });
    }

    res.status(resultado.status).json(resultado.cuerpo);

  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ mensaje: 'El docente, nivel u horario seleccionado no existe.' });
    }
    res.status(500).json({ mensaje: 'Error al crear el salón.' });
  }
}

async function actualizarSalon(req, res) {
  try {
    const { id } = req.params;
    const { nombre, estado, fecha_inicio, fecha_fin } = req.body;
    const capacidad = Number(req.body.capacidad_max);
    const ciclo = Number(req.body.ciclo_actual);

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ mensaje: 'El nombre del salón es obligatorio.' });
    }
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 100) {
      return res.status(400).json({ mensaje: 'La capacidad debe ser un número entero entre 1 y 100.' });
    }
    if (!estado) {
      return res.status(400).json({ mensaje: 'El estado del salón es obligatorio.' });
    }
    if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) {
      return res.status(400).json({ mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
    }

    const resultado = await transaccion(async (cliente) => {
      const actual = await cliente.query(
        `SELECT s.id, n.ciclos_totales,
                (SELECT COUNT(*)::int FROM matriculas m
                 WHERE m.salon_id = s.id AND m.estado IN ('pendiente', 'activa')) AS ocupados
         FROM salones s JOIN niveles n ON s.nivel_id = n.id
         WHERE s.id = $1 FOR UPDATE OF s`,
        [id]
      );
      if (actual.rows.length === 0) {
        return { status: 404, cuerpo: { mensaje: 'Salón no encontrado.' } };
      }
      const { ciclos_totales, ocupados } = actual.rows[0];

      if (!Number.isInteger(ciclo) || ciclo < 1 || ciclo > ciclos_totales) {
        return { status: 400, cuerpo: { mensaje: `El ciclo actual debe estar entre 1 y ${ciclos_totales}.` } };
      }
      if (capacidad < ocupados) {
        return { status: 409, cuerpo: { mensaje: `La capacidad no puede ser menor que los ${ocupados} cupos ya ocupados.` } };
      }

      const result = await cliente.query(
        `UPDATE salones
         SET nombre = $1, capacidad_max = $2, estado = $3,
             ciclo_actual = $4, fecha_inicio = $5, fecha_fin = $6
         WHERE id = $7
         RETURNING id, docente_id, nivel_id, horario_tipo_id, nombre, capacidad_max, estado,
                   ciclo_actual, anno,
                   ${sqlFecha('fecha_inicio')} AS fecha_inicio,
                   ${sqlFecha('fecha_fin')} AS fecha_fin`,
        [String(nombre).trim(), capacidad, estado, ciclo, fecha_inicio || null, fecha_fin || null, id]
      );

      // Los ciclos acompañan al ciclo actual: anteriores finalizados, el actual en curso
      await cliente.query(
        `UPDATE ciclos
         SET estado = CASE WHEN numero_ciclo < $2 THEN 'finalizado'
                           WHEN numero_ciclo = $2 THEN 'en curso'
                           ELSE 'pendiente' END
         WHERE salon_id = $1`,
        [id, ciclo]
      );

      return { status: 200, cuerpo: { mensaje: 'Salón actualizado correctamente.', salon: result.rows[0] } };
    });

    res.status(resultado.status).json(resultado.cuerpo);

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el salón.' });
  }
}

async function eliminarSalon(req, res) {
  try {
    const { id } = req.params;

    // Los ciclos vacíos se borran con el salón; si hay tareas, notas o material,
    // la llave foránea lo impide y se revierte todo
    const eliminado = await transaccion(async (cliente) => {
      await cliente.query('DELETE FROM ciclos WHERE salon_id = $1', [id]);
      const result = await cliente.query('DELETE FROM salones WHERE id = $1 RETURNING id', [id]);
      return result.rows.length > 0;
    });

    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Salón no encontrado.' });
    }

    res.json({ mensaje: 'Salón eliminado correctamente.' });

  } catch (err) {
    console.error(err);
    // 23503 = violación de llave foránea en PostgreSQL
    if (err.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar: este salón tiene matrículas, tareas u otros datos asociados.' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar el salón.' });
  }
}

async function obtenerMatriculas(req, res) {
  try {
    const result = await pool.query(
      `SELECT m.id, ${sqlFecha('m.fecha_matricula')} AS fecha_matricula, m.estado,
              m.valor_total::float8 AS valor_total, m.descuento::float8 AS descuento,
              m.saldo_pendiente::float8 AS saldo_pendiente, m.anno,
              m.observaciones,
              ue.nombre_completo AS estudiante, s.nombre AS salon,
              COALESCE(ur.nombre_completo, us.nombre_completo) AS registrado_por
       FROM matriculas m
       JOIN estudiantes e ON m.estudiante_id = e.id
       JOIN usuarios ue ON e.usuario_id = ue.id
       JOIN salones s ON m.salon_id = s.id
       LEFT JOIN admin sec ON m.secretaria_id = sec.id
       LEFT JOIN usuarios us ON sec.usuario_id = us.id
       LEFT JOIN usuarios ur ON m.registrado_por = ur.id
       ORDER BY m.fecha_matricula DESC`
    );

    res.json({ matriculas: result.rows });

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

    const result = await pool.query(
      `UPDATE matriculas SET estado = $1
       WHERE id = $2
       RETURNING id, estudiante_id, salon_id, secretaria_id,
                 ${sqlFecha('fecha_matricula')} AS fecha_matricula, estado,
                 valor_total::float8 AS valor_total, descuento::float8 AS descuento,
                 saldo_pendiente::float8 AS saldo_pendiente, anno`,
      [estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Matrícula no encontrada.' });
    }

    res.json({ mensaje: 'Estado de matrícula actualizado.', matricula: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar la matrícula.' });
  }
}

async function registrarPago(req, res) {
  try {
    const { matricula_id, metodo_pago, referencia_transaccion } = req.body;
    const monto = Number(req.body.monto);

    if (!matricula_id || !metodo_pago || req.body.monto === undefined || req.body.monto === null || req.body.monto === '') {
      return res.status(400).json({ mensaje: 'matricula_id, monto y metodo_pago son obligatorios.' });
    }

    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor que 0.' });
    }

    // Quién registra: admin (con su perfil de la tabla admin) o secretaria
    const { secretariaId, registradoPor } = await datosDeRegistro(req.usuario);

    // Todo en una transacción: FOR UPDATE bloquea la matrícula para que dos pagos
    // simultáneos no descuenten el mismo saldo dos veces
    const resultado = await transaccion(async (cliente) => {
      const matriculaResult = await cliente.query(
        `SELECT m.id, m.estado, m.saldo_pendiente::float8 AS saldo_pendiente, e.usuario_id
         FROM matriculas m JOIN estudiantes e ON e.id = m.estudiante_id
         WHERE m.id = $1 FOR UPDATE OF m`,
        [matricula_id]
      );

      if (matriculaResult.rows.length === 0) {
        return { status: 404, cuerpo: { mensaje: 'Matrícula no encontrada.' } };
      }

      const matricula = matriculaResult.rows[0];

      if (matricula.estado === 'cancelada') {
        return { status: 409, cuerpo: { mensaje: 'No se pueden registrar pagos en una matrícula cancelada.' } };
      }

      if (monto > matricula.saldo_pendiente) {
        return { status: 400, cuerpo: { mensaje: `El monto supera el saldo pendiente ($${matricula.saldo_pendiente}).` } };
      }

      const pagoResult = await cliente.query(
        `INSERT INTO pagos (matricula_id, secretaria_id, registrado_por, monto, metodo_pago, referencia_transaccion, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'exitoso')
         RETURNING id`,
        [matricula_id, secretariaId, registradoPor, monto, metodo_pago, referencia_transaccion || null]
      );

      // Descontar el pago; si el saldo queda en 0 la matrícula pendiente se activa
      const nuevoSaldo = Math.round((matricula.saldo_pendiente - monto) * 100) / 100;
      const actualizada = await cliente.query(
        `UPDATE matriculas
         SET saldo_pendiente = $1,
             estado = CASE WHEN $1 = 0 AND estado = 'pendiente' THEN 'activa' ELSE estado END
         WHERE id = $2
         RETURNING estado`,
        [nuevoSaldo, matricula_id]
      );

      return {
        status: 201,
        usuarioEstudiante: matricula.usuario_id,
        nuevoSaldo,
        cuerpo: {
          mensaje: nuevoSaldo === 0 ? 'Pago registrado. La matrícula quedó paga y activa.' : 'Pago registrado exitosamente.',
          id_pago: pagoResult.rows[0].id,
          saldo_pendiente_restante: nuevoSaldo,
          estado_matricula: actualizada.rows[0].estado
        }
      };
    });

    if (resultado.usuarioEstudiante) {
      const formato = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
      notificar([resultado.usuarioEstudiante], {
        tipo: 'pago',
        titulo: 'Pago registrado',
        mensaje: resultado.nuevoSaldo === 0
          ? `Recibimos tu pago de ${formato.format(monto)}. Tu matrícula está paga y activa.`
          : `Recibimos tu pago de ${formato.format(monto)}. Saldo pendiente: ${formato.format(resultado.nuevoSaldo)}.`,
        enlace: '/alumnos/inicio.html'
      });
    }

    res.status(resultado.status).json(resultado.cuerpo);

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar el pago.' });
  }
}

async function crearUsuario(req, res) {
  try {
    const { nombre_completo, contrasena, rol, telefono, fecha_nacimiento, pais, ciudad, datosPerfil } = req.body;
    const correo = normalizarCorreo(req.body.correo);

    if (!nombre_completo || !correo || !contrasena || !rol) {
      return res.status(400).json({ mensaje: 'nombre_completo, correo, contrasena y rol son obligatorios.' });
    }

    if (!REGEX_CORREO.test(correo)) {
      return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
    }

    const rolesValidos = ['estudiante', 'docente', 'admin', 'secretaria'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ mensaje: 'Rol inválido. Usa: estudiante, docente, secretaria o admin.' });
    }
    if (req.usuario.rol === 'secretaria' && rol !== 'estudiante') {
      return res.status(403).json({ mensaje: MENSAJE_SOLO_ESTUDIANTES });
    }

    if (contrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Verificar que el correo no esté repetido
    const existente = await pool.query('SELECT id FROM usuarios WHERE LOWER(correo) = $1', [correo]);

    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // Buscar el id del rol en la base de datos
    const rolResult = await pool.query('SELECT id FROM roles WHERE nombre = $1', [rol]);

    if (rolResult.rows.length === 0) {
      return res.status(400).json({ mensaje: 'Ese rol no existe en la base de datos.' });
    }

    const id_rol = rolResult.rows[0].id;
    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // Transacción: usuario + perfil se guardan juntos o no se guarda nada
    const cliente = await pool.connect();
    let nuevoUsuarioId;

    try {
      await cliente.query('BEGIN');

      const resultadoUsuario = await cliente.query(
        `INSERT INTO usuarios (rol_id, nombre_completo, correo, contrasena_hash, telefono, fecha_nacimiento, pais, ciudad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [id_rol, nombre_completo, correo, contrasena_hash, telefono || null, fecha_nacimiento || null, pais || null, ciudad || null]
      );

      nuevoUsuarioId = resultadoUsuario.rows[0].id;

      if (rol === 'estudiante') {
        const codigo_estudiante = `EST${String(nuevoUsuarioId).padStart(4, '0')}`;

        await cliente.query(
          `INSERT INTO estudiantes (usuario_id, codigo_estudiante, estado)
           VALUES ($1, $2, 'activo')`,
          [nuevoUsuarioId, codigo_estudiante]
        );

      } else if (rol === 'docente') {
        await cliente.query(
          `INSERT INTO docentes (usuario_id, especialidad, activo, fecha_ingreso)
           VALUES ($1, $2, TRUE, CURRENT_DATE)`,
          [nuevoUsuarioId, datosPerfil?.especialidad || null]
        );

      } else if (rol === 'admin') {
        await cliente.query(
          `INSERT INTO admin (usuario_id, cargo, sede, activo)
           VALUES ($1, $2, $3, TRUE)`,
          [nuevoUsuarioId, datosPerfil?.cargo || null, datosPerfil?.sede || null]
        );

      } else if (rol === 'secretaria') {
        await cliente.query(
          `INSERT INTO secretarias (usuario_id, cargo, sede, activo)
           VALUES ($1, $2, $3, TRUE)`,
          [nuevoUsuarioId, datosPerfil?.cargo || 'Secretaria académica', datosPerfil?.sede || null]
        );
      }

      await cliente.query('COMMIT');

    } catch (errTransaccion) {
      try { await cliente.query('ROLLBACK'); } catch (_) { /* ya estaba revertida */ }
      throw errTransaccion;
    } finally {
      cliente.release();
    }

    res.status(201).json({ mensaje: 'Usuario creado exitosamente.', id: nuevoUsuarioId, rol });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear el usuario.' });
  }
}

async function obtenerDocentes(req, res) {
  try {
    const result = await pool.query(
      `SELECT d.id, d.usuario_id, d.especialidad, d.activo,
              ${sqlFecha('d.fecha_ingreso')} AS fecha_ingreso,
              u.nombre_completo, u.correo, u.telefono
       FROM docentes d
       JOIN usuarios u ON d.usuario_id = u.id
       ORDER BY u.nombre_completo ASC`
    );

    res.json({ docentes: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los docentes.' });
  }
}

async function obtenerHorariosTipo(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, dias_semana,
              ${sqlHora('hora_inicio')} AS hora_inicio,
              ${sqlHora('hora_fin')} AS hora_fin
       FROM horarios_tipo
       ORDER BY id ASC`
    );

    res.json({ horarios: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los horarios.' });
  }
}

async function obtenerNiveles(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, nombre
       FROM niveles
       ORDER BY id ASC`
    );

    res.json({ niveles: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los niveles.' });
  }
}

async function editarUsuario(req, res) {
  try {
    const { id } = req.params;
    const { nombre_completo, telefono, fecha_nacimiento, pais, ciudad, contrasena, datosPerfil } = req.body;
    const correo = normalizarCorreo(req.body.correo);

    if (!nombre_completo || !correo) {
      return res.status(400).json({ mensaje: 'nombre_completo y correo son obligatorios.' });
    }

    if (!REGEX_CORREO.test(correo)) {
      return res.status(400).json({ mensaje: 'El correo electrónico no es válido.' });
    }

    if (contrasena && contrasena.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Verificar que el usuario exista y traer su rol (el rol no se puede cambiar)
    const usuarioResult = await pool.query(
      `SELECT u.id, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (usuarioResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    const rol = usuarioResult.rows[0].rol;

    if (req.usuario.rol === 'secretaria' && rol !== 'estudiante') {
      return res.status(403).json({ mensaje: MENSAJE_SOLO_ESTUDIANTES });
    }

    // Verificar que el correo no lo tenga otro usuario
    const repetido = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(correo) = $1 AND id <> $2',
      [correo, id]
    );

    if (repetido.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este correo ya está registrado.' });
    }

    // Si no llega contraseña, se deja la actual
    const contrasena_hash = contrasena ? await bcrypt.hash(contrasena, 10) : null;

    const cliente = await pool.connect();
    let usuarioActualizado;

    try {
      await cliente.query('BEGIN');

      const resultadoUsuario = await cliente.query(
        `UPDATE usuarios
         SET nombre_completo = $1, correo = $2,
             telefono = COALESCE($3::text, telefono),
             fecha_nacimiento = COALESCE($4::date, fecha_nacimiento),
             pais = COALESCE($5::text, pais),
             ciudad = COALESCE($6::text, ciudad),
             contrasena_hash = COALESCE($7::text, contrasena_hash),
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING id, nombre_completo, correo`,
        [nombre_completo, correo, telefono || null, fecha_nacimiento || null, pais || null, ciudad || null, contrasena_hash, id]
      );

      usuarioActualizado = resultadoUsuario.rows[0];

      if (rol === 'docente' && datosPerfil && typeof datosPerfil.especialidad === 'string') {
        await cliente.query(
          'UPDATE docentes SET especialidad = $1 WHERE usuario_id = $2',
          [datosPerfil.especialidad || null, id]
        );
      }

      // Cargo y sede del personal administrativo
      if ((rol === 'admin' || rol === 'secretaria') && datosPerfil) {
        const tabla = rol === 'admin' ? 'admin' : 'secretarias';
        const cargo = typeof datosPerfil.cargo === 'string' ? datosPerfil.cargo.trim() || null : null;
        const sede = typeof datosPerfil.sede === 'string' ? datosPerfil.sede.trim() || null : null;
        const actualizado = await cliente.query(
          `UPDATE ${tabla} SET cargo = $1, sede = $2 WHERE usuario_id = $3`,
          [cargo, sede, id]
        );
        if (actualizado.rowCount === 0) {
          await cliente.query(
            `INSERT INTO ${tabla} (usuario_id, cargo, sede, activo) VALUES ($1, $2, $3, TRUE)`,
            [id, cargo, sede]
          );
        }
      }

      await cliente.query('COMMIT');

    } catch (errTransaccion) {
      try { await cliente.query('ROLLBACK'); } catch (_) { /* ya estaba revertida */ }
      throw errTransaccion;
    } finally {
      cliente.release();
    }

    res.json({ mensaje: 'Usuario actualizado correctamente.', usuario: usuarioActualizado });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar el usuario.' });
  }
}

async function obtenerEstudiantes(req, res) {
  try {
    const result = await pool.query(
      `SELECT e.id, e.usuario_id, e.codigo_estudiante, e.estado,
              u.nombre_completo, u.correo, u.telefono, u.activo
       FROM estudiantes e
       JOIN usuarios u ON e.usuario_id = u.id
       ORDER BY u.nombre_completo ASC`
    );

    res.json({ estudiantes: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los estudiantes.' });
  }
}

async function crearMatricula(req, res) {
  try {
    const { estudiante_id, salon_id } = req.body;

    if (!estudiante_id || !salon_id) {
      return res.status(400).json({ mensaje: 'estudiante_id y salon_id son obligatorios.' });
    }

    // El estudiante debe existir y estar activo (estudiante_id es estudiantes.id)
    const estudianteResult = await pool.query(
      `SELECT e.id, e.estado, e.usuario_id, u.activo
       FROM estudiantes e
       JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.id = $1`,
      [estudiante_id]
    );

    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }

    if (!estudianteResult.rows[0].activo) {
      return res.status(409).json({ mensaje: 'El estudiante está inactivo. Actívalo antes de matricularlo.' });
    }

    // El salón debe existir, estar activo, y traemos el precio de su nivel
    const salonResult = await pool.query(
      `SELECT s.id, s.nombre, s.anno, s.capacidad_max, n.precio::float8 AS precio,
              (SELECT COUNT(*)::int FROM matriculas m
               WHERE m.salon_id = s.id
               AND m.estado IN ('pendiente', 'activa')) AS ocupados
       FROM salones s
       JOIN niveles n ON s.nivel_id = n.id
       WHERE s.id = $1 AND s.estado = 'activo'`,
      [salon_id]
    );

    if (salonResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no disponible.' });
    }

    const salon = salonResult.rows[0];

    if (salon.ocupados >= salon.capacidad_max) {
      return res.status(409).json({ mensaje: 'Este salón ya no tiene cupos disponibles.' });
    }

    // No permitir matrículas duplicadas en el mismo salón
    const existente = await pool.query(
      `SELECT id FROM matriculas
       WHERE estudiante_id = $1 AND salon_id = $2
       AND estado IN ('pendiente', 'activa')`,
      [estudiante_id, salon_id]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Este estudiante ya tiene una matrícula pendiente o activa en este salón.' });
    }

    // Quién registra: admin (con su perfil de la tabla admin) o secretaria
    const { secretariaId, registradoPor } = await datosDeRegistro(req.usuario);

    const result = await pool.query(
      `INSERT INTO matriculas (estudiante_id, salon_id, secretaria_id, registrado_por, estado, valor_total, descuento, saldo_pendiente, anno)
       VALUES ($1, $2, $3, $6, 'pendiente', $4, 0, $4, $5)
       RETURNING id, estado, valor_total::float8 AS valor_total, saldo_pendiente::float8 AS saldo_pendiente`,
      [estudiante_id, salon_id, secretariaId, salon.precio, salon.anno, registradoPor]
    );

    notificar([estudianteResult.rows[0].usuario_id], {
      tipo: 'matricula',
      titulo: 'Matrícula registrada',
      mensaje: `Quedaste matriculado en "${salon.nombre}". La matrícula se activa al completar el pago.`,
      enlace: '/alumnos/inicio.html'
    });

    res.status(201).json({ mensaje: 'Matrícula creada. Queda pendiente hasta registrar el pago.', matricula: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear la matrícula.' });
  }
}
async function eliminarUsuario(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    if (Number(id) === req.usuario.id_usuario) {
      return res.status(400).json({ mensaje: 'No puedes eliminar tu propia cuenta.' });
    }

    await client.query('BEGIN');

    const usuario = await client.query(
      `SELECT u.id, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (usuario.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    const rolObjetivo = usuario.rows[0].rol;

    if (req.usuario.rol === 'secretaria' && rolObjetivo !== 'estudiante') {
      await client.query('ROLLBACK');
      return res.status(403).json({ mensaje: MENSAJE_SOLO_ESTUDIANTES });
    }

    if (rolObjetivo === 'admin') {
      // Bloquea a los demás admins mientras se cuenta, para no quedarse sin ninguno
      const otros = await client.query(
        `SELECT u.id FROM usuarios u JOIN roles r ON u.rol_id = r.id
         WHERE r.nombre = 'admin' AND u.activo = TRUE AND u.id <> $1 FOR UPDATE OF u`,
        [id]
      );
      if (otros.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ mensaje: 'Debe quedar al menos un administrador activo.' });
      }
    }

    await client.query('DELETE FROM estudiantes WHERE usuario_id = $1', [id]);
    await client.query('DELETE FROM docentes WHERE usuario_id = $1', [id]);
    await client.query('DELETE FROM admin WHERE usuario_id = $1', [id]);
    await client.query('DELETE FROM secretarias WHERE usuario_id = $1', [id]);
    await client.query('DELETE FROM usuarios WHERE id = $1', [id]);

    await client.query('COMMIT');
    olvidarUsuario(id);
    res.json({ mensaje: 'Usuario eliminado correctamente.' });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar: tiene matrículas, salones, pagos, anuncios u otros datos asociados. Desactívalo en su lugar.' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar el usuario.' });
  } finally {
    client.release();
  }
}

async function actualizarMatricula(req, res) {
  try {
    const { id } = req.params;
    const descuento = Number(req.body.descuento);
    const observaciones = req.body.observaciones ? String(req.body.observaciones).trim() : null;

    if (Number.isNaN(descuento) || descuento < 0) {
      return res.status(400).json({ mensaje: 'El descuento debe ser un número mayor o igual a 0.' });
    }

    const result = await pool.query(
      `UPDATE matriculas
       SET descuento = $1,
           saldo_pendiente = saldo_pendiente + descuento - $1,
           observaciones = $2
       WHERE id = $3
         AND $1 <= valor_total
         AND saldo_pendiente + descuento - $1 >= 0
       RETURNING id, estado, valor_total::float8 AS valor_total, descuento::float8 AS descuento,
                 saldo_pendiente::float8 AS saldo_pendiente, observaciones`,
      [descuento, observaciones, id]
    );

    if (result.rows.length === 0) {
      const existe = await pool.query('SELECT id FROM matriculas WHERE id = $1', [id]);
      if (existe.rows.length === 0) {
        return res.status(404).json({ mensaje: 'Matrícula no encontrada.' });
      }
      return res.status(400).json({ mensaje: 'Descuento inválido: supera el valor de la matrícula o el saldo ya pagado.' });
    }

    res.json({ mensaje: 'Matrícula actualizada correctamente.', matricula: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar la matrícula.' });
  }
}

async function eliminarMatricula(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM matriculas WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Matrícula no encontrada.' });
    }

    res.json({ mensaje: 'Matrícula eliminada correctamente.' });

  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar: la matrícula tiene pagos o notas asociados. Cancélala en su lugar.' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar la matrícula.' });
  }
}
async function obtenerPersonal(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre_completo, u.correo, u.telefono, u.activo, u.creado_en,
              r.nombre AS rol,
              COALESCE(a.cargo, s.cargo) AS cargo,
              COALESCE(a.sede, s.sede) AS sede
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       LEFT JOIN admin a ON a.usuario_id = u.id AND r.nombre = 'admin'
       LEFT JOIN secretarias s ON s.usuario_id = u.id AND r.nombre = 'secretaria'
       WHERE r.nombre IN ('admin', 'secretaria')
       ORDER BY r.nombre ASC, u.nombre_completo ASC`
    );
    res.json({ personal: result.rows, yo: req.usuario.id_usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el personal.' });
  }
}

module.exports = { obtenerPersonal, obtenerUsuarios, cambiarEstadoUsuario, crearUsuario, editarUsuario, eliminarUsuario, obtenerEstudiantes, obtenerDocentes, obtenerHorariosTipo, obtenerNiveles, obtenerSalones, crearSalon, actualizarSalon, eliminarSalon, obtenerMatriculas, crearMatricula, actualizarMatricula, cambiarEstadoMatricula, eliminarMatricula, registrarPago };