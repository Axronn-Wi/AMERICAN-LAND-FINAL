const fs = require('fs');
const { sql, getPool } = require('../config/db');

async function obtenerMiHorario(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    // Primero: encontrar el id del estudiante a partir del usuario logueado
    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.recordset[0].id;

    // Ahora: traer el horario de los salones donde está matriculado
    const horarioResult = await pool.request()
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT s.nombre AS salon, ht.dias_semana, ht.hora_inicio, ht.hora_fin, n.nombre AS nivel,
               u.nombre_completo AS docente
        FROM Matriculas m
        JOIN Salones s ON m.salon_id = s.id
        JOIN Horarios_Tipo ht ON s.horario_tipo_id = ht.id
        JOIN Niveles n ON s.nivel_id = n.id
        JOIN Docentes d ON s.docente_id = d.id
        JOIN Usuarios u ON d.usuario_id = u.id
        WHERE m.estudiante_id = @id_estudiante AND m.estado = 'activa'`);

    res.json({ horario: horarioResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el horario.' });
  }
}

async function obtenerMisNotas(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.recordset[0].id;

    const notasResult = await pool.request()
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT s.nombre AS salon, c.numero_ciclo, n.nota_ciclo, n.nota_examen_final, n.promedio, n.estado
              FROM Notas n
              JOIN Salones s ON n.salon_id = s.id
              JOIN Ciclos c ON n.ciclo_id = c.id
              WHERE n.estudiante_id = @id_estudiante
              ORDER BY c.numero_ciclo ASC`);

    res.json({ notas: notasResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las notas.' });
  }
}

async function obtenerMisTareas(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.recordset[0].id;

    const tareasResult = await pool.request()
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT t.id, t.titulo, t.descripcion, t.fecha_limite, t.tipo, t.valor_porcentaje,
                     e.id AS id_entrega, e.fecha_entrega, e.estado AS estado_entrega, e.calificacion
              FROM Tareas t
              JOIN Salones s ON t.salon_id = s.id
              JOIN Matriculas m ON m.salon_id = s.id
              LEFT JOIN Entregas_Tareas e ON e.tarea_id = t.id AND e.estudiante_id = @id_estudiante
              WHERE m.estudiante_id = @id_estudiante AND m.estado = 'activa'
              ORDER BY t.fecha_limite ASC`);

    res.json({ tareas: tareasResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las tareas.' });
  }
}

module.exports = { obtenerMiHorario, obtenerMisNotas, obtenerMisTareas };

async function obtenerSalonVirtual(req, res) {
  try {
    const id_usuario = req.usuario.id_usuario;
    const pool = await getPool();

    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }

    const id_estudiante = estudianteResult.recordset[0].id;

    // Datos del salón + docente + horario
    const salonResult = await pool.request()
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT s.id AS id_salon, s.nombre AS salon, n.nombre AS nivel,
                     u.nombre_completo AS docente,
                     ht.dias_semana, ht.hora_inicio, ht.hora_fin
              FROM Matriculas m
              JOIN Salones s ON m.salon_id = s.id
              JOIN Niveles n ON s.nivel_id = n.id
              JOIN Docentes d ON s.docente_id = d.id
              JOIN Usuarios u ON d.usuario_id = u.id
              JOIN Horarios_Tipo ht ON s.horario_tipo_id = ht.id
              WHERE m.estudiante_id = @id_estudiante AND m.estado = 'activa'`);

    if (salonResult.recordset.length === 0) {
      return res.json({ salon: null, companeros: [] });
    }

    const salonData = salonResult.recordset[0];

    // Calcular si el salón está "activo" (en horario de clase) ahora mismo
    const diasAbrev = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const ahora = new Date();
    const diaHoy = diasAbrev[ahora.getDay()];
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

    const [hIni, mIni] = salonData.hora_inicio.toISOString().substring(11, 16).split(':').map(Number);
    const [hFin, mFin] = salonData.hora_fin.toISOString().substring(11, 16).split(':').map(Number);
    const minutosInicio = hIni * 60 + mIni;
    const minutosFin    = hFin * 60 + mFin;

    const diaCoincide = salonData.dias_semana.split(',').map(d => d.trim()).includes(diaHoy);
    const enHorario   = minutosAhora >= minutosInicio && minutosAhora <= minutosFin;
    const estadoSalon = (diaCoincide && enHorario) ? 'activo' : 'inactivo';

    // Compañeros del mismo salón (excluyendo al propio estudiante)
    const companerosResult = await pool.request()
      .input('id_salon', sql.Int, salonData.id_salon)
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT u.nombre_completo
              FROM Matriculas m
              JOIN Estudiantes e ON m.estudiante_id = e.id
              JOIN Usuarios u ON e.usuario_id = u.id
              WHERE m.salon_id = @id_salon AND m.estado = 'activa' AND e.id != @id_estudiante`);

    res.json({
      salon: {
        nombre: salonData.salon,
        nivel: salonData.nivel,
        docente: salonData.docente,
        estado: estadoSalon
      },
      companeros: companerosResult.recordset.map(c => c.nombre_completo)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el salón virtual.' });
  }
}
// Borra un archivo del disco sin romper nada si ya no existe
function borrarArchivo(ruta) {
  if (!ruta) return;
  fs.unlink(ruta, function (err) {
    if (err) console.error('No se pudo borrar el archivo:', err.message);
  });
}

async function entregarTarea(req, res) {
  const rutaArchivo = req.file ? req.file.path : null;

  try {
    // 1. ¿Llegó el archivo?
    if (!req.file) {
      return res.status(400).json({ mensaje: 'Debes adjuntar un archivo en el campo "archivo".' });
    }

    // 2. ¿El id de la tarea es válido?
    const id_tarea = parseInt(req.params.id, 10);
    if (isNaN(id_tarea)) {
      borrarArchivo(rutaArchivo);
      return res.status(400).json({ mensaje: 'Id de tarea inválido.' });
    }

    const pool = await getPool();

    // 3. Perfil de estudiante
    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, req.usuario.id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }
    const id_estudiante = estudianteResult.recordset[0].id;

    // 4. La tarea debe ser de un salón donde tenga matrícula activa
    const tareaResult = await pool.request()
      .input('id_tarea', sql.Int, id_tarea)
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT t.id, t.fecha_limite
              FROM Tareas t
              JOIN Matriculas m ON m.salon_id = t.salon_id
              WHERE t.id = @id_tarea
                AND m.estudiante_id = @id_estudiante
                AND m.estado = 'activa'`);

    if (tareaResult.recordset.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'Tarea no encontrada.' });
    }
    const tarea = tareaResult.recordset[0];

    // 5. No debe existir una entrega previa
    const previaResult = await pool.request()
      .input('id_tarea', sql.Int, id_tarea)
      .input('id_estudiante', sql.Int, id_estudiante)
      .query('SELECT id FROM Entregas_Tareas WHERE tarea_id = @id_tarea AND estudiante_id = @id_estudiante');

    if (previaResult.recordset.length > 0) {
      borrarArchivo(rutaArchivo);
      return res.status(409).json({ mensaje: 'Ya entregaste esta tarea.' });
    }

    // 6. La fecha límite no debe haber pasado (el último día aún se puede entregar)
    const hoy = new Date();
    const hoyTexto = hoy.getFullYear() + '-' +
      String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoy.getDate()).padStart(2, '0');
    const limiteTexto = tarea.fecha_limite.toISOString().substring(0, 10);

    if (limiteTexto < hoyTexto) {
      borrarArchivo(rutaArchivo);
      return res.status(409).json({ mensaje: 'La fecha límite de esta tarea ya venció.' });
    }

    // 7. Guardar la entrega
    const insertResult = await pool.request()
      .input('id_tarea', sql.Int, id_tarea)
      .input('id_estudiante', sql.Int, id_estudiante)
      .input('archivo_url', sql.NVarChar, req.file.filename)
      .query(`INSERT INTO Entregas_Tareas (tarea_id, estudiante_id, fecha_entrega, estado, archivo_url)
              OUTPUT INSERTED.id
              VALUES (@id_tarea, @id_estudiante, GETDATE(), 'entregada', @archivo_url)`);

    res.status(201).json({
      mensaje: 'Tarea entregada correctamente.',
      id_entrega: insertResult.recordset[0].id
    });

  } catch (err) {
    console.error(err);
    borrarArchivo(rutaArchivo);
    res.status(500).json({ mensaje: 'Error al entregar la tarea.' });
  }
}
async function obtenerMiMaterial(req, res) {
  try {
    const pool = await getPool();

    const estudianteResult = await pool.request()
      .input('usuario_id', sql.Int, req.usuario.id_usuario)
      .query('SELECT id FROM Estudiantes WHERE usuario_id = @usuario_id');

    if (estudianteResult.recordset.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }
    const id_estudiante = estudianteResult.recordset[0].id;

    // Solo material visible (publico = 1) de salones con matrícula activa
    const materialResult = await pool.request()
      .input('id_estudiante', sql.Int, id_estudiante)
      .query(`SELECT m.id, s.nombre AS salon, c.numero_ciclo, m.titulo, m.tipo, m.subido_en
              FROM Material_Apoyo m
              JOIN Salones s ON m.salon_id = s.id
              JOIN Ciclos c ON m.ciclo_id = c.id
              JOIN Matriculas ma ON ma.salon_id = s.id
              WHERE ma.estudiante_id = @id_estudiante
                AND ma.estado = 'activa'
                AND m.publico = 1
              ORDER BY m.subido_en DESC`);

    res.json({ material: materialResult.recordset });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el material de apoyo.' });
  }
}
module.exports = { obtenerMiHorario, obtenerMisNotas, obtenerMisTareas, obtenerSalonVirtual, entregarTarea, obtenerMiMaterial };