/* ============================================================
   recover_pass.js — Instituto American Land
   Pide al backend el enlace de recuperación (POST /auth/recuperar).
   Mismo patrón de validación que login.js
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://american-land-backend.onrender.com/api';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formRecuperar = document.getElementById('form-recuperar');
const btnEnviar     = document.getElementById('btn-enviar');
const btnReenviar   = document.getElementById('btn-reenviar');
const alerta        = document.getElementById('alerta-global');
const paso1         = document.getElementById('paso-1');
const paso2         = document.getElementById('paso-2');
const correoEnvEl   = document.getElementById('correo-enviado');
const contadorEl    = document.getElementById('contador-reenvio');
const inputCorreo   = document.getElementById('correo');

let correoSolicitado = '';

/* ── Validación reutilizable (= login.js) ── */
function validarCampo(input, errorId, condicion, mensaje) {
  const msgError = document.getElementById(errorId);
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

/* ── Llamada al backend ── */
async function solicitarEnlace(correo) {
  const respuesta = await fetch(API + '/auth/recuperar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correo })
  });
  const datos = await respuesta.json().catch(function () { return {}; });
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || 'No se pudo enviar el enlace. Intenta de nuevo.');
  }
  return datos;
}

/* ── Validación blur (= login.js) ── */
inputCorreo.addEventListener('blur', function () {
  validarCampo(this, 'error-correo', REGEX_CORREO.test(this.value.trim()), 'Ingresa un correo electrónico válido.');
});

/* ── Envío del formulario ── */
formRecuperar.addEventListener('submit', async function (e) {
  e.preventDefault();

  const correo = inputCorreo.value.trim();
  if (!validarCampo(inputCorreo, 'error-correo', REGEX_CORREO.test(correo), 'Ingresa un correo electrónico válido.')) return;

  btnEnviar.classList.add('cargando');
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';
  alerta.className = 'alerta';

  try {
    await solicitarEnlace(correo);
    correoSolicitado = correo;
    correoEnvEl.textContent = correo;
    paso1.style.display = 'none';
    paso2.classList.remove('paso-oculto');
    paso2.style.display = 'block';
    iniciarContador();
  } catch (err) {
    mostrarAlerta(err.message, 'error');
  } finally {
    btnEnviar.classList.remove('cargando');
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar enlace de recuperación';
  }
});

/* ── Reenviar correo ── */
btnReenviar.addEventListener('click', async function () {
  if (this.classList.contains('bloqueado') || !correoSolicitado) return;
  this.textContent = 'Reenviando...';
  this.classList.add('bloqueado');

  try {
    await solicitarEnlace(correoSolicitado);
    mostrarAlerta('✓ Te enviamos un enlace nuevo. El anterior ya no funciona.', 'exito');
    setTimeout(function () { alerta.className = 'alerta'; }, 4000);
  } catch (err) {
    mostrarAlerta(err.message, 'error');
  }
  iniciarContador();
});

/* ── Contador de reenvío (30 s) ── */
let intervaloContador = null;

function iniciarContador() {
  clearInterval(intervaloContador);
  btnReenviar.classList.add('bloqueado');
  btnReenviar.textContent = 'Reenviar correo';

  let seg = 30;
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
