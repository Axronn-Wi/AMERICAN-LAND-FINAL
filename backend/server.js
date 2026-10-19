const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Sin JWT_SECRET no se pueden firmar ni verificar sesiones: mejor no arrancar
if (!process.env.JWT_SECRET) {
  console.error('❌ Falta la variable JWT_SECRET en el archivo .env');
  process.exit(1);
}

const db = require('./src/config/db');
const { aplicarMigraciones } = require('./src/config/migraciones');
const authRoutes = require('./src/routes/auth.routes');
const alumnosRoutes = require('./src/routes/alumnos.routes');
const adminRoutes = require('./src/routes/admin.routes');
const docentesRoutes = require('./src/routes/docentes.routes');
const admisionesRoutes = require('./src/routes/admisiones.routes');
const entregasRoutes = require('./src/routes/entregas.routes');
const materialRoutes = require('./src/routes/material.routes');
const tareasRoutes = require('./src/routes/tareas.routes');
const comunicacionesRoutes = require('./src/routes/comunicaciones.routes');
const anunciosRoutes = require('./src/routes/anuncios.routes');
const contactoRoutes = require('./src/routes/contacto.routes');
const perfilRoutes = require('./src/routes/perfil.routes');
const muroRoutes = require('./src/routes/muro.routes');

const app = express();

// Render está detrás de un proxy: así la IP real llega al limitador de intentos
app.set('trust proxy', 1);

// Cabeceras de seguridad (el CSP queda apagado porque las páginas usan fuentes externas)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: si existe CORS_ORIGIN (lista separada por comas) solo se aceptan esos dominios
const origenesPermitidos = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(function (o) { return o.trim(); })
  : null;
app.use(cors(origenesPermitidos ? { origin: origenesPermitidos } : undefined));

app.use(express.json({ limit: '100kb' }));

// Máximo 20 intentos de login/registro cada 15 minutos por IP (frena ataques de fuerza bruta)
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' }
});

// Límite general de la API: 600 peticiones cada 5 minutos por IP
const limiteApi = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones. Espera un momento y vuelve a intentarlo.' }
});
app.use('/api', limiteApi);

app.use('/api/auth', limiteAuth, authRoutes);
app.use('/api/alumnos', alumnosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/docentes', docentesRoutes);
app.use('/api/admisiones', admisionesRoutes);
app.use('/api/entregas', entregasRoutes);
app.use('/api/material', materialRoutes);
app.use('/api/tareas', tareasRoutes);
app.use('/api/comunicaciones', comunicacionesRoutes);
app.use('/api/anuncios', anunciosRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/muro', muroRoutes);

// Estado del servidor y de la base de datos
app.get('/api/status', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ estado: 'ok', base_de_datos: 'conectada' });
  } catch (err) {
    console.error('Error en /api/status:', err.message);
    res.status(503).json({ estado: 'error', base_de_datos: 'sin conexión' });
  }
});

// Cualquier otra ruta de la API que no exista responde JSON, no HTML
app.use('/api', (req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada.' });
});

// Bloquea el acceso público al código y a los archivos subidos del backend
app.use('/backend', (req, res) => {
  res.status(404).json({ mensaje: 'No encontrado.' });
});

// Sirve el frontend (HTML, CSS, JS) desde la carpeta raíz del proyecto
app.use(express.static(path.join(__dirname, '..'), { dotfiles: 'deny' }));

// Manejador final de errores: nunca expone detalles internos al cliente
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'La petición es demasiado grande.' });
  }
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

// Deja la base al día en cada despliegue. Si una migración falla se registra
// y el servidor arranca igual: /api/status sigue respondiendo.
async function migrarAlIniciar() {
  if (process.env.MIGRAR_AL_INICIAR === 'false') {
    console.log('ℹ️ Migraciones automáticas desactivadas (MIGRAR_AL_INICIAR=false)');
    return;
  }
  try {
    const { aplicadas, total } = await aplicarMigraciones(db.pool);
    if (aplicadas.length) {
      console.log(`✅ Migraciones aplicadas: ${aplicadas.join(', ')}`);
    } else {
      console.log(`✅ Base de datos al día (${total} migraciones ya aplicadas)`);
    }
  } catch (err) {
    console.error('❌ Falló la migración', err.message);
  }
}

const PORT = process.env.PORT || 4000;
migrarAlIniciar().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
});
