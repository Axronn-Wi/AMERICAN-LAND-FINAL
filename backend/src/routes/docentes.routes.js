const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');

// Todo :id de estas rutas debe ser un entero positivo
router.param('id', validarId);
const { obtenerMisSalones, obtenerEstudiantesSalon, obtenerEntregasTarea, calificarEntrega, obtenerNotasSalon, obtenerTareasSalon, registrarNota, crearTarea, editarTarea, eliminarTarea, crearMaterial, obtenerMaterialSalon, eliminarMaterial } = require('../controllers/docentes.controller');
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');
const { recibirMaterial } = require('../middleware/material.middleware');

router.get('/salones', verificarToken, permitirRoles('docente'), obtenerMisSalones);
router.get('/salones/:id/estudiantes', verificarToken, permitirRoles('docente'), obtenerEstudiantesSalon);
router.get('/salones/:id/notas', verificarToken, permitirRoles('docente'), obtenerNotasSalon);
router.get('/salones/:id/material', verificarToken, permitirRoles('docente'), obtenerMaterialSalon);
router.get('/tareas/:id/entregas', verificarToken, permitirRoles('docente'), obtenerEntregasTarea);
router.get('/salones/:id/tareas', verificarToken, permitirRoles('docente'), obtenerTareasSalon);
router.put('/entregas/:id', verificarToken, permitirRoles('docente'), calificarEntrega);
router.post('/notas', verificarToken, permitirRoles('docente'), registrarNota);
router.post('/tareas', verificarToken, permitirRoles('docente'), crearTarea);
router.put('/tareas/:id', verificarToken, permitirRoles('docente'), editarTarea);
router.delete('/tareas/:id', verificarToken, permitirRoles('docente'), eliminarTarea);
router.post('/material', verificarToken, permitirRoles('docente'), recibirMaterial, crearMaterial);
router.delete('/material/:id', verificarToken, permitirRoles('docente'), eliminarMaterial);

module.exports = router;