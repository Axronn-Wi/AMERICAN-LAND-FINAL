const db = require('../config/db');
const pool = db.pool || db;
const crypto = require('crypto');
const { transaccion } = require('../utils/sql');
const { notificar, usuariosAdmin } = require('../utils/notificar');

async function obtenerNiveles(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, codigo, nombre, descripcion, precio::float8 AS precio, ciclos_totales
       FROM niveles
       ORDER BY orden ASC`
    );

    res.json({ niveles: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los niveles.' });
  }
}

async function obtenerSalonesPorNivel(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.id, s.nombre, s.fecha_inicio, s.fecha_fin,
              u.nombre_completo AS docente,
              ht.dias_semana, ht.hora_inicio, ht.hora_fin,
              s.capacidad_max - (SELECT COUNT(*) FROM matriculas m
                                 WHERE m.salon_id = s.id
                                 AND m.estado IN ('pendiente', 'activa'))::int AS cupos_disponibles
       FROM salones s
       JOIN docentes d ON s.docente_id = d.id
       JOIN usuarios u ON d.usuario_id = u.id
       JOIN horarios_tipo ht ON s.horario_tipo_id = ht.id
       WHERE s.nivel_id = $1 AND s.estado = 'activo'
       ORDER BY s.nombre ASC`,
      [id]
    );

    res.json({ salones: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los salones del nivel.' });
  }
}

async function crearMatricula(req, res) {
  try {
    const { salon_id } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!salon_id) {
      return res.status(400).json({ mensaje: 'salon_id es obligatorio.' });
    }

    const estudianteResult = await pool.query(
      'SELECT id FROM estudiantes WHERE usuario_id = $1',
      [id_usuario]
    );

    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.rows[0].id;

    // El salón debe existir, estar activo, y traemos el precio de su nivel
    const salonResult = await pool.query(
      `SELECT s.id, s.anno, s.capacidad_max, n.precio,
              (SELECT COUNT(*) FROM matriculas m
               WHERE m.salon_id = s.id
               AND m.estado IN ('pendiente', 'activa'))::int AS ocupados
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
      [id_estudiante, salon_id]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({ mensaje: 'Ya tienes una matrícula pendiente o activa en este salón.' });
    }

    const result = await pool.query(
      `INSERT INTO matriculas (estudiante_id, salon_id, estado, valor_total, descuento, saldo_pendiente, anno)
       VALUES ($1, $2, 'pendiente', $3, 0, $3, $4)
       RETURNING id, estado, valor_total::float8 AS valor_total, saldo_pendiente::float8 AS saldo_pendiente`,
      [id_estudiante, salon_id, salon.precio, salon.anno]
    );

    res.status(201).json({ mensaje: 'Matrícula creada. Falta realizar el pago.', matricula: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear la matrícula.' });
  }
}

async function procesarPago(req, res) {
  try {
    const { matricula_id, metodo_pago } = req.body;
    const id_usuario = req.usuario.id_usuario;

    const metodosValidos = ['tarjeta', 'pse', 'transferencia'];

    if (!matricula_id || !metodo_pago) {
      return res.status(400).json({ mensaje: 'matricula_id y metodo_pago son obligatorios.' });
    }
    if (!metodosValidos.includes(metodo_pago)) {
      return res.status(400).json({ mensaje: 'Método de pago inválido. Usa: tarjeta, pse o transferencia.' });
    }

    const estudianteResult = await pool.query(
      'SELECT id FROM estudiantes WHERE usuario_id = $1',
      [id_usuario]
    );

    if (estudianteResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.rows[0].id;

    // Transacción + FOR UPDATE: si el estudiante hace doble clic en "Pagar",
    // el segundo intento espera al primero y ya no encuentra saldo pendiente
    const resultado = await transaccion(async (cliente) => {
      // La matrícula debe existir Y ser de este estudiante
      const matriculaResult = await cliente.query(
        `SELECT id, estado, saldo_pendiente::float8 AS saldo_pendiente FROM matriculas
         WHERE id = $1 AND estudiante_id = $2
         FOR UPDATE`,
        [matricula_id, id_estudiante]
      );

      if (matriculaResult.rows.length === 0) {
        return { status: 404, cuerpo: { mensaje: 'Matrícula no encontrada.' } };
      }

      const matricula = matriculaResult.rows[0];

      if (matricula.estado !== 'pendiente' || matricula.saldo_pendiente <= 0) {
        return { status: 409, cuerpo: { mensaje: 'Esta matrícula no tiene un pago pendiente.' } };
      }

      // El monto lo decide la base de datos, nunca el cliente
      const monto = matricula.saldo_pendiente;
      const referencia = `ONL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const pagoResult = await cliente.query(
        `INSERT INTO pagos (matricula_id, monto, metodo_pago, referencia_transaccion, estado)
         VALUES ($1, $2, $3, $4, 'exitoso')
         RETURNING id`,
        [matricula_id, monto, metodo_pago, referencia]
      );

      await cliente.query(
        `UPDATE matriculas SET saldo_pendiente = 0, estado = 'activa'
         WHERE id = $1`,
        [matricula_id]
      );

      return {
        status: 201,
        cuerpo: {
          mensaje: 'Pago aprobado. Tu matrícula está activa.',
          id_pago: pagoResult.rows[0].id,
          referencia,
          monto,
          estado_matricula: 'activa'
        }
      };
    });

    if (resultado.status === 201) {
      notificar([id_usuario], {
        tipo: 'pago',
        titulo: 'Pago aprobado',
        mensaje: `Tu pago (ref. ${resultado.cuerpo.referencia}) fue aprobado. Tu matrícula ya está activa.`,
        enlace: '/alumnos/inicio.html'
      });
      usuariosAdmin()
        .then((ids) => notificar(ids, {
          tipo: 'pago',
          titulo: 'Pago en línea recibido',
          mensaje: `${req.usuario.correo} pagó su matrícula en línea (ref. ${resultado.cuerpo.referencia}).`,
          enlace: '/admin/matriculas.html'
        }))
        .catch(() => {});
    }

    res.status(resultado.status).json(resultado.cuerpo);

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al procesar el pago.' });
  }
}

module.exports = { obtenerNiveles, obtenerSalonesPorNivel, crearMatricula, procesarPago };