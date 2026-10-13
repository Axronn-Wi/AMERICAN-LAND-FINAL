const { sql, getPool } = require('../config/db');

async function obtenerNiveles(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`SELECT id, codigo, nombre, descripcion, precio, ciclos_totales
              FROM Niveles
              ORDER BY orden ASC`);

    res.json({ niveles: result.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los niveles.' });
  }
}

async function obtenerSalonesPorNivel(req, res) {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool.request()
      .input('nivel_id', sql.Int, id)
      .query(`SELECT s.id, s.nombre, s.fecha_inicio, s.fecha_fin,
                     u.nombre_completo AS docente,
                     ht.dias_semana, ht.hora_inicio, ht.hora_fin,
                     s.capacidad_max - (SELECT COUNT(*) FROM Matriculas m
                                        WHERE m.salon_id = s.id
                                        AND m.estado IN ('pendiente', 'activa')) AS cupos_disponibles
              FROM Salones s
              JOIN Docentes d ON s.docente_id = d.id
              JOIN Usuarios u ON d.usuario_id = u.id
              JOIN Horarios_Tipo ht ON s.horario_tipo_id = ht.id
              WHERE s.nivel_id = @nivel_id AND s.estado = 'activo'
              ORDER BY s.nombre ASC`);

    res.json({ salones: result.recordset });

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

    const pool = await getPool();

    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.recordset[0].id;

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
      .input('estudiante_id', sql.Int, id_estudiante)
      .input('salon_id', sql.Int, salon_id)
      .query(`SELECT id FROM Matriculas
              WHERE estudiante_id = @estudiante_id AND salon_id = @salon_id
              AND estado IN ('pendiente', 'activa')`);

    if (existente.recordset.length > 0) {
      return res.status(409).json({ mensaje: 'Ya tienes una matrícula pendiente o activa en este salón.' });
    }

    const result = await pool.request()
      .input('estudiante_id', sql.Int, id_estudiante)
      .input('salon_id', sql.Int, salon_id)
      .input('valor_total', sql.Decimal(10, 2), salon.precio)
      .input('anno', sql.Int, salon.anno)
      .query(`INSERT INTO Matriculas (estudiante_id, salon_id, estado, valor_total, descuento, saldo_pendiente, anno)
              OUTPUT INSERTED.id, INSERTED.estado, INSERTED.valor_total, INSERTED.saldo_pendiente
              VALUES (@estudiante_id, @salon_id, 'pendiente', @valor_total, 0, @valor_total, @anno)`);

    res.status(201).json({ mensaje: 'Matrícula creada. Falta realizar el pago.', matricula: result.recordset[0] });

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

    const pool = await getPool();

    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.recordset[0].id;

    // La matrícula debe existir Y ser de este estudiante
    const matriculaResult = await pool.request()
      .input('matricula_id', sql.Int, matricula_id)
      .input('estudiante_id', sql.Int, id_estudiante)
      .query(`SELECT id, estado, saldo_pendiente FROM Matriculas
              WHERE id = @matricula_id AND estudiante_id = @estudiante_id`);

    if (matriculaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Matrícula no encontrada.' });
    }

    const matricula = matriculaResult.recordset[0];

    if (matricula.estado !== 'pendiente' || matricula.saldo_pendiente <= 0) {
      return res.status(409).json({ mensaje: 'Esta matrícula no tiene un pago pendiente.' });
    }

    // El monto lo decide la base de datos, nunca el cliente
    const monto = matricula.saldo_pendiente;
    const referencia = `ONL-${Date.now()}`;

    const pagoResult = await pool.request()
      .input('matricula_id', sql.Int, matricula_id)
      .input('monto', sql.Decimal(10, 2), monto)
      .input('metodo_pago', sql.VarChar, metodo_pago)
      .input('referencia', sql.VarChar, referencia)
      .query(`INSERT INTO Pagos (matricula_id, monto, metodo_pago, referencia_transaccion, estado)
              OUTPUT INSERTED.id
              VALUES (@matricula_id, @monto, @metodo_pago, @referencia, 'exitoso')`);

    await pool.request()
      .input('matricula_id', sql.Int, matricula_id)
      .query(`UPDATE Matriculas SET saldo_pendiente = 0, estado = 'activa'
              WHERE id = @matricula_id`);

    res.status(201).json({
      mensaje: 'Pago aprobado. Tu matrícula está activa.',
      id_pago: pagoResult.recordset[0].id,
      referencia,
      monto,
      estado_matricula: 'activa'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al procesar el pago.' });
  }
}

module.exports = { obtenerNiveles, obtenerSalonesPorNivel, crearMatricula, procesarPago };