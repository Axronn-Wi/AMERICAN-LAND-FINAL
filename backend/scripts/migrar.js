// Ejecuta los archivos de backend/sql en orden alfabético, cada uno en su transacción.
// Todos están escritos para poder ejecutarse varias veces sin duplicar datos.
// Uso: npm run migrar
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../src/config/db');

const CARPETA_SQL = path.join(__dirname, '..', 'sql');

async function migrar() {
  const archivos = fs.readdirSync(CARPETA_SQL).filter((f) => f.endsWith('.sql')).sort();
  const cliente = await pool.connect();
  try {
    for (const archivo of archivos) {
      const sql = fs.readFileSync(path.join(CARPETA_SQL, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('COMMIT');
        console.log(`✅ ${archivo}`);
      } catch (err) {
        await cliente.query('ROLLBACK');
        throw new Error(`${archivo}: ${err.message}`);
      }
    }
  } finally {
    cliente.release();
    await pool.end();
  }
}

migrar().catch((err) => {
  console.error('❌ Error en la migración:', err.message);
  process.exit(1);
});
