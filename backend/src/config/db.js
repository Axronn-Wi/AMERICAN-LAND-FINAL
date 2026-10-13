const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  connectionTimeout: 60000,   // Azure SQL gratuita puede tardar en despertar de la pausa
  requestTimeout: 30000,
  pool: {
    max: 10,
    min: 0,                   // no mantener conexiones abiertas sin uso
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

let pool;

async function getPool() {
  if (pool) return pool;

  try {
    pool = await sql.connect(config);

    // Si la conexión se cae (pausa o mantenimiento de Azure), se descarta
    // el pool para que la siguiente petición abra una conexión nueva
    pool.on('error', function (err) {
      console.error('⚠️ Se perdió la conexión con la base de datos:', err.message);
      pool = undefined;
    });

    console.log('✅ Conectado a SQL Server:', process.env.DB_DATABASE);
    return pool;
  } catch (err) {
    pool = undefined;
    console.error('❌ Error de conexión a la base de datos:', err.message);
    throw err;
  }
}

module.exports = { sql, getPool };