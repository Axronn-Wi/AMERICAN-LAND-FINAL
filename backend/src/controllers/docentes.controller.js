const fs = require('fs');
const path = require('path');
const { sql, getPool } = require('../config/db');
const { CARPETA_MATERIAL } = require('../config/uploads');

async function obtenerMisSalones(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    const salonesResult = await pool.request()
      .input('id_docente', sql.Int, id_docente)
      .query(`SELECT s.id, s.nombre, s.estado, s.ciclo_actual, n.nombre AS nivel,
                     ht.dias_semana, ht.hora_inicio, ht.hora_fin,
                     (SELECT COUNT(*) FROM Matriculas m
                      WHERE m.salon_id = s.id AND m.estado = 'activa') AS total_estudiantes
              FROM Salones s
              JOIN Niveles n ON s.nivel_id = n.id
              JOIN Horarios_Tipo ht ON s.horario_tipo_id = ht.id
              WHERE s.docente_id = @id_docente
              ORDER BY s.nombre ASC`);

    res.json({ salones: salonesResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los salones del docente.' });
  }
}
async function obtenerEstudiantesSalon(req, res) {
  try {
    const { id } = req.params;
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // Verificar que el salón pertenezca a este docente
    const salonResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id, nombre FROM Salones WHERE id = @id_salon AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    const estudiantesResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .query(`SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo, u.correo
              FROM Matriculas m
              JOIN Estudiantes e ON m.estudiante_id = e.id
              JOIN Usuarios u ON e.usuario_id = u.id
              WHERE m.salon_id = @id_salon AND m.estado = 'activa'
              ORDER BY u.nombre_completo ASC`);

    res.json({ salon: salonResult.recordset[0].nombre, estudiantes: estudiantesResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los estudiantes del salón.' });
  }
}
async function obtenerNotasSalon(req, res) {
  try {
    const { id } = req.params;
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // Verificar que el salón pertenezca a este docente
    const salonResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id, nombre FROM Salones WHERE id = @id_salon AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    // Ciclos del salón
    const ciclosResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .query(`SELECT id, numero_ciclo
              FROM Ciclos
              WHERE salon_id = @id_salon
              ORDER BY numero_ciclo ASC`);

    // Estudiantes con matrícula activa
    const estudiantesResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .query(`SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo
              FROM Matriculas m
              JOIN Estudiantes e ON m.estudiante_id = e.id
              JOIN Usuarios u ON e.usuario_id = u.id
              WHERE m.salon_id = @id_salon AND m.estado = 'activa'
              ORDER BY u.nombre_completo ASC`);

    // Todas las notas registradas en este salón
    const notasResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .query(`SELECT estudiante_id, ciclo_id, nota_ciclo, nota_examen_final, promedio, estado
              FROM Notas
              WHERE salon_id = @id_salon`);

    res.json({
      salon: salonResult.recordset[0].nombre,
      ciclos: ciclosResult.recordset,
      estudiantes: estudiantesResult.recordset,
      notas: notasResult.recordset
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las notas del salón.' });
  }
}async function obtenerTareasSalon(req, res) {
  try {
    const { id } = req.params;
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // Verificar que el salón pertenezca a este docente
    const salonResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id, nombre FROM Salones WHERE id = @id_salon AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

      const tareasResult = await pool.request()
      .input('id_salon', sql.Int, id)
      .query(`SELECT t.id, t.ciclo_id, c.numero_ciclo, t.titulo, t.descripcion,
                     t.fecha_limite, t.valor_porcentaje, t.tipo,
                     (SELECT COUNT(*) FROM Matriculas m
                      WHERE m.salon_id = t.salon_id AND m.estado = 'activa') AS total_estudiantes,
                     (SELECT COUNT(*) FROM Entregas_Tareas et
                      WHERE et.tarea_id = t.id) AS total_entregas
              FROM Tareas t
              JOIN Ciclos c ON t.ciclo_id = c.id
              WHERE t.salon_id = @id_salon
              ORDER BY t.fecha_limite DESC`);

    res.json({ salon: salonResult.recordset[0].nombre, tareas: tareasResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las tareas del salón.' });
  }
}
async function registrarNota(req, res) {
  try {
    const { estudiante_id, salon_id, ciclo_id, nota_ciclo, nota_examen_final } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!estudiante_id || !salon_id || !ciclo_id) {
      return res.status(400).json({ mensaje: 'estudiante_id, salon_id y ciclo_id son obligatorios.' });
    }

    const enviadas = [nota_ciclo, nota_examen_final].filter(n => n !== undefined && n !== null);
    if (enviadas.length === 0) {
      return res.status(400).json({ mensaje: 'Envía al menos nota_ciclo o nota_examen_final.' });
    }
    if (enviadas.some(n => typeof n !== 'number' || n < 0 || n > 5)) {
      return res.status(400).json({ mensaje: 'Las notas deben ser números entre 0 y 5.' });
    }

    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // 1. El salón debe ser de este docente
    const salonResult = await pool.request()
      .input('salon_id', sql.Int, salon_id)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id FROM Salones WHERE id = @salon_id AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    // 2. El ciclo debe pertenecer a ese salón
    const cicloResult = await pool.request()
      .input('ciclo_id', sql.Int, ciclo_id)
      .input('salon_id', sql.Int, salon_id)
      .query('SELECT id FROM Ciclos WHERE id = @ciclo_id AND salon_id = @salon_id');

    if (cicloResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Ciclo no encontrado en este salón.' });
    }

    // 3. El estudiante debe estar matriculado (activo) en ese salón
    const matriculaResult = await pool.request()
      .input('estudiante_id', sql.Int, estudiante_id)
      .input('salon_id', sql.Int, salon_id)
      .query(`SELECT id FROM Matriculas
              WHERE estudiante_id = @estudiante_id AND salon_id = @salon_id AND estado = 'activa'`);

    if (matriculaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'El estudiante no está matriculado en este salón.' });
    }

    // ¿Ya existe una nota para este estudiante en este ciclo?
    const existente = await pool.request()
      .input('estudiante_id', sql.Int, estudiante_id)
      .input('ciclo_id', sql.Int, ciclo_id)
      .input('salon_id', sql.Int, salon_id)
      .query(`SELECT id, nota_ciclo, nota_examen_final FROM Notas
              WHERE estudiante_id = @estudiante_id AND ciclo_id = @ciclo_id AND salon_id = @salon_id`);

    let notaCiclo = nota_ciclo ?? null;
    let notaFinal = nota_examen_final ?? null;

    if (existente.recordset.length > 0) {
      const previa = existente.recordset[0];
      notaCiclo = nota_ciclo ?? previa.nota_ciclo;
      notaFinal = nota_examen_final ?? previa.nota_examen_final;
    }

    const valores = [notaCiclo, notaFinal].filter(n => n !== null);
    const promedio = Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
    const estado = promedio >= 3.0 ? 'aprobado' : 'reprobado';

    const request = pool.request()
      .input('estudiante_id', sql.Int, estudiante_id)
      .input('ciclo_id', sql.Int, ciclo_id)
      .input('salon_id', sql.Int, salon_id)
      .input('nota_ciclo', sql.Decimal(3, 1), notaCiclo)
      .input('nota_examen_final', sql.Decimal(3, 1), notaFinal)
      .input('promedio', sql.Decimal(3, 1), promedio)
      .input('estado', sql.VarChar, estado);

    let result;
    if (existente.recordset.length > 0) {
      result = await request.query(`UPDATE Notas
        SET nota_ciclo = @nota_ciclo, nota_examen_final = @nota_examen_final,
            promedio = @promedio, estado = @estado, actualizado_en = GETDATE()
        OUTPUT INSERTED.*
        WHERE estudiante_id = @estudiante_id AND ciclo_id = @ciclo_id AND salon_id = @salon_id`);
    } else {
      result = await request.query(`INSERT INTO Notas
        (estudiante_id, ciclo_id, salon_id, nota_ciclo, nota_examen_final, promedio, estado)
        OUTPUT INSERTED.*
        VALUES (@estudiante_id, @ciclo_id, @salon_id, @nota_ciclo, @nota_examen_final, @promedio, @estado)`);
    }

    res.status(existente.recordset.length > 0 ? 200 : 201).json({
      mensaje: 'Nota registrada correctamente.',
      nota: result.recordset[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar la nota.' });
  }
}
async function crearTarea(req, res) {
  try {
    const { salon_id, ciclo_id, titulo, descripcion, fecha_limite, valor_porcentaje, tipo } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!salon_id || !ciclo_id || !titulo || !fecha_limite) {
      return res.status(400).json({ mensaje: 'salon_id, ciclo_id, titulo y fecha_limite son obligatorios.' });
    }

    if (isNaN(Date.parse(fecha_limite))) {
      return res.status(400).json({ mensaje: 'fecha_limite no es una fecha válida (usa el formato AAAA-MM-DD).' });
    }

    const porcentaje = valor_porcentaje ?? 0;
    if (typeof porcentaje !== 'number' || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ mensaje: 'valor_porcentaje debe ser un número entre 0 y 100.' });
    }

    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // 1. El salón debe ser de este docente
    const salonResult = await pool.request()
      .input('salon_id', sql.Int, salon_id)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id FROM Salones WHERE id = @salon_id AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    // 2. El ciclo debe pertenecer a ese salón
    const cicloResult = await pool.request()
      .input('ciclo_id', sql.Int, ciclo_id)
      .input('salon_id', sql.Int, salon_id)
      .query('SELECT id FROM Ciclos WHERE id = @ciclo_id AND salon_id = @salon_id');

    if (cicloResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Ciclo no encontrado en este salón.' });
    }

    const result = await pool.request()
      .input('salon_id', sql.Int, salon_id)
      .input('ciclo_id', sql.Int, ciclo_id)
      .input('titulo', sql.VarChar, titulo)
      .input('descripcion', sql.VarChar, descripcion || null)
      .input('fecha_limite', sql.Date, fecha_limite)
      .input('valor_porcentaje', sql.Decimal(5, 2), porcentaje)
      .input('tipo', sql.VarChar, tipo || null)
      .query(`INSERT INTO Tareas (salon_id, ciclo_id, titulo, descripcion, fecha_limite, valor_porcentaje, tipo)
              OUTPUT INSERTED.*
              VALUES (@salon_id, @ciclo_id, @titulo, @descripcion, @fecha_limite, @valor_porcentaje, @tipo)`);

    res.status(201).json({ mensaje: 'Tarea creada exitosamente.', tarea: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear la tarea.' });
  }
}
async function editarTarea(req, res) {
  try {
    const { id } = req.params;
    const { titulo, descripcion, fecha_limite, valor_porcentaje, tipo } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!titulo || !fecha_limite) {
      return res.status(400).json({ mensaje: 'titulo y fecha_limite son obligatorios.' });
    }

    if (isNaN(Date.parse(fecha_limite))) {
      return res.status(400).json({ mensaje: 'fecha_limite no es una fecha válida (usa el formato AAAA-MM-DD).' });
    }

    const porcentaje = valor_porcentaje ?? 0;
    if (typeof porcentaje !== 'number' || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ mensaje: 'valor_porcentaje debe ser un número entre 0 y 100.' });
    }

    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // La tarea debe pertenecer a un salón de este docente
    const tareaResult = await pool.request()
      .input('id_tarea', sql.Int, id)
      .input('id_docente', sql.Int, id_docente)
      .query(`SELECT t.id
              FROM Tareas t
              JOIN Salones s ON t.salon_id = s.id
              WHERE t.id = @id_tarea AND s.docente_id = @id_docente`);

    if (tareaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    const result = await pool.request()
      .input('id_tarea', sql.Int, id)
      .input('titulo', sql.VarChar, titulo)
      .input('descripcion', sql.VarChar, descripcion || null)
      .input('fecha_limite', sql.Date, fecha_limite)
      .input('valor_porcentaje', sql.Decimal(5, 2), porcentaje)
      .input('tipo', sql.VarChar, tipo || null)
      .query(`UPDATE Tareas
              SET titulo = @titulo, descripcion = @descripcion, fecha_limite = @fecha_limite,
                  valor_porcentaje = @valor_porcentaje, tipo = @tipo
              OUTPUT INSERTED.*
              WHERE id = @id_tarea`);

    res.json({ mensaje: 'Tarea actualizada correctamente.', tarea: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al actualizar la tarea.' });
  }
}
async function eliminarTarea(req, res) {
  try {
    const id_tarea = parseInt(req.params.id, 10);
    if (isNaN(id_tarea)) {
      return res.status(400).json({ mensaje: 'Id de tarea inválido.' });
    }

    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // La tarea debe pertenecer a un salón de este docente
    const tareaResult = await pool.request()
      .input('id_tarea', sql.Int, id_tarea)
      .input('id_docente', sql.Int, id_docente)
      .query(`SELECT t.id
              FROM Tareas t
              JOIN Salones s ON t.salon_id = s.id
              WHERE t.id = @id_tarea AND s.docente_id = @id_docente`);

    if (tareaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    // Si ya tiene entregas de estudiantes, no se borra
    const entregasResult = await pool.request()
      .input('id_tarea', sql.Int, id_tarea)
      .query('SELECT COUNT(*) AS total FROM Entregas_Tareas WHERE tarea_id = @id_tarea');

    if (entregasResult.recordset[0].total > 0) {
      return res.status(409).json({ mensaje: 'No puedes eliminar esta tarea porque ya tiene entregas de estudiantes.' });
    }

    await pool.request()
      .input('id_tarea', sql.Int, id_tarea)
      .query('DELETE FROM Tareas WHERE id = @id_tarea');

    res.json({ mensaje: 'Tarea eliminada correctamente.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar la tarea.' });
  }
}
async function obtenerEntregasTarea(req, res) {
  try {
    const { id } = req.params; // id de la tarea
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // La tarea debe pertenecer a un salón de este docente
    const tareaResult = await pool.request()
      .input('id_tarea', sql.Int, id)
      .input('id_docente', sql.Int, id_docente)
      .query(`SELECT t.id, t.salon_id, t.titulo, t.fecha_limite, t.valor_porcentaje
              FROM Tareas t
              JOIN Salones s ON t.salon_id = s.id
              WHERE t.id = @id_tarea AND s.docente_id = @id_docente`);

    if (tareaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    const tarea = tareaResult.recordset[0];

    // Todos los alumnos activos del salón, con su entrega si existe
    const entregasResult = await pool.request()
      .input('id_tarea', sql.Int, id)
      .input('id_salon', sql.Int, tarea.salon_id)
      .query(`SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo,
                     et.id AS id_entrega, et.fecha_entrega, et.estado AS estado_entrega,
                     et.calificacion, et.retroalimentacion, et.archivo_url
              FROM Matriculas m
              JOIN Estudiantes e ON m.estudiante_id = e.id
              JOIN Usuarios u ON e.usuario_id = u.id
              LEFT JOIN Entregas_Tareas et ON et.tarea_id = @id_tarea AND et.estudiante_id = e.id
              WHERE m.salon_id = @id_salon AND m.estado = 'activa'
              ORDER BY u.nombre_completo ASC`);

    res.json({ tarea: tarea, entregas: entregasResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las entregas de la tarea.' });
  }
}
async function calificarEntrega(req, res) {
  try {
    const { id } = req.params; // id de la entrega
    const { calificacion, retroalimentacion } = req.body;
    const id_usuario = req.usuario.id_usuario;

    // Si no llega calificación, queda en null (no se cambia la que ya existe)
    const hayNota = calificacion !== undefined && calificacion !== null && calificacion !== '';
    const nota = hayNota ? Number(calificacion) : null;

    if (!hayNota && (retroalimentacion === undefined || retroalimentacion === null)) {
      return res.status(400).json({ mensaje: 'Envía una calificación o una retroalimentación.' });
    }

    if (hayNota && (isNaN(nota) || nota < 0 || nota > 5)) {
      return res.status(400).json({ mensaje: 'La calificación debe ser un número entre 0 y 5.' });
    }

    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }

    const id_docente = docenteResult.recordset[0].id;

    // La entrega debe ser de una tarea de un salón de este docente
    const propiaResult = await pool.request()
      .input('id_entrega', sql.Int, id)
      .input('id_docente', sql.Int, id_docente)
      .query(`SELECT et.id
              FROM Entregas_Tareas et
              JOIN Tareas t ON et.tarea_id = t.id
              JOIN Salones s ON t.salon_id = s.id
              WHERE et.id = @id_entrega AND s.docente_id = @id_docente`);

    if (propiaResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Entrega no encontrada o no te pertenece.' });
    }

    const result = await pool.request()
      .input('id_entrega', sql.Int, id)
      .input('calificacion', sql.Decimal(4, 2), nota)
      .input('retroalimentacion', sql.VarChar, retroalimentacion === undefined ? null : retroalimentacion)
      .query(`UPDATE Entregas_Tareas
              SET calificacion = COALESCE(@calificacion, calificacion),
                  retroalimentacion = COALESCE(@retroalimentacion, retroalimentacion),
                  estado = CASE WHEN @calificacion IS NOT NULL THEN 'calificada' ELSE estado END
              OUTPUT INSERTED.id, INSERTED.calificacion, INSERTED.retroalimentacion, INSERTED.estado
              WHERE id = @id_entrega`);

    res.json({ mensaje: 'Entrega actualizada correctamente.', entrega: result.recordset[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al calificar la entrega.' });
  }
}
// Borra un archivo del disco sin romper nada si ya no existe
function borrarArchivo(ruta) {
  if (!ruta) return;
  fs.unlink(ruta, function (err) {
    if (err) console.error('No se pudo borrar el archivo:', err.message);
  });
}

async function crearMaterial(req, res) {
  const rutaArchivo = req.file ? req.file.path : null;

  try {
    // 1. ¿Llegó el archivo?
    if (!req.file) {
      return res.status(400).json({ mensaje: 'Debes adjuntar un archivo en el campo "archivo".' });
    }

    // 2. Campos de texto (llegan como texto, hay que convertirlos)
    const { titulo, salon_id, ciclo_id } = req.body || {};
    const id_salon = parseInt(salon_id, 10);
    const id_ciclo = parseInt(ciclo_id, 10);
    const tituloLimpio = titulo ? String(titulo).trim() : '';

    if (!tituloLimpio || isNaN(id_salon) || isNaN(id_ciclo)) {
      borrarArchivo(rutaArchivo);
      return res.status(400).json({ mensaje: 'titulo, salon_id y ciclo_id son obligatorios.' });
    }
    if (tituloLimpio.length > 150) {
      borrarArchivo(rutaArchivo);
      return res.status(400).json({ mensaje: 'El título no puede superar los 150 caracteres.' });
    }

    const pool = await getPool();

    // 3. Perfil de docente
    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, req.usuario.id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }
    const id_docente = docenteResult.recordset[0].id;

    // 4. El salón debe ser de este docente
    const salonResult = await pool.request()
      .input('id_salon', sql.Int, id_salon)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id FROM Salones WHERE id = @id_salon AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    // 5. El ciclo debe pertenecer a ese salón
    const cicloResult = await pool.request()
      .input('id_ciclo', sql.Int, id_ciclo)
      .input('id_salon', sql.Int, id_salon)
      .query('SELECT id FROM Ciclos WHERE id = @id_ciclo AND salon_id = @id_salon');

    if (cicloResult.recordset.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'Ciclo no encontrado en este salón.' });
    }

    // 6. Guardar. El tipo sale de la extensión del archivo (pdf, docx, mp3...)
    const tipo = req.file.filename.split('.').pop();

    const result = await pool.request()
      .input('salon_id', sql.Int, id_salon)
      .input('ciclo_id', sql.Int, id_ciclo)
      .input('titulo', sql.VarChar, tituloLimpio)
      .input('tipo', sql.VarChar, tipo)
      .input('archivo_url', sql.VarChar, req.file.filename)
      .query(`INSERT INTO Material_Apoyo (salon_id, ciclo_id, titulo, tipo, archivo_url, publico, subido_en)
              OUTPUT INSERTED.id, INSERTED.salon_id, INSERTED.ciclo_id, INSERTED.titulo,
                     INSERTED.tipo, INSERTED.publico, INSERTED.subido_en
              VALUES (@salon_id, @ciclo_id, @titulo, @tipo, @archivo_url, 1, GETDATE())`);

    res.status(201).json({ mensaje: 'Material subido correctamente.', material: result.recordset[0] });

  } catch (err) {
    console.error(err);
    borrarArchivo(rutaArchivo);
    res.status(500).json({ mensaje: 'Error al subir el material.' });
  }
}
async function obtenerMaterialSalon(req, res) {
  try {
    const id_salon = parseInt(req.params.id, 10);
    if (isNaN(id_salon)) {
      return res.status(400).json({ mensaje: 'Id de salón inválido.' });
    }

    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, req.usuario.id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }
    const id_docente = docenteResult.recordset[0].id;

    // El salón debe ser de este docente
    const salonResult = await pool.request()
      .input('id_salon', sql.Int, id_salon)
      .input('id_docente', sql.Int, id_docente)
      .query('SELECT id, nombre FROM Salones WHERE id = @id_salon AND docente_id = @id_docente');

    if (salonResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    const materialResult = await pool.request()
      .input('id_salon', sql.Int, id_salon)
      .query(`SELECT m.id, m.ciclo_id, c.numero_ciclo, m.titulo, m.tipo, m.publico, m.subido_en
              FROM Material_Apoyo m
              JOIN Ciclos c ON m.ciclo_id = c.id
              WHERE m.salon_id = @id_salon
              ORDER BY m.subido_en DESC`);

    res.json({ salon: salonResult.recordset[0], material: materialResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el material.' });
  }
}
async function eliminarMaterial(req, res) {
  try {
    const id_material = parseInt(req.params.id, 10);
    if (isNaN(id_material)) {
      return res.status(400).json({ mensaje: 'Id de material inválido.' });
    }

    const pool = await getPool();

    const docenteResult = await pool.request()
      .input('usuario_id', sql.Int, req.usuario.id_usuario)
      .query('SELECT id FROM Docentes WHERE usuario_id = @usuario_id');

    if (docenteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de docente para este usuario.' });
    }
    const id_docente = docenteResult.recordset[0].id;

    // El material debe pertenecer a un salón de este docente
    const materialResult = await pool.request()
      .input('id_material', sql.Int, id_material)
      .input('id_docente', sql.Int, id_docente)
      .query(`SELECT m.id, m.archivo_url
              FROM Material_Apoyo m
              JOIN Salones s ON m.salon_id = s.id
              WHERE m.id = @id_material AND s.docente_id = @id_docente`);

    if (materialResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'Material no encontrado o no te pertenece.' });
    }

    const archivo = materialResult.recordset[0].archivo_url;

    // 1. Borrar la fila de la base de datos
    await pool.request()
      .input('id_material', sql.Int, id_material)
      .query('DELETE FROM Material_Apoyo WHERE id = @id_material');

    // 2. Borrar el archivo del disco (backend/uploads/material/)
    if (archivo) {
      borrarArchivo(path.join(CARPETA_MATERIAL, path.basename(archivo)));
    }

    res.json({ mensaje: 'Material eliminado correctamente.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar el material.' });
  }
}
module.exports = { obtenerMisSalones, obtenerEstudiantesSalon, obtenerNotasSalon, obtenerTareasSalon, registrarNota, crearTarea, editarTarea, eliminarTarea, obtenerEntregasTarea, calificarEntrega, crearMaterial, obtenerMaterialSalon, eliminarMaterial };