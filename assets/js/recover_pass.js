/* ============================================================
   recover_pass.js — Instituto American Land
   Recuperar la contraseña con un código de 6 dígitos:
     1. POST /auth/recuperar   { correo }                     -> el código llega al correo
     2. POST /auth/restablecer { correo, codigo, contrasena } -> nueva contraseña
   El botón del correo abre esta página con #correo=...&codigo=...
   ya escritos (van después del "#" para que no queden en ningún servidor).
   Mismo patrón de validación que login.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://american-land-backend.onrender.com/api';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESPERA_REENVIO_SEG = 30;

const SUBTITULOS = {
  1: 'Ingresa tu correo y te enviaremos un código de 6 dígitos para crear una nueva contraseña',
  2: 'Escribe el código que te enviamos y tu nueva contraseña',
  3: 'Listo, ya puedes entrar con tu nueva contraseña'
};

const $ = function (id) { return document.getElementById(id); };
const alerta      = $('alerta-global');
const inputCorreo = $('correo');
const inputCodigo = $('codigo');
const inputClave  = $('contrasena');
const inputConf   = $('confirmar');
const btnEnviar   = $('btn-enviar');
const btnCambiar  = $('btn-cambiar');
const btnReenviar = $('btn-reenviar');
const contadorEl  = $('contador-reenvio');

let correoSolicitado = '';

/* ── Utilidades (= login.js) ── */
function validarCampo(input, errorId, condicion, mensaje) {
  const msgError = $(errorId);
  if (!condicion) {
    input.classList.add('invalido');
    msgError.textContent = mensaje;
    msgError.classList.add('visible');
    return false;
  }
  input.classList.remove('invalido');
  msgError.classList.remove('visible');
  return true;
}

function mostrarAlerta(texto, tipo) {
  alerta.textContent = texto;
  alerta.className = 'alerta ' + tipo + ' visible';
}

function ocultarAlerta() {
  alerta.className = 'alerta';
}

function mostrarPaso(numero) {
  [1, 2, 3].forEach(function (n) {
    $('paso-' + n).classList.toggle('paso-oculto', n !== numero);
  });
  $('subtitulo').textContent = SUBTITULOS[numero];
}

function cargando(boton, activo, texto) {
  boton.classList.toggle('cargando', activo);
  boton.disabled = activo;
  boton.textContent = texto;
}

/* ── Llamadas al backend ── */
async function enviarAlBackend(ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(API + ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
  } catch (_) {
    throw new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  }
  const datos = await respuesta.json().catch(function () { return {}; });
  if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo completar la solicitud. Intenta de nuevo.');
  return datos;
}

function solicitarCodigo(correo) {
  return enviarAlBackend('/auth/recuperar', { correo: correo });
}

/* ── Paso 2: muestra el formulario del código para un correo ── */
function irAlCodigo(correo, codigo) {
  correoSolicitado = correo;
  $('correo-enviado').textContent = correo;
  inputCodigo.value = codigo || '';
  mostrarPaso(2);
  (codigo ? inputClave : inputCodigo).focus();
}

/* ── Contador para reenviar ── */
let intervaloContador = null;

function iniciarContador() {
  clearInterval(intervaloContador);
  btnReenviar.classList.add('bloqueado');

  let seg = ESPERA_REENVIO_SEG;
  contadorEl.textContent = 'Podrás reenviar en ' + seg + ' s';

  intervaloContador = setInterval(function () {
    seg--;
    if (seg <= 0) {
      clearInterval(intervaloContador);
      contadorEl.textContent = '';
      btnReenviar.classList.remove('bloqueado');
    } else {
      contadorEl.textContent = 'Podrás reenviar en ' + seg + ' s';
    }
  }, 1000);
}

/* ── Paso 1: pedir el código ── */
inputCorreo.addEventListener('blur', function () {
  validarCampo(this, 'error-correo', REGEX_CORREO.test(this.value.trim()), 'Ingresa un correo electrónico válido.');
});

$('form-recuperar').addEventListener('submit', async function (e) {
  e.preventDefault();

  const correo = inputCorreo.value.trim().toLowerCase();
  if (!validarCampo(inputCorreo, 'error-correo', REGEX_CORREO.test(correo), 'Ingresa un correo electrónico válido.')) return;

  cargando(btnEnviar, true, 'Enviando...');
  ocultarAlerta();

  try {
    await solicitarCodigo(correo);
    irAlCodigo(correo, '');
    iniciarContador();
  } catch (err) {
    mostrarAlerta(err.message, 'error');
  } finally {
    cargando(btnEnviar, false, 'Enviar código');
  }
});

/* ── Paso 2: código + nueva contraseña ── */
// Solo números en el código (también si lo pegan con espacios)
inputCodigo.addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 6);
});

inputClave.addEventListener('blur', function () {
  validarCampo(this, 'error-contrasena', this.value.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');
});
inputConf.addEventListener('blur', function () {
  validarCampo(this, 'error-confirmar', this.value === inputClave.value, 'Las contraseñas no coinciden.');
});

$('form-codigo').addEventListener('submit', async function (e) {
  e.preventDefault();

  const okCodigo = validarCampo(inputCodigo, 'error-codigo', /^\d{6}$/.test(inputCodigo.value), 'Escribe los 6 dígitos del código.');
  const okClave  = validarCampo(inputClave, 'error-contrasena', inputClave.value.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');
  const okConf   = validarCampo(inputConf, 'error-confirmar', inputConf.value === inputClave.value, 'Las contraseñas no coinciden.');
  if (!okCodigo || !okClave || !okConf) return;

  cargando(btnCambiar, true, 'Guardando...');
  ocultarAlerta();

  try {
    await enviarAlBackend('/auth/restablecer', {
      correo: correoSolicitado,
      codigo: inputCodigo.value,
      contrasena: inputClave.value
    });
    clearInterval(intervaloContador);
    mostrarPaso(3);
  } catch (err) {
    mostrarAlerta(err.message, 'error');
    inputCodigo.focus();
  } finally {
    cargando(btnCambiar, false, 'Cambiar contraseña');
  }
});

/* ── Reenviar el código / usar otro correo ── */
btnReenviar.addEventListener('click', async function () {
  if (this.classList.contains('bloqueado') || !correoSolicitado) return;
  this.textContent = 'Reenviando...';
  this.classList.add('bloqueado');

  try {
    await solicitarCodigo(correoSolicitado);
    inputCodigo.value = '';
    mostrarAlerta('✓ Te enviamos un código nuevo. El anterior ya no sirve.', 'exito');
    setTimeout(ocultarAlerta, 4000);
  } catch (err) {
    mostrarAlerta(err.message, 'error');
  }
  this.textContent = '¿No te llegó? Reenviar código';
  iniciarContador();
});

$('btn-otro-correo').addEventListener('click', function () {
  clearInterval(intervaloContador);
  contadorEl.textContent = '';
  ocultarAlerta();
  inputCorreo.value = correoSolicitado;
  mostrarPaso(1);
  inputCorreo.focus();
});

/* ── Llegó desde el botón del correo: #correo=...&codigo=... ── */
function desdeElCorreo() {
  if (!window.location.hash) return;
  const datos = new URLSearchParams(window.location.hash.slice(1));
  // Se quita de la barra de direcciones y del historial
  history.replaceState(null, '', window.location.pathname);

  const correo = (datos.get('correo') || '').trim().toLowerCase();
  const codigo = (datos.get('codigo') || '').replace(/\D/g, '').slice(0, 6);
  if (!REGEX_CORREO.test(correo)) return;
  ocultarAlerta();
  inputClave.value = '';
  inputConf.value = '';
  irAlCodigo(correo, codigo);
}

desdeElCorreo();
// Por si la página ya estaba abierta y solo cambia el "#"
window.addEventListener('hashchange', desdeElCorreo);
