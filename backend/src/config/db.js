const { Pool } = require('pg');
require('dotenv').config();

// Se configura la conexión usando la variable DATABASE_URL asignada en Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,                   // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000,   // Tiempo de espera para conexiones inactivas
  connectionTimeoutMillis: 10000
});

pool.on('connect', () => {
  console.log('✅ Conectado a la base de datos PostgreSQL');
});

pool.on('error', (err) => {
  console.error('⚠️ Error inesperado en el cliente de PostgreSQL:', err.message);
});

module.exports = {
  // Exportamos un método query genérico para ejecutar consultas SQL de manera limpia
  query: (text, params) => pool.query(text, params),
  pool
};