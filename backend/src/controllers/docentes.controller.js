const path = require('path');
const db = require('../config/db');
const pool = db.pool || db;
const { sqlHora, sqlFecha } = require('../utils/sql');
const { CARPETA_MATERIAL } = require('../config/uploads');
const { notificar, usuariosDelSalon } = require('../utils/notificar');
const { eliminarArchivo } = require('../utils/archivos');
const { LARGO, textoOpcional, textoObligatorio } = require('../utils/textos');

// Título, descripción y tipo de una tarea con los largos de la base de datos
function leerTextosTarea(body) {
  const titulo = textoObligatorio(body.titulo, LARGO.titulo, 'El título');
  const descripcion = textoOpcional(body.descripcion, LARGO.descripcionTarea, 'La descripción');
  const tipo = textoOpcional(body.tipo, LARGO.tipoTarea, 'El tipo');
  const conError = [titulo, descripcion, tipo].find((c) => c.error);
  if (conError) return { error: conError.error };
  return { titulo: titulo.valor, descripcion: descripcion.valor, tipo: tipo.valor };
}

// Avisa a todos los estudiantes activos del salón (sin bloquear la respuesta)
function notificarSalon(idSalon, datos) {
  usuariosDelSalon(idSalon)
    .then((ids) => notificar(ids, datos))
    .catch((err) => console.error('No se pudo notificar al salón:', err.message));
}

// Usuario (tabla usuarios) de un estudiante
async function usuarioDeEstudiante(idEstudiante) {
  const r = await pool.query('SELECT usuario_id FROM estudiantes WHERE id = $1', [idEstudiante]);
  return r.rows.length > 0 ? r.rows[0].usuario_id : null;
}

const MENSAJE_SIN_PERFIL = 'No se encontró un perfil de docente para este usuario.';
const MENSAJE_SIN_SALON = 'Salón no encontrado o no te pertenece.';

async function obtenerIdDocente(idUsuario) {
  const resultado = await pool.query('SELECT id FROM docentes WHERE usuario_id = $1', [idUsuario]);
  return resultado.rows.length > 0 ? resultado.rows[0].id : null;
}

// Devuelve { id, nombre } del salón si es de este docente, o null
async function obtenerSalonDelDocente(idSalon, idDocente) {
  const resultado = await pool.query(
    'SELECT id, nombre FROM salones WHERE id = $1 AND docente_id = $2',
    [idSalon, idDocente]
  );
  return resultado.rows.length > 0 ? resultado.rows[0] : null;
}

async function obtenerMisSalones(req, res) {
  try {
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const salonesResult = await pool.query(
      `SELECT s.id, s.nombre, s.estado, s.ciclo_actual, n.nombre AS nivel,
              ht.dias_semana,
              ${sqlHora('ht.hora_inicio')} AS hora_inicio,
              ${sqlHora('ht.hora_fin')} AS hora_fin,
              (SELECT COUNT(*)::int FROM matriculas m
               WHERE m.salon_id = s.id AND m.estado = 'activa') AS total_estudiantes
       FROM salones s
       JOIN niveles n ON s.nivel_id = n.id
       JOIN horarios_tipo ht ON s.horario_tipo_id = ht.id
       WHERE s.docente_id = $1
       ORDER BY s.nombre ASC`,
      [id_docente]
    );

    res.json({ salones: salonesResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los salones del docente.' });
  }
}

async function obtenerEstudiantesSalon(req, res) {
  try {
    const { id } = req.params;
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const salon = await obtenerSalonDelDocente(id, id_docente);
    if (!salon) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    const estudiantesResult = await pool.query(
      `SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo, u.correo
       FROM matriculas m
       JOIN estudiantes e ON m.estudiante_id = e.id
       JOIN usuarios u ON e.usuario_id = u.id
       WHERE m.salon_id = $1 AND m.estado = 'activa'
       ORDER BY u.nombre_completo ASC`,
      [id]
    );

    res.json({ salon: salon.nombre, estudiantes: estudiantesResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener los estudiantes del salón.' });
  }
}

async function obtenerNotasSalon(req, res) {
  try {
    const { id } = req.params;
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const salon = await obtenerSalonDelDocente(id, id_docente);
    if (!salon) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    // Ciclos del salón
    const ciclosResult = await pool.query(
      `SELECT id, numero_ciclo
       FROM ciclos
       WHERE salon_id = $1
       ORDER BY numero_ciclo ASC`,
      [id]
    );

    // Estudiantes con matrícula activa
    const estudiantesResult = await pool.query(
      `SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo
       FROM matriculas m
       JOIN estudiantes e ON m.estudiante_id = e.id
       JOIN usuarios u ON e.usuario_id = u.id
       WHERE m.salon_id = $1 AND m.estado = 'activa'
       ORDER BY u.nombre_completo ASC`,
      [id]
    );

    // Todas las notas registradas en este salón
    const notasResult = await pool.query(
      `SELECT estudiante_id, ciclo_id,
              nota_ciclo::float8 AS nota_ciclo,
              nota_examen_final::float8 AS nota_examen_final,
              promedio::float8 AS promedio,
              estado
       FROM notas
       WHERE salon_id = $1`,
      [id]
    );

    res.json({
      salon: salon.nombre,
      ciclos: ciclosResult.rows,
      estudiantes: estudiantesResult.rows,
      notas: notasResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las notas del salón.' });
  }
}

async function obtenerTareasSalon(req, res) {
  try {
    const { id } = req.params;
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const salon = await obtenerSalonDelDocente(id, id_docente);
    if (!salon) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    const tareasResult = await pool.query(
      `SELECT t.id, t.ciclo_id, c.numero_ciclo, t.titulo, t.descripcion,
              ${sqlFecha('t.fecha_limite')} AS fecha_limite,
              t.valor_porcentaje::float8 AS valor_porcentaje, t.tipo, t.archivo_nombre,
              (SELECT COUNT(*)::int FROM matriculas m
               WHERE m.salon_id = t.salon_id AND m.estado = 'activa') AS total_estudiantes,
              (SELECT COUNT(*)::int FROM entregas_tareas et
               WHERE et.tarea_id = t.id) AS total_entregas
       FROM tareas t
       JOIN ciclos c ON t.ciclo_id = c.id
       WHERE t.salon_id = $1
       ORDER BY t.fecha_limite DESC`,
      [id]
    );

    res.json({ salon: salon.nombre, tareas: tareasResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las tareas del salón.' });
  }
}

async function registrarNota(req, res) {
  try {
    const { estudiante_id, salon_id, ciclo_id, nota_ciclo, nota_examen_final } = req.body;

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

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // 1. El salón debe ser de este docente
    const salon = await obtenerSalonDelDocente(salon_id, id_docente);
    if (!salon) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    // 2. El ciclo debe pertenecer a ese salón
    const cicloResult = await pool.query(
      'SELECT id FROM ciclos WHERE id = $1 AND salon_id = $2',
      [ciclo_id, salon_id]
    );
    if (cicloResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Ciclo no encontrado en este salón.' });
    }

    // 3. El estudiante debe estar matriculado (activo) en ese salón
    const matriculaResult = await pool.query(
      `SELECT id FROM matriculas
       WHERE estudiante_id = $1 AND salon_id = $2 AND estado = 'activa'`,
      [estudiante_id, salon_id]
    );
    if (matriculaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'El estudiante no está matriculado en este salón.' });
    }

    // ¿Ya existe una nota para este estudiante en este ciclo?
    // (::float8 para recibir número y no texto)
    const existente = await pool.query(
      `SELECT id, nota_ciclo::float8 AS nota_ciclo, nota_examen_final::float8 AS nota_examen_final
       FROM notas
       WHERE estudiante_id = $1 AND ciclo_id = $2 AND salon_id = $3`,
      [estudiante_id, ciclo_id, salon_id]
    );

    let notaCiclo = nota_ciclo ?? null;
    let notaFinal = nota_examen_final ?? null;

    if (existente.rows.length > 0) {
      const previa = existente.rows[0];
      notaCiclo = nota_ciclo ?? previa.nota_ciclo;
      notaFinal = nota_examen_final ?? previa.nota_examen_final;
    }

    const valores = [notaCiclo, notaFinal].filter(n => n !== null);
    const promedio = Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
    const estado = promedio >= 3.0 ? 'aprobado' : 'reprobado';

    const columnasNota = `id, estudiante_id, ciclo_id, salon_id,
                          nota_ciclo::float8 AS nota_ciclo,
                          nota_examen_final::float8 AS nota_examen_final,
                          promedio::float8 AS promedio, estado, actualizado_en`;

    let result;
    if (existente.rows.length > 0) {
      result = await pool.query(
        `UPDATE notas
         SET nota_ciclo = $1, nota_examen_final = $2,
             promedio = $3, estado = $4, actualizado_en = CURRENT_TIMESTAMP
         WHERE estudiante_id = $5 AND ciclo_id = $6 AND salon_id = $7
         RETURNING ${columnasNota}`,
        [notaCiclo, notaFinal, promedio, estado, estudiante_id, ciclo_id, salon_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO notas
           (estudiante_id, ciclo_id, salon_id, nota_ciclo, nota_examen_final, promedio, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${columnasNota}`,
        [estudiante_id, ciclo_id, salon_id, notaCiclo, notaFinal, promedio, estado]
      );
    }

    usuarioDeEstudiante(estudiante_id).then((idUsuario) => notificar([idUsuario], {
      tipo: 'nota',
      titulo: 'Nueva calificación',
      mensaje: `Tu docente registró tu nota en "${salon.nombre}". Promedio del ciclo: ${promedio.toFixed(1)}.`,
      enlace: '/alumnos/notas.html'
    })).catch(() => {});

    res.status(existente.rows.length > 0 ? 200 : 201).json({
      mensaje: 'Nota registrada correctamente.',
      nota: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al registrar la nota.' });
  }
}

async function crearTarea(req, res) {
  try {
    const { salon_id, ciclo_id, fecha_limite, valor_porcentaje } = req.body;

    if (!salon_id || !ciclo_id || !req.body.titulo || !fecha_limite) {
      return res.status(400).json({ mensaje: 'salon_id, ciclo_id, titulo y fecha_limite son obligatorios.' });
    }
    const textos = leerTextosTarea(req.body);
    if (textos.error) {
      return res.status(400).json({ mensaje: textos.error });
    }
    const { titulo, descripcion, tipo } = textos;

    if (isNaN(Date.parse(fecha_limite))) {
      return res.status(400).json({ mensaje: 'fecha_limite no es una fecha válida (usa el formato AAAA-MM-DD).' });
    }

    const porcentaje = valor_porcentaje ?? 0;
    if (typeof porcentaje !== 'number' || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ mensaje: 'valor_porcentaje debe ser un número entre 0 y 100.' });
    }

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // 1. El salón debe ser de este docente
    const salon = await obtenerSalonDelDocente(salon_id, id_docente);
    if (!salon) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    // 2. El ciclo debe pertenecer a ese salón
    const cicloResult = await pool.query(
      'SELECT id FROM ciclos WHERE id = $1 AND salon_id = $2',
      [ciclo_id, salon_id]
    );
    if (cicloResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Ciclo no encontrado en este salón.' });
    }

    const result = await pool.query(
      `INSERT INTO tareas (salon_id, ciclo_id, titulo, descripcion, fecha_limite, valor_porcentaje, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, salon_id, ciclo_id, titulo, descripcion,
                 ${sqlFecha('fecha_limite')} AS fecha_limite,
                 valor_porcentaje::float8 AS valor_porcentaje, tipo`,
      [salon_id, ciclo_id, titulo, descripcion || null, fecha_limite, porcentaje, tipo || null]
    );

    notificarSalon(salon_id, {
      tipo: 'tarea',
      titulo: 'Nueva tarea',
      mensaje: `"${titulo}" en ${salon.nombre}. Fecha límite: ${String(fecha_limite).slice(0, 10)}.`,
      enlace: '/alumnos/tareas.html'
    });

    res.status(201).json({ mensaje: 'Tarea creada exitosamente.', tarea: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear la tarea.' });
  }
}

async function editarTarea(req, res) {
  try {
    const { id } = req.params;
    const { fecha_limite, valor_porcentaje } = req.body;

    if (!req.body.titulo || !fecha_limite) {
      return res.status(400).json({ mensaje: 'titulo y fecha_limite son obligatorios.' });
    }
    const textos = leerTextosTarea(req.body);
    if (textos.error) {
      return res.status(400).json({ mensaje: textos.error });
    }
    const { titulo, descripcion, tipo } = textos;

    if (isNaN(Date.parse(fecha_limite))) {
      return res.status(400).json({ mensaje: 'fecha_limite no es una fecha válida (usa el formato AAAA-MM-DD).' });
    }

    const porcentaje = valor_porcentaje ?? 0;
    if (typeof porcentaje !== 'number' || porcentaje < 0 || porcentaje > 100) {
      return res.status(400).json({ mensaje: 'valor_porcentaje debe ser un número entre 0 y 100.' });
    }

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // La tarea debe pertenecer a un salón de este docente
    const tareaResult = await pool.query(
      `SELECT t.id
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       WHERE t.id = $1 AND s.docente_id = $2`,
      [id, id_docente]
    );
    if (tareaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    const result = await pool.query(
      `UPDATE tareas
       SET titulo = $1, descripcion = $2, fecha_limite = $3,
           valor_porcentaje = $4, tipo = $5
       WHERE id = $6
       RETURNING id, salon_id, ciclo_id, titulo, descripcion,
                 ${sqlFecha('fecha_limite')} AS fecha_limite,
                 valor_porcentaje::float8 AS valor_porcentaje, tipo`,
      [titulo, descripcion || null, fecha_limite, porcentaje, tipo || null, id]
    );

    res.json({ mensaje: 'Tarea actualizada correctamente.', tarea: result.rows[0] });

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

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // La tarea debe pertenecer a un salón de este docente
    const tareaResult = await pool.query(
      `SELECT t.id, t.archivo_url
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       WHERE t.id = $1 AND s.docente_id = $2`,
      [id_tarea, id_docente]
    );
    if (tareaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    // Si ya tiene entregas de estudiantes, no se borra
    const entregasResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM entregas_tareas WHERE tarea_id = $1',
      [id_tarea]
    );
    if (entregasResult.rows[0].total > 0) {
      return res.status(409).json({ mensaje: 'No puedes eliminar esta tarea porque ya tiene entregas de estudiantes.' });
    }

    await pool.query('DELETE FROM tareas WHERE id = $1', [id_tarea]);
    if (tareaResult.rows[0].archivo_url) {
      borrarArchivo(path.join(CARPETA_MATERIAL, path.basename(tareaResult.rows[0].archivo_url)));
    }

    res.json({ mensaje: 'Tarea eliminada correctamente.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al eliminar la tarea.' });
  }
}

async function obtenerEntregasTarea(req, res) {
  try {
    const { id } = req.params; // id de la tarea
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // La tarea debe pertenecer a un salón de este docente
    const tareaResult = await pool.query(
      `SELECT t.id, t.salon_id, t.titulo,
              ${sqlFecha('t.fecha_limite')} AS fecha_limite,
              t.valor_porcentaje::float8 AS valor_porcentaje
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       WHERE t.id = $1 AND s.docente_id = $2`,
      [id, id_docente]
    );
    if (tareaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    const tarea = tareaResult.rows[0];

    // Todos los alumnos activos del salón, con su entrega si existe
    const entregasResult = await pool.query(
      `SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo,
              et.id AS id_entrega, et.fecha_entrega, et.estado AS estado_entrega,
              et.calificacion::float8 AS calificacion, et.retroalimentacion, et.archivo_url,
              et.comentario
       FROM matriculas m
       JOIN estudiantes e ON m.estudiante_id = e.id
       JOIN usuarios u ON e.usuario_id = u.id
       LEFT JOIN entregas_tareas et ON et.tarea_id = $1 AND et.estudiante_id = e.id
       WHERE m.salon_id = $2 AND m.estado = 'activa'
       ORDER BY u.nombre_completo ASC`,
      [id, tarea.salon_id]
    );

    res.json({ tarea: tarea, entregas: entregasResult.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener las entregas de la tarea.' });
  }
}

async function calificarEntrega(req, res) {
  try {
    const { id } = req.params; // id de la entrega
    const { calificacion, retroalimentacion } = req.body;

    // Si no llega calificación, queda en null (no se cambia la que ya existe)
    const hayNota = calificacion !== undefined && calificacion !== null && calificacion !== '';
    const nota = hayNota ? Number(calificacion) : null;

    if (!hayNota && (retroalimentacion === undefined || retroalimentacion === null)) {
      return res.status(400).json({ mensaje: 'Envía una calificación o una retroalimentación.' });
    }

    if (hayNota && (isNaN(nota) || nota < 0 || nota > 5)) {
      return res.status(400).json({ mensaje: 'La calificación debe ser un número entre 0 y 5.' });
    }
    if (retroalimentacion !== undefined && retroalimentacion !== null &&
        String(retroalimentacion).length > LARGO.retroalimentacion) {
      return res.status(400).json({ mensaje: `La retroalimentación no puede superar los ${LARGO.retroalimentacion} caracteres.` });
    }

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // La entrega debe ser de una tarea de un salón de este docente
    const propiaResult = await pool.query(
      `SELECT et.id, et.estudiante_id, t.titulo
       FROM entregas_tareas et
       JOIN tareas t ON et.tarea_id = t.id
       JOIN salones s ON t.salon_id = s.id
       WHERE et.id = $1 AND s.docente_id = $2`,
      [id, id_docente]
    );
    if (propiaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Entrega no encontrada o no te pertenece.' });
    }

    const result = await pool.query(
      `UPDATE entregas_tareas
       SET calificacion = COALESCE($1::numeric, calificacion),
           retroalimentacion = COALESCE($2::text, retroalimentacion),
           estado = CASE WHEN $1::numeric IS NOT NULL THEN 'calificada' ELSE estado END
       WHERE id = $3
       RETURNING id, calificacion::float8 AS calificacion, retroalimentacion, estado`,
      [nota, retroalimentacion === undefined ? null : retroalimentacion, id]
    );

    const propia = propiaResult.rows[0];
    usuarioDeEstudiante(propia.estudiante_id).then((idUsuario) => notificar([idUsuario], {
      tipo: 'calificacion',
      titulo: hayNota ? 'Tarea calificada' : 'Comentario en tu tarea',
      mensaje: hayNota
        ? `Tu entrega de "${propia.titulo}" recibió ${nota.toFixed(1)}.`
        : `Tu docente dejó un comentario en "${propia.titulo}".`,
      enlace: '/alumnos/tareas.html'
    })).catch(() => {});

    res.json({ mensaje: 'Entrega actualizada correctamente.', entrega: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al calificar la entrega.' });
  }
}

// Borra un archivo subido (base de datos o disco antiguo) sin romper nada si ya no existe
function borrarArchivo(ruta) {
  eliminarArchivo(ruta, CARPETA_MATERIAL);
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

    // 3. Perfil de docente
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // 4. El salón debe ser de este docente
    const salon = await obtenerSalonDelDocente(id_salon, id_docente);
    if (!salon) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    // 5. El ciclo debe pertenecer a ese salón
    const cicloResult = await pool.query(
      'SELECT id FROM ciclos WHERE id = $1 AND salon_id = $2',
      [id_ciclo, id_salon]
    );
    if (cicloResult.rows.length === 0) {
      borrarArchivo(rutaArchivo);
      return res.status(404).json({ mensaje: 'Ciclo no encontrado en este salón.' });
    }

    // 6. Guardar. El tipo sale de la extensión del archivo (pdf, docx, mp3...)
    const tipo = req.file.filename.split('.').pop();

    const result = await pool.query(
      `INSERT INTO material_apoyo (salon_id, ciclo_id, titulo, tipo, archivo_url, publico, subido_en)
       VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
       RETURNING id, salon_id, ciclo_id, titulo, tipo, publico, subido_en`,
      [id_salon, id_ciclo, tituloLimpio, tipo, req.file.filename]
    );

    notificarSalon(id_salon, {
      tipo: 'material',
      titulo: 'Nuevo material de apoyo',
      mensaje: `"${tituloLimpio}" ya está disponible en ${salon.nombre}.`,
      enlace: '/alumnos/salon_virtual.html'
    });

    res.status(201).json({ mensaje: 'Material subido correctamente.', material: result.rows[0] });

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

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // El salón debe ser de este docente
    const salon = await obtenerSalonDelDocente(id_salon, id_docente);
    if (!salon) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_SALON });
    }

    const materialResult = await pool.query(
      `SELECT m.id, m.ciclo_id, c.numero_ciclo, m.titulo, m.tipo, m.publico, m.subido_en
       FROM material_apoyo m
       JOIN ciclos c ON m.ciclo_id = c.id
       WHERE m.salon_id = $1
       ORDER BY m.subido_en DESC`,
      [id_salon]
    );

    res.json({ salon: salon, material: materialResult.rows });

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

    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    // El material debe pertenecer a un salón de este docente
    const materialResult = await pool.query(
      `SELECT m.id, m.archivo_url
       FROM material_apoyo m
       JOIN salones s ON m.salon_id = s.id
       WHERE m.id = $1 AND s.docente_id = $2`,
      [id_material, id_docente]
    );
    if (materialResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Material no encontrado o no te pertenece.' });
    }

    const archivo = materialResult.rows[0].archivo_url;

    // 1. Borrar la fila de la base de datos
    await pool.query('DELETE FROM material_apoyo WHERE id = $1', [id_material]);

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

// ---------------------------------------------------------------
// POST /api/docentes/tareas/:id/archivo  (campo "archivo": guía o taller de la tarea)
// Reemplaza el archivo anterior si ya tenía uno.
// ---------------------------------------------------------------
async function subirArchivoTarea(req, res) {
  if (!req.file) {
    return res.status(400).json({ mensaje: 'Selecciona un archivo.' });
  }
  const rutaNueva = req.file.path;
  try {
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      borrarArchivo(rutaNueva);
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }

    const tareaResult = await pool.query(
      `SELECT t.id, t.archivo_url
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       WHERE t.id = $1 AND s.docente_id = $2`,
      [req.params.id, id_docente]
    );
    if (tareaResult.rows.length === 0) {
      borrarArchivo(rutaNueva);
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }

    // multer entrega el nombre original en latin1: se pasa a UTF-8 para conservar tildes y ñ
    const nombreOriginal = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
      .replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(-200);

    await pool.query(
      'UPDATE tareas SET archivo_url = $1, archivo_nombre = $2 WHERE id = $3',
      [req.file.filename, nombreOriginal, req.params.id]
    );
    const anterior = tareaResult.rows[0].archivo_url;
    if (anterior) borrarArchivo(path.join(CARPETA_MATERIAL, path.basename(anterior)));

    res.json({ mensaje: 'Archivo adjuntado a la tarea.', archivo_nombre: nombreOriginal });
  } catch (err) {
    console.error(err);
    borrarArchivo(rutaNueva);
    res.status(500).json({ mensaje: 'Error al adjuntar el archivo.' });
  }
}

// ---------------------------------------------------------------
// DELETE /api/docentes/tareas/:id/archivo
// ---------------------------------------------------------------
async function quitarArchivoTarea(req, res) {
  try {
    const id_docente = await obtenerIdDocente(req.usuario.id_usuario);
    if (id_docente === null) {
      return res.status(404).json({ mensaje: MENSAJE_SIN_PERFIL });
    }
    const tareaResult = await pool.query(
      `SELECT t.id, t.archivo_url
       FROM tareas t
       JOIN salones s ON t.salon_id = s.id
       WHERE t.id = $1 AND s.docente_id = $2`,
      [req.params.id, id_docente]
    );
    if (tareaResult.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada o no te pertenece.' });
    }
    await pool.query('UPDATE tareas SET archivo_url = NULL, archivo_nombre = NULL WHERE id = $1', [req.params.id]);
    const anterior = tareaResult.rows[0].archivo_url;
    if (anterior) borrarArchivo(path.join(CARPETA_MATERIAL, path.basename(anterior)));
    res.json({ mensaje: 'Archivo quitado de la tarea.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al quitar el archivo.' });
  }
}

module.exports = { obtenerMisSalones, obtenerEstudiantesSalon, obtenerNotasSalon, obtenerTareasSalon, registrarNota, crearTarea, editarTarea, eliminarTarea, subirArchivoTarea, quitarArchivoTarea, obtenerEntregasTarea, calificarEntrega, crearMaterial, obtenerMaterialSalon, eliminarMaterial };