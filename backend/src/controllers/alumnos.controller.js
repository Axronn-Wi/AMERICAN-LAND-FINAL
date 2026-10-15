const fs = require('fs');
const db = require('../config/db');
const pool = db.pool || db;

const MENSAJE_SIN_PERFIL = 'No se encontró un perfil de estudiante para este usuario.';

// ---------------------------------------------------------------
// Formatos que el frontend ya espera (los mismos que daba SQL Server)
// ---------------------------------------------------------------
// Hora 18:00:00  ->  "1970-01-01T18:00:00.000Z"
function sqlHora(columna) {
  return `('1970-01-01T' || left(${columna}::text, 8) || '.000Z')`;
}

// Fecha 2026-11-30  ->  "2026-11-30T00:00:00.000Z"
function sqlFecha(columna) {
  return `(to_char(${columna}, 'YYYY-MM-DD') || 'T00:00:00.000Z')`;
}

// Día y minutos actuales en Colombia (el servidor de Render trabaja en UTC)
function ahoraEnBogota() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const valor = function (tipo) { return partes.find(function (p) { return p.type === tipo; }).value; };
  const dias = { Sun: 'Dom', Mon: 'Lun', Tue: 'Mar', Wed: 'Mie', Thu: 'Jue', Fri: 'Vie', Sat: 'Sab' };

  return {
    dia: dias[valor('weekday')],
    minutos: Number(valor('hour')) * 60 + Number(valor('minute'))
  };
}

// Fecha de hoy en Colombia, formato AAAA-MM-DD
function hoyEnBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

// "18:00" -> 1080 (minutos desde la medianoche)
function aMinutos(textoHora) {
  const partes = textoHora.split(':').map(Number);
  return partes[0] * 60 + partes[1];
}

// Busca el id de la tabla estudiantes a partir del usuario logueado
async function obtenerIdEstudiante(idUsuario) {
  const resultado = await pool.query('SELECT id FROM estudiantes WHERE usuario_id = $1', [idUsuario]);
  return resultado.rows.length > 0 ? resultado.rows[0].id : null;
}

// ---------------------------------------------------------------
// GET /api/alumnos/horario
// ---------------------------------------------------------------
async function obtenerMiHorario(req, res) {
  try {
    const id_estudiante = await obtenerIdEstudiante(req.usuario.id_usuario);

    if (id_estudiante === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // Horario de los salones donde está matriculado
    const horarioResult = await pool.query(
      `SELECT s.nombre AS salon, ht.dias_semana,
              ${sqlHora('ht.hora_inicio')} AS hora_inicio,
              ${sqlHora('ht.hora_fin')} AS hora_fin,
              n.nombre AS nivel,
              u.nombre_completo AS docente
       FROM matriculas m
       JOIN salones s ON m.salon_id = s.id
       JOIN horarios_tipo ht ON s.horario_tipo_id = ht.id
       JOIN niveles n ON s.nivel_id = n.id
       JOIN docentes d ON s.docente_id = d.id
       JOIN usuarios u ON d.usuario_id = u.id
       WHERE m.estudiante_id = $1 AND m.estado = 'activa'`,
      [id_estudiante]
    );

    res.json({ horario: horarioResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el horario.' });
  }
}

// ---------------------------------------------------------------
// GET /api/alumnos/notas
// ---------------------------------------------------------------
async function obtenerMisNotas(req, res) {
  try {
    const id_estudiante = await obtenerIdEstudiante(req.usuario.id_usuario);

    if (id_estudiante === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const notasResult = await pool.query(
      `SELECT s.nombre AS salon, c.numero_ciclo,
              n.nota_ciclo::float8 AS nota_ciclo,
              n.nota_examen_final::float8 AS nota_examen_final,
              n.promedio::float8 AS promedio,
              n.estado
       FROM notas n
       JOIN salones s ON n.salon_id = s.id
       JOIN ciclos c ON n.ciclo_id = c.id
       WHERE n.estudiante_id = $1
       ORDER BY c.numero_ciclo ASC`,
      [id_estudiante]
    );

    res.json({ notas: notasResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las notas.' });
  }
}

// ---------------------------------------------------------------
// GET /api/alumnos/tareas
// ---------------------------------------------------------------
async function obtenerMisTareas(req, res) {
  try {
    const id_estudiante = await obtenerIdEstudiante(req.usuario.id_usuario);

    if (id_estudiante === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const tareasResult = await pool.query(
      `SELECT t.id, t.titulo, t.descripcion,
              ${sqlFecha('t.fecha_limite')} AS fecha_limite,
              t.tipo,
              t.valor_porcentaje::float8 AS valor_porcentaje,
              e.id AS id_entrega, e.fecha_entrega, e.estado AS estado_entrega,
              e.calificacion::float8 AS calificacion
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       JOIN matriculas m ON m.salon_id = s.id
       LEFT JOIN entregas_tareas e ON e.tarea_id = t.id AND e.estudiante_id = $1
       WHERE m.estudiante_id = $1 AND m.estado = 'activa'
       ORDER BY t.fecha_limite ASC`,
      [id_estudiante]
    );

    res.json({ tareas: tareasResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las tareas.' });
  }
}

// ---------------------------------------------------------------
// GET /api/alumnos/salon-virtual
// ---------------------------------------------------------------
async function obtenerSalonVirtual(req, res) {
  try {
    const id_estudiante = await obtenerIdEstudiante(req.usuario.id_usuario);

    if (id_estudiante === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // Datos del salón + docente + horario
    const salonResult = await pool.query(
      `SELECT s.id AS id_salon, s.nombre AS salon, n.nombre AS nivel,
              u.nombre_completo AS docente,
              ht.dias_semana,
              left(ht.hora_inicio::text, 5) AS hora_inicio,
              left(ht.hora_fin::text, 5) AS hora_fin
       FROM matriculas m
       JOIN salones s ON m.salon_id = s.id
       JOIN niveles n ON s.nivel_id = n.id
       JOIN docentes d ON s.docente_id = d.id
       JOIN usuarios u ON d.usuario_id = u.id
       JOIN horarios_tipo ht ON s.horario_tipo_id = ht.id
       WHERE m.estudiante_id = $1 AND m.estado = 'activa'`,
      [id_estudiante]
    );

    if (salonResult.rows.length === 0) {
      return res.json({ salon: null, companeros: [] });
    }

    const salonData = salonResult.rows[0];

    // El salón está "activo" si ahora (hora de Colombia) es día y hora de clase
    const ahora = ahoraEnBogota();
    const diaCoincide = salonData.dias_semana.split(',').map(function (d) { return d.trim(); }).includes(ahora.dia);
    const enHorario = ahora.minutos >= aMinutos(salonData.hora_inicio) && ahora.minutos <= aMinutos(salonData.hora_fin);
    const estadoSalon = (diaCoincide && enHorario) ? 'activo' : 'inactivo';

    // Compañeros del mismo salón (excluyendo al propio estudiante)
    const companerosResult = await pool.query(
      `SELECT u.nombre_completo
       FROM matriculas m
       JOIN estudiantes e ON m.estudiante_id = e.id
       JOIN usuarios u ON e.usuario_id = u.id
       WHERE m.salon_id = $1 AND m.estado = 'activa' AND e.id <> $2`,
      [salonData.id_salon, id_estudiante]
    );

    res.json({
      salon: {
        nombre: salonData.salon,
        nivel: salonData.nivel,
        docente: salonData.docente,
        estado: estadoSalon
      },
      companeros: companerosResult.rows.map(function (c) { return c.nombre_completo; })
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

// ---------------------------------------------------------------
// POST /api/alumnos/tareas/:id/entrega
// ---------------------------------------------------------------
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

    // 3. Perfil de estudiante
    const id_estudiante = await obtenerIdEstudiante(req.usuario.id_usuario);

    if (id_estudiante === null) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // 4. La tarea debe ser de un salón donde tenga matrícula activa
    const tareaResult = await pool.query(
      `SELECT t.id, to_char(t.fecha_limite, 'YYYY-MM-DD') AS fecha_limite
       FROM tareas t
       JOIN matriculas m ON m.salon_id = t.salon_id
       WHERE t.id = $1
         AND m.estudiante_id = $2
         AND m.estado = 'activa'`,
      [id_tarea, id_estudiante]
    );

    if (tareaResult.rows.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'Tarea no encontrada.' });
    }
    const tarea = tareaResult.rows[0];

    // 5. No debe existir una entrega previa
    const previaResult = await pool.query(
      'SELECT id FROM entregas_tareas WHERE tarea_id = $1 AND estudiante_id = $2',
      [id_tarea, id_estudiante]
    );

    if (previaResult.rows.length > 0) {
      borrarArchivo(rutaArchivo);
      return res.status(409).json({ mensaje: 'Ya entregaste esta tarea.' });
    }

    // 6. La fecha límite no debe haber pasado (el último día aún se puede entregar)
    if (tarea.fecha_limite < hoyEnBogota()) {
      borrarArchivo(rutaArchivo);
      return res.status(409).json({ mensaje: 'La fecha límite de esta tarea ya venció.' });
    }

    // 7. Guardar la entrega
    const insertResult = await pool.query(
      `INSERT INTO entregas_tareas (tarea_id, estudiante_id, fecha_entrega, estado, archivo_url)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 'entregada', $3)
       RETURNING id`,
      [id_tarea, id_estudiante, req.file.filename]
    );

    res.status(201).json({
      mensaje: 'Tarea entregada correctamente.',
      id_entrega: insertResult.rows[0].id
    });

  } catch (err) {
    console.error(err);
    borrarArchivo(rutaArchivo);
    res.status(500).json({ mensaje: 'Error al entregar la tarea.' });
  }
}

// ---------------------------------------------------------------
// GET /api/alumnos/material
// ---------------------------------------------------------------
async function obtenerMiMaterial(req, res) {
  try {
    const id_estudiante = await obtenerIdEstudiante(req.usuario.id_usuario);

    if (id_estudiante === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // Solo material visible (publico = TRUE) de salones con matrícula activa
    const materialResult = await pool.query(
      `SELECT m.id, s.nombre AS salon, c.numero_ciclo, m.titulo, m.tipo, m.subido_en
       FROM material_apoyo m
       JOIN salones s ON m.salon_id = s.id
       JOIN ciclos c ON m.ciclo_id = c.id
       JOIN matriculas ma ON ma.salon_id = s.id
       WHERE ma.estudiante_id = $1
         AND ma.estado = 'activa'
         AND m.publico = TRUE
       ORDER BY m.subido_en DESC`,
      [id_estudiante]
    );

    res.json({ material: materialResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el material de apoyo.' });
  }
}

module.exports = { obtenerMiHorario, obtenerMisNotas, obtenerMisTareas, obtenerSalonVirtual, entregarTarea, obtenerMiMaterial };