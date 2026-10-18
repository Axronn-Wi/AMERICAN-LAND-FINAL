const db = require('../config/db');
const pool = db.pool || db;

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

// Ejecuta fn(cliente) dentro de una transacción: si algo falla, se revierte todo
async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    try { await cliente.query('ROLLBACK'); } catch (_) { /* ya estaba revertida */ }
    throw err;
  } finally {
    cliente.release();
  }
}

// Correo sin espacios y en minúsculas, para comparar siempre igual
function normalizarCorreo(correo) {
  return String(correo || '').trim().toLowerCase();
}

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { sqlHora, sqlFecha, transaccion, normalizarCorreo, REGEX_CORREO };
