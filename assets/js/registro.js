/* ============================================================
   registro.js — Funcionalidad de la página de registro
   Instituto American Land
============================================================ */

const form       = document.getElementById('form-registro');
const btnSubmit  = document.getElementById('btn-submit');
const alerta     = document.getElementById('alerta-global');
const inputPass  = document.getElementById('contrasena');
const inputPass2 = document.getElementById('confirmar-contrasena');
const API_URL    = window.location.origin + '/api';

// Si viene desde la inscripción (registro.html?volver=inscripcion), se pasa
// ese dato al login para que luego regrese a continuar. Solo se aceptan
// valores conocidos.
const DESTINOS_VOLVER = ['inscripcion'];
const volverParam = new URLSearchParams(window.location.search).get('volver');
const sufijoVolver = DESTINOS_VOLVER.includes(volverParam) ? '?volver=' + volverParam : '';

const enlaceLogin = document.querySelector('a[href="login.html"]');
if (enlaceLogin) enlaceLogin.href = 'login.html' + sufijoVolver;

// Función aparte para poder probar la redirección
function redirigir(url) {
  window.location.href = url;
}

// ── 1. MOSTRAR / OCULTAR CONTRASEÑA ────────────────────────
document.getElementById('toggle-pass').addEventListener('click', function () {
  const es       = inputPass.type === 'password';
  inputPass.type = es ? 'text' : 'password';
  this.textContent = es ? '🙈' : '👁️';
});

document.getElementById('toggle-pass-2').addEventListener('click', function () {
  const es        = inputPass2.type === 'password';
  inputPass2.type = es ? 'text' : 'password';
  this.textContent = es ? '🙈' : '👁️';
});

// ── 2. FUNCIÓN REUTILIZABLE DE VALIDACIÓN ──────────────────
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

// ── 3. VALIDACIÓN EN TIEMPO REAL (blur) ────────────────────
document.getElementById('nombre').addEventListener('blur', function () {
  validarCampo(this, 'error-nombre',
    this.value.trim().length >= 3,
    'El nombre debe tener al menos 3 caracteres.');
});

document.getElementById('correo').addEventListener('blur', function () {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  validarCampo(this, 'error-correo',
    regex.test(this.value.trim()),
    'Ingresa un correo electrónico válido.');
});

inputPass.addEventListener('blur', function () {
  validarCampo(this, 'error-contrasena',
    this.value.length >= 6,
    'La contraseña debe tener al menos 6 caracteres.');
});

inputPass2.addEventListener('blur', function () {
  validarCampo(this, 'error-confirmar',
    this.value === inputPass.value && this.value !== '',
    'Las contraseñas no coinciden.');
});

document.getElementById('telefono').addEventListener('blur', function () {
  const regex = /^[0-9+\s\-]{7,15}$/;
  validarCampo(this, 'error-telefono',
    regex.test(this.value.trim()),
    'Ingresa un número de teléfono válido (mínimo 7 dígitos).');
});

document.getElementById('fecha-nacimiento').addEventListener('blur', function () {
  validarCampo(this, 'error-fecha',
    this.value !== '',
    'La fecha de nacimiento es obligatoria.');
});

document.getElementById('pais').addEventListener('blur', function () {
  validarCampo(this, 'error-pais',
    this.value.trim().length >= 2,
    'El país es obligatorio.');
});

document.getElementById('ciudad').addEventListener('blur', function () {
  validarCampo(this, 'error-ciudad',
    this.value.trim().length >= 2,
    'La ciudad es obligatoria.');
});

// ── 4. VALIDACIÓN COMPLETA AL ENVIAR ───────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  alerta.className = 'alerta';

  const nombre    = document.getElementById('nombre');
  const correo    = document.getElementById('correo');
  const contrasena= document.getElementById('contrasena');
  const confirmar = document.getElementById('confirmar-contrasena');
  const telefono  = document.getElementById('telefono');
  const fecha     = document.getElementById('fecha-nacimiento');
  const pais      = document.getElementById('pais');
  const ciudad    = document.getElementById('ciudad');

  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const regexTel   = /^[0-9+\s\-]{7,15}$/;

  const v1 = validarCampo(nombre,    'error-nombre',    nombre.value.trim().length >= 3,              'El nombre debe tener al menos 3 caracteres.');
  const v2 = validarCampo(correo,    'error-correo',    regexEmail.test(correo.value.trim()),         'Ingresa un correo electrónico válido.');
  const v3 = validarCampo(contrasena,'error-contrasena',contrasena.value.length >= 6,                 'La contraseña debe tener al menos 6 caracteres.');
  const v4 = validarCampo(confirmar, 'error-confirmar', confirmar.value === contrasena.value && confirmar.value !== '', 'Las contraseñas no coinciden.');
  const v5 = validarCampo(telefono,  'error-telefono',  regexTel.test(telefono.value.trim()),         'Ingresa un número de teléfono válido.');
  const v6 = validarCampo(fecha,     'error-fecha',     fecha.value !== '',                           'La fecha de nacimiento es obligatoria.');
  const v7 = validarCampo(pais,      'error-pais',      pais.value.trim().length >= 2,                'El país es obligatorio.');
  const v8 = validarCampo(ciudad,    'error-ciudad',    ciudad.value.trim().length >= 2,              'La ciudad es obligatoria.');

  // Si algún campo falla, detener y mostrar error general
  if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6 || !v7 || !v8) {
    alerta.textContent = 'Por favor completa todos los campos obligatorios.';
    alerta.className   = 'alerta error visible';
    // Scroll al primer campo con error
    const primerError = document.querySelector('.invalido');
    if (primerError) primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

   // Estado cargando
  btnSubmit.classList.add('cargando');
  btnSubmit.textContent = 'Registrando...';

  try {
    const respuesta = await fetch(`${API_URL}/auth/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_completo: nombre.value.trim(),
        correo: correo.value.trim(),
        contrasena: contrasena.value,
        rol: 'estudiante',
        telefono: telefono.value.trim(),
        fecha_nacimiento: fecha.value,
        pais: pais.value.trim(),
        ciudad: ciudad.value.trim()
      })
    });

    const datos = await respuesta.json();

    btnSubmit.classList.remove('cargando');
    btnSubmit.textContent = 'Registrarse';

    if (!respuesta.ok) {
      alerta.textContent = datos.mensaje || 'No se pudo completar el registro.';
      alerta.className   = 'alerta error visible';
      return;
    }

    alerta.textContent = '¡Cuenta creada exitosamente! Redirigiendo al login...';
    alerta.className   = 'alerta exito visible';

    setTimeout(function () {
      redirigir('login.html' + sufijoVolver);
    }, 2000);

  } catch (error) {
    btnSubmit.classList.remove('cargando');
    btnSubmit.textContent = 'Registrarse';
    alerta.textContent = 'No se pudo conectar con el servidor. Verifica tu conexión.';
    alerta.className   = 'alerta error visible';
  }
});