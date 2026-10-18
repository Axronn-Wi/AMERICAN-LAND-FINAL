const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');

// Todo :id de estas rutas debe ser un entero positivo
router.param('id', validarId);
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');
const { obtenerUsuarios, eliminarUsuario, actualizarMatricula, eliminarMatricula, cambiarEstadoUsuario, editarUsuario, obtenerEstudiantes, obtenerDocentes, obtenerHorariosTipo, obtenerNiveles, obtenerSalones, crearSalon, actualizarSalon, eliminarSalon, obtenerMatriculas, crearMatricula, cambiarEstadoMatricula, registrarPago, crearUsuario } = require('../controllers/admin.controller');

router.get('/usuarios', verificarToken, permitirRoles('admin'), obtenerUsuarios);
router.get('/docentes', verificarToken, permitirRoles('admin'), obtenerDocentes);
router.get('/estudiantes', verificarToken, permitirRoles('admin'), obtenerEstudiantes);
router.get('/horarios-tipo', verificarToken, permitirRoles('admin'), obtenerHorariosTipo);
router.get('/niveles', verificarToken, permitirRoles('admin'), obtenerNiveles);
router.put('/usuarios/:id/estado', verificarToken, permitirRoles('admin'), cambiarEstadoUsuario);
router.put('/usuarios/:id', verificarToken, permitirRoles('admin'), editarUsuario);
router.get('/salones', verificarToken, permitirRoles('admin'), obtenerSalones);
router.post('/salones', verificarToken, permitirRoles('admin'), crearSalon);
router.put('/salones/:id', verificarToken, permitirRoles('admin'), actualizarSalon);
router.delete('/salones/:id', verificarToken, permitirRoles('admin'), eliminarSalon);
router.get('/matriculas', verificarToken, permitirRoles('admin'), obtenerMatriculas);
router.post('/matriculas', verificarToken, permitirRoles('admin'), crearMatricula);
router.put('/matriculas/:id/estado', verificarToken, permitirRoles('admin'), cambiarEstadoMatricula);
router.post('/pagos', verificarToken, permitirRoles('admin'), registrarPago);
router.post('/usuarios', verificarToken, permitirRoles('admin'), crearUsuario);
router.delete('/usuarios/:id', verificarToken, permitirRoles('admin'), eliminarUsuario);
router.put('/matriculas/:id', verificarToken, permitirRoles('admin'), actualizarMatricula);
router.delete('/matriculas/:id', verificarToken, permitirRoles('admin'), eliminarMatricula);

module.exports = router;