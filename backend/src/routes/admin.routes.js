const express = require('express');
const router = express.Router();
const { validarId } = require('../middleware/validar.middleware');
const { verificarToken, permitirRoles } = require('../middleware/auth.middleware');
const {
  obtenerPersonal, obtenerUsuarios, eliminarUsuario, actualizarMatricula, eliminarMatricula, cambiarEstadoUsuario,
  editarUsuario, obtenerEstudiantes, obtenerDocentes, obtenerHorariosTipo, obtenerNiveles, obtenerSalones,
  crearSalon, actualizarSalon, eliminarSalon, obtenerMatriculas, crearMatricula, cambiarEstadoMatricula,
  registrarPago, crearUsuario
} = require('../controllers/admin.controller');
const { resumenAsistenciaSalones } = require('../controllers/asistencia.controller');

// Todo :id de estas rutas debe ser un entero positivo
router.param('id', validarId);
router.use(verificarToken);

// admin: todo el panel. secretaria: estudiantes, matrículas y pagos (sin borrar nada).
// Los controladores además impiden que la secretaría toque cuentas que no sean de estudiantes.
const soloAdmin = permitirRoles('admin');
const administracion = permitirRoles('admin', 'secretaria');

// Consultas
router.get('/usuarios', administracion, obtenerUsuarios);
router.get('/docentes', administracion, obtenerDocentes);
router.get('/estudiantes', administracion, obtenerEstudiantes);
router.get('/horarios-tipo', administracion, obtenerHorariosTipo);
router.get('/niveles', administracion, obtenerNiveles);
router.get('/salones', administracion, obtenerSalones);
router.get('/matriculas', administracion, obtenerMatriculas);
router.get('/asistencia', administracion, resumenAsistenciaSalones);
router.get('/personal', soloAdmin, obtenerPersonal);

// Usuarios
router.post('/usuarios', administracion, crearUsuario);
router.put('/usuarios/:id', administracion, editarUsuario);
router.put('/usuarios/:id/estado', administracion, cambiarEstadoUsuario);
router.delete('/usuarios/:id', soloAdmin, eliminarUsuario);

// Salones
router.post('/salones', soloAdmin, crearSalon);
router.put('/salones/:id', soloAdmin, actualizarSalon);
router.delete('/salones/:id', soloAdmin, eliminarSalon);

// Matrículas y pagos
router.post('/matriculas', administracion, crearMatricula);
router.put('/matriculas/:id', administracion, actualizarMatricula);
router.put('/matriculas/:id/estado', administracion, cambiarEstadoMatricula);
router.delete('/matriculas/:id', soloAdmin, eliminarMatricula);
router.post('/pagos', administracion, registrarPago);

module.exports = router;
