/* ============================================================
   restablecer.js — Instituto American Land
   Página a la que llega el enlace del correo de recuperación:
   auth/restablecer.html#token=<64 caracteres hex>
   Envía el token y la nueva contraseña a POST /auth/restablecer.
============================================================ */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://american-land-backend.onrender.com/api';

const form       = document.getElementById('form-restablecer');
const btnGuardar = document.getElementById('btn-guardar');
const alerta     = document.getElementById('alerta-global');
const paso1      = document.getElementById('paso-1');
const paso2      = document.getElementById('paso-2');
const inputClave = document.getElementById('contrasena');
const inputConf  = document.getElementById('confirmar');

// El token viene después del "#": así no queda en registros de servidores
const token = (new URLSearchParams(window.location.hash.slice(1)).get('token') || '').toLowerCase();

// Se quita del historial para que no quede visible en la barra de direcciones
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname);
}

function mostrarAlerta(texto, tipo) {
  alerta.textContent = texto;
  alerta.className = 'alerta ' + tipo + ' visible';
}

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

if (!/^[a-f0-9]{64}$/.test(token)) {
  mostrarAlerta('El enlace no es válido o está incompleto. Solicita uno nuevo.', 'error');
  form.querySelectorAll('input, button').forEach(function (c) { c.disabled = true; });
}

inputClave.addEventListener('blur', function () {
  validarCampo(this, 'error-contrasena', this.value.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');
});
inputConf.addEventListener('blur', function () {
  validarCampo(this, 'error-confirmar', this.value === inputClave.value, 'Las contraseñas no coinciden.');
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const okClave = validarCampo(inputClave, 'error-contrasena', inputClave.value.length >= 6, 'La contraseña debe tener al menos 6 caracteres.');
  const okConf  = validarCampo(inputConf, 'error-confirmar', inputConf.value === inputClave.value, 'Las contraseñas no coinciden.');
  if (!okClave || !okConf) return;

  btnGuardar.classList.add('cargando');
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';
  alerta.className = 'alerta';

  try {
    const respuesta = await fetch(API + '/auth/restablecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, contrasena: inputClave.value })
    });
    const datos = await respuesta.json().catch(function () { return {}; });
    if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo cambiar la contraseña.');

    paso1.style.display = 'none';
    paso2.classList.remove('paso-oculto');
    paso2.style.display = 'block';
  } catch (err) {
    mostrarAlerta(err.message, 'error');
  } finally {
    btnGuardar.classList.remove('cargando');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar contraseña';
  }
});
