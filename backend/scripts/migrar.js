// Aplica las migraciones pendientes de backend/sql (ver src/config/migraciones.js).
// El servidor también lo hace solo al arrancar, salvo con MIGRAR_AL_INICIAR=false.
// Uso: npm run migrar
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../src/config/db');
const { aplicarMigraciones } = require('../src/config/migraciones');

aplicarMigraciones(pool)
  .then(({ aplicadas, total }) => {
    aplicadas.forEach((archivo) => console.log(`✅ ${archivo}`));
    console.log(`Migraciones: ${aplicadas.length} aplicadas, ${total - aplicadas.length} ya estaban al día.`);
  })
  .catch((err) => {
    console.error('❌ Error en la migración:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
