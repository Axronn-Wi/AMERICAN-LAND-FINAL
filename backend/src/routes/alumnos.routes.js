const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');

// Todo :id de estas rutas debe ser un entero positivo
router.param('id', validarId);
const { obtenerMiHorario, obtenerMisNotas, obtenerMisTareas, obtenerSalonVirtual, entregarTarea, obtenerMiMaterial } = require('../controllers/alumnos.controller');
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');
const { recibirArchivo } = require('../middleware/upload.middleware');
const { obtenerMiAsistencia } = require('../controllers/asistencia.controller');

router.get('/horario', verificarToken, permitirRoles('estudiante'), obtenerMiHorario);
router.get('/notas', verificarToken, permitirRoles('estudiante'), obtenerMisNotas);
router.get('/tareas', verificarToken, permitirRoles('estudiante'), obtenerMisTareas);
router.get('/salon-virtual', verificarToken, permitirRoles('estudiante'), obtenerSalonVirtual);
router.get('/asistencia', verificarToken, permitirRoles('estudiante'), obtenerMiAsistencia);
router.get('/material', verificarToken, permitirRoles('estudiante'), obtenerMiMaterial);
router.post('/tareas/:id/entrega', verificarToken, permitirRoles('estudiante'), recibirArchivo, entregarTarea);

module.exports = router;