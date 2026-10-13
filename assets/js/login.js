/* ============================================================
   login.js — Funcionalidad de la página de inicio de sesión
   Instituto American Land
============================================================ */

const form       = document.getElementById('form-login');
const btnSubmit  = document.getElementById('btn-submit');
const alerta     = document.getElementById('alerta-global');
const inputPass  = document.getElementById('contrasena');
const togglePass = document.getElementById('toggle-pass');

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : 'https://american-land-backend.onrender.com/api';

// ── VOLVER A LA INSCRIPCIÓN ────────────────────────────────
// inscripcion.html manda a login.html?volver=inscripcion. Solo se aceptan
// destinos de esta lista (así nadie puede redirigir a un sitio externo).
const DESTINOS_VOLVER = { inscripcion: '../admisiones/inscripcion.html' };
const volver = new URLSearchParams(window.location.search).get('volver');
const volverValido = Object.prototype.hasOwnProperty.call(DESTINOS_VOLVER, volver);

if (volverValido) {
  // Quien viene a inscribirse es estudiante: dejamos el rol ya elegido
  document.getElementById('rol').value = 'estudiante';
  // Si aún no tiene cuenta, el enlace a registro conserva el "volver"
  const enlaceRegistro = document.querySelector('a[href="registro.html"]');
  if (enlaceRegistro) enlaceRegistro.href = 'registro.html?volver=' + volver;
}

// Función aparte para poder probar la redirección
function redirigir(url) {
  window.location.href = url;
}

// 1. MOSTRAR / OCULTAR CONTRASEÑA
togglePass.addEventListener('click', function () {
  const esPassword = inputPass.type === 'password';
  inputPass.type   = esPassword ? 'text' : 'password';
  togglePass.textContent = esPassword ? '🙈' : '👁️';
});

// 2. FUNCIÓN REUTILIZABLE DE VALIDACIÓN
function validarCampo(input, errorId, condicion, mensaje) {
  const msgError = document.getElementById(errorId);
  if (!condicion) {
    input.classList.add('invalido');
    msgError.textContent = mensaje;
    msgError.classList.add('visible');
    return false;
  } else {
    input.classList.remove('invalido');
    msgError.classList.remove('visible');
    return true;
  }
}

// 3. VALIDACIÓN EN TIEMPO REAL (al salir de cada campo)
document.getElementById('correo').addEventListener('blur', function () {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  validarCampo(this, 'error-correo', regex.test(this.value), 'Ingresa un correo electrónico válido.');
});

inputPass.addEventListener('blur', function () {
  validarCampo(this, 'error-contrasena', this.value.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');
});

document.getElementById('rol').addEventListener('change', function () {
  validarCampo(this, 'error-rol', this.value !== '', 'Selecciona un rol para continuar.');
});

// 4. VALIDACIÓN Y ENVÍO DEL FORMULARIO
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const correo     = document.getElementById('correo');
  const contrasena = document.getElementById('contrasena');
  const rol        = document.getElementById('rol');
  const regex      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const v1 = validarCampo(correo,     'error-correo',     regex.test(correo.value),      'Ingresa un correo electrónico válido.');
  const v2 = validarCampo(contrasena, 'error-contrasena', contrasena.value.length >= 6,  'La contraseña debe tener al menos 6 caracteres.');
  const v3 = validarCampo(rol,        'error-rol',        rol.value !== '',              'Selecciona un rol para continuar.');

  if (!v1 || !v2 || !v3) return;

  // Estado cargando
  btnSubmit.classList.add('cargando');
  btnSubmit.textContent = 'Verificando...';

  try {
    const respuesta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: correo.value,
        contrasena: contrasena.value,
        rol: rol.value
      })
    });

    const datos = await respuesta.json();

    btnSubmit.classList.remove('cargando');
    btnSubmit.textContent = 'Iniciar Sesión';

    if (!respuesta.ok) {
      alerta.textContent = datos.mensaje || 'Correo o contraseña incorrectos.';
      alerta.className   = 'alerta error visible';
      return;
    }

    // Guardar token y datos reales del usuario
    sessionStorage.setItem('token',  datos.token);
    sessionStorage.setItem('rol',    datos.usuario.rol);
    sessionStorage.setItem('nombre', datos.usuario.nombre_completo);
    sessionStorage.setItem('correo', datos.usuario.correo);

    // Mostrar éxito
    alerta.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
    alerta.className   = 'alerta exito visible';

    // Redirigir según rol
    setTimeout(function () {
      const destinos = {
        estudiante: '../alumnos/inicio.html',
        docente:    '../docentes/inicio.html',
        admin:      '../admin/inicio.html'
      };
      let destino = destinos[rol.value] || '../index.html';
      // Si venía de la inscripción, el estudiante regresa a continuar
      if (volverValido && rol.value === 'estudiante') destino = DESTINOS_VOLVER[volver];
      redirigir(destino);
    }, 1500);

  } catch (error) {
    btnSubmit.classList.remove('cargando');
    btnSubmit.textContent = 'Iniciar Sesión';
    alerta.textContent = 'No se pudo conectar con el servidor. Verifica tu conexión.';
    alerta.className   = 'alerta error visible';
  }
});