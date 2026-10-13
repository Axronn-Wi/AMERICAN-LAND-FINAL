/* ============================================================
   recuperar-contrasena.js — Instituto American Land
   Mismo patrón de validación que login.js
============================================================ */

const formRecuperar = document.getElementById('form-recuperar');
const btnEnviar     = document.getElementById('btn-enviar');
const btnReenviar   = document.getElementById('btn-reenviar');
const alerta        = document.getElementById('alerta-global');
const paso1         = document.getElementById('paso-1');
const paso2         = document.getElementById('paso-2');
const correoEnvEl   = document.getElementById('correo-enviado');
const contadorEl    = document.getElementById('contador-reenvio');

/* ── Validación reutilizable (= login.js) ── */
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

/* ── Validación blur (= login.js) ── */
document.getElementById('correo').addEventListener('blur', function () {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  validarCampo(this, 'error-correo', regex.test(this.value), 'Ingresa un correo electrónico válido.');
});

/* ── Envío del formulario ── */
formRecuperar.addEventListener('submit', function (e) {
  e.preventDefault();

  const correo = document.getElementById('correo');
  const regex  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valido = validarCampo(correo, 'error-correo', regex.test(correo.value), 'Ingresa un correo electrónico válido.');
  if (!valido) return;

  // Estado cargando (= login.js)
  btnEnviar.classList.add('cargando');
  btnEnviar.textContent = 'Enviando...';

  setTimeout(function () {
    btnEnviar.classList.remove('cargando');
    btnEnviar.textContent = 'Enviar enlace de recuperación';

    correoEnvEl.textContent = correo.value.trim();
    paso1.style.display = 'none';
    paso2.classList.remove('paso-oculto');
    paso2.style.display = 'block';

    iniciarContador();
  }, 1400);
});

/* ── Reenviar correo ── */
btnReenviar.addEventListener('click', function () {
  this.textContent = 'Reenviando...';
  this.classList.add('bloqueado');

  setTimeout(function () {
    alerta.textContent = '✓ Correo reenviado correctamente.';
    alerta.className   = 'alerta exito visible';
    setTimeout(function () { alerta.className = 'alerta'; }, 3000);
    iniciarContador();
  }, 1000);
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