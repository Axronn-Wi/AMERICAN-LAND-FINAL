const db = require('../config/db');
const pool = db.pool || db;
const { sqlFecha, transaccion } = require('../utils/sql');
const { notificar } = require('../utils/notificar');

const ESTADOS = ['presente', 'ausente', 'tarde', 'excusa'];
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Porcentaje de asistencia: (presente + tarde) / (total - excusas).
// Las excusas no cuentan en contra; si todo son excusas no hay porcentaje.
const SQL_PORCENTAJE = `
  CASE WHEN COUNT(*) FILTER (WHERE a.estado <> 'excusa') = 0 THEN NULL
       ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE a.estado IN ('presente', 'tarde'))
                  / COUNT(*) FILTER (WHERE a.estado <> 'excusa'), 1)::float8
  END`;

// Fecha de hoy en Colombia, formato AAAA-MM-DD
function hoyEnBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function fechaValida(texto) {
  return REGEX_FECHA.test(texto) && !Number.isNaN(Date.parse(texto + 'T00:00:00Z'));
}

async function salonDelDocente(idSalon, idUsuario) {
  const r = await pool.query(
    `SELECT s.id, s.nombre FROM salones s JOIN docentes d ON d.id = s.docente_id
     WHERE s.id = $1 AND d.usuario_id = $2`,
    [idSalon, idUsuario]
  );
  return r.rows[0] || null;
}

// ---------------------------------------------------------------
// GET /api/docentes/salones/:id/asistencia?fecha=AAAA-MM-DD
// Lista del día: estudiantes activos con el estado guardado (o null)
// ---------------------------------------------------------------
async function obtenerListaAsistencia(req, res) {
  try {
    const fecha = req.query.fecha || hoyEnBogota();
    if (!fechaValida(fecha)) {
      return res.status(400).json({ mensaje: 'La fecha no es válida (usa AAAA-MM-DD).' });
    }

    const salon = await salonDelDocente(req.params.id, req.usuario.id_usuario);
    if (!salon) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    const lista = await pool.query(
      `SELECT e.id AS id_estudiante, e.codigo_estudiante, u.nombre_completo,
              a.estado, a.observacion
       FROM matriculas m
       JOIN estudiantes e ON e.id = m.estudiante_id
       JOIN usuarios u ON u.id = e.usuario_id
       LEFT JOIN asistencias a ON a.estudiante_id = e.id AND a.salon_id = m.salon_id AND a.fecha = $2
       WHERE m.salon_id = $1 AND m.estado = 'activa'
       ORDER BY u.nombre_completo ASC`,
      [salon.id, fecha]
    );

    // Resumen por estudiante de todo el curso
    const resumen = await pool.query(
      `SELECT a.estudiante_id AS id_estudiante,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.estado = 'presente')::int AS presentes,
              COUNT(*) FILTER (WHERE a.estado = 'ausente')::int AS ausentes,
              COUNT(*) FILTER (WHERE a.estado = 'tarde')::int AS tardes,
              COUNT(*) FILTER (WHERE a.estado = 'excusa')::int AS excusas,
              ${SQL_PORCENTAJE} AS porcentaje
       FROM asistencias a
       WHERE a.salon_id = $1
       GROUP BY a.estudiante_id`,
      [salon.id]
    );

    const fechas = await pool.query(
      `SELECT DISTINCT to_char(fecha, 'YYYY-MM-DD') AS fecha
       FROM asistencias WHERE salon_id = $1 ORDER BY 1 DESC LIMIT 60`,
      [salon.id]
    );

    res.json({
      salon,
      fecha,
      hoy: hoyEnBogota(),
      estudiantes: lista.rows,
      resumen: resumen.rows,
      fechas_registradas: fechas.rows.map((f) => f.fecha)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener la asistencia.' });
  }
}

// ---------------------------------------------------------------
// PUT /api/docentes/salones/:id/asistencia
// { fecha, registros: [{ estudiante_id, estado, observacion }] }
// Guarda (o corrige) la lista completa del día en una transacción
// ---------------------------------------------------------------
async function guardarAsistencia(req, res) {
  try {
    const { fecha, registros } = req.body || {};

    if (!fechaValida(fecha)) {
      return res.status(400).json({ mensaje: 'La fecha no es válida (usa AAAA-MM-DD).' });
    }
    if (fecha > hoyEnBogota()) {
      return res.status(400).json({ mensaje: 'No puedes registrar asistencia de una fecha futura.' });
    }
    if (!Array.isArray(registros) || registros.length === 0 || registros.length > 200) {
      return res.status(400).json({ mensaje: 'Envía la lista de estudiantes con su estado.' });
    }
    for (const r of registros) {
      if (!Number.isInteger(r.estudiante_id) || !ESTADOS.includes(r.estado)) {
        return res.status(400).json({ mensaje: 'Cada registro necesita estudiante_id y un estado válido (presente, ausente, tarde o excusa).' });
      }
      if (r.observacion !== undefined && r.observacion !== null && String(r.observacion).length > 250) {
        return res.status(400).json({ mensaje: 'La observación no puede superar los 250 caracteres.' });
      }
    }

    const salon = await salonDelDocente(req.params.id, req.usuario.id_usuario);
    if (!salon) {
      return res.status(404).json({ mensaje: 'Salón no encontrado o no te pertenece.' });
    }

    const resultado = await transaccion(async (cliente) => {
      // Solo estudiantes con matrícula activa en este salón
      const ids = registros.map((r) => r.estudiante_id);
      const validos = await cliente.query(
        `SELECT m.estudiante_id, e.usuario_id FROM matriculas m JOIN estudiantes e ON e.id = m.estudiante_id
         WHERE m.salon_id = $1 AND m.estado = 'activa' AND m.estudiante_id = ANY($2::int[])`,
        [salon.id, ids]
      );
      const usuarioDe = new Map(validos.rows.map((v) => [v.estudiante_id, v.usuario_id]));
      if (usuarioDe.size !== new Set(ids).size) {
        return { status: 400, cuerpo: { mensaje: 'Hay estudiantes que no están matriculados en este salón.' } };
      }

      // Estados previos, para avisar solo de las ausencias nuevas
      const previos = await cliente.query(
        'SELECT estudiante_id, estado FROM asistencias WHERE salon_id = $1 AND fecha = $2',
        [salon.id, fecha]
      );
      const estadoPrevio = new Map(previos.rows.map((p) => [p.estudiante_id, p.estado]));

      for (const r of registros) {
        await cliente.query(
          `INSERT INTO asistencias (estudiante_id, salon_id, fecha, estado, observacion)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (estudiante_id, salon_id, fecha)
           DO UPDATE SET estado = EXCLUDED.estado, observacion = EXCLUDED.observacion,
                         registrado_en = CURRENT_TIMESTAMP`,
          [r.estudiante_id, salon.id, fecha, r.estado, r.observacion ? String(r.observacion).trim() || null : null]
        );
      }

      const ausentesNuevos = registros
        .filter((r) => r.estado === 'ausente' && estadoPrevio.get(r.estudiante_id) !== 'ausente')
        .map((r) => usuarioDe.get(r.estudiante_id));

      return {
        status: 200,
        ausentesNuevos,
        cuerpo: { mensaje: `Asistencia del ${fecha} guardada (${registros.length} estudiantes).` }
      };
    });

    if (resultado.ausentesNuevos && resultado.ausentesNuevos.length > 0) {
      notificar(resultado.ausentesNuevos, {
        tipo: 'asistencia',
        titulo: 'Inasistencia registrada',
        mensaje: `Tu docente registró una inasistencia el ${fecha} en ${salon.nombre}. Si fue un error, escríbele por el chat.`,
        enlace: '/alumnos/notas.html'
      });
    }

    res.status(resultado.status).json(resultado.cuerpo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al guardar la asistencia.' });
  }
}

// ---------------------------------------------------------------
// GET /api/alumnos/asistencia
// ---------------------------------------------------------------
async function obtenerMiAsistencia(req, res) {
  try {
    const est = await pool.query('SELECT id FROM estudiantes WHERE usuario_id = $1', [req.usuario.id_usuario]);
    if (est.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró un perfil de estudiante para este usuario.' });
    }
    const idEstudiante = est.rows[0].id;

    const resumen = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.estado = 'presente')::int AS presentes,
              COUNT(*) FILTER (WHERE a.estado = 'ausente')::int AS ausentes,
              COUNT(*) FILTER (WHERE a.estado = 'tarde')::int AS tardes,
              COUNT(*) FILTER (WHERE a.estado = 'excusa')::int AS excusas,
              ${SQL_PORCENTAJE} AS porcentaje
       FROM asistencias a WHERE a.estudiante_id = $1`,
      [idEstudiante]
    );

    const registros = await pool.query(
      `SELECT ${sqlFecha('a.fecha')} AS fecha, a.estado, a.observacion, s.nombre AS salon
       FROM asistencias a JOIN salones s ON s.id = a.salon_id
       WHERE a.estudiante_id = $1
       ORDER BY a.fecha DESC LIMIT 120`,
      [idEstudiante]
    );

    res.json({ resumen: resumen.rows[0], registros: registros.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener tu asistencia.' });
  }
}

// ---------------------------------------------------------------
// GET /api/admin/asistencia  (resumen por salón)
// ---------------------------------------------------------------
async function resumenAsistenciaSalones(req, res) {
  try {
    const r = await pool.query(
      `SELECT s.id AS salon_id, s.nombre AS salon,
              COUNT(a.id)::int AS total,
              COUNT(DISTINCT a.fecha)::int AS clases,
              COUNT(*) FILTER (WHERE a.estado = 'ausente')::int AS ausentes,
              ${SQL_PORCENTAJE.replace(/COUNT\(\*\)/g, 'COUNT(a.id)')} AS porcentaje
       FROM salones s
       LEFT JOIN asistencias a ON a.salon_id = s.id
       GROUP BY s.id, s.nombre
       ORDER BY s.nombre ASC`
    );
    res.json({ salones: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener el resumen de asistencia.' });
  }
}

module.exports = { obtenerListaAsistencia, guardarAsistencia, obtenerMiAsistencia, resumenAsistenciaSalones };
