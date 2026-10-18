// Aplica los archivos de backend/sql en orden alfabético, cada uno en su transacción.
// Los ya aplicados quedan en la tabla migraciones_aplicadas y no se vuelven a ejecutar.
// Todos los .sql son idempotentes, así que en bases donde se corrieron a mano
// se ejecutan una vez más sin cambios y quedan registrados.
const fs = require('fs');
const path = require('path');

const CARPETA_SQL = path.join(__dirname, '..', '..', 'sql');

// Número arbitrario para el candado: evita que dos instancias migren a la vez
const CANDADO_MIGRACIONES = 724519;

async function aplicarMigraciones(pool) {
  const archivos = fs.readdirSync(CARPETA_SQL).filter((f) => f.endsWith('.sql')).sort();
  const aplicadas = [];
  const cliente = await pool.connect();
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [CANDADO_MIGRACIONES]);
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
        nombre      VARCHAR(255) PRIMARY KEY,
        aplicada_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    const { rows } = await cliente.query('SELECT nombre FROM migraciones_aplicadas');
    const yaAplicadas = new Set(rows.map((r) => r.nombre));

    for (const archivo of archivos) {
      if (yaAplicadas.has(archivo)) continue;
      const sql = fs.readFileSync(path.join(CARPETA_SQL, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
        aplicadas.push(archivo);
      } catch (err) {
        await cliente.query('ROLLBACK');
        err.message = `${archivo}: ${err.message}`;
        err.archivo = archivo;
        throw err;
      }
    }
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [CANDADO_MIGRACIONES]).catch(() => {});
    cliente.release();
  }
  return { aplicadas, total: archivos.length };
}

module.exports = { aplicarMigraciones };
