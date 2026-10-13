// ===== login-fallido.js =====
// Muestra el motivo específico del fallo (si fue guardado por login.js)
// y permite reintentar volviendo al formulario de login.

document.addEventListener('DOMContentLoaded', () => {

  // Mensajes posibles guardados por login.js antes de redirigir aquí
  const motivos = {
    correo:   'El correo electrónico ingresado no está registrado.',
    password: 'La contraseña ingresada es incorrecta.',
    rol:      'El rol seleccionado no coincide con tu cuenta registrada.',
    inactivo: 'Tu cuenta está inactiva o pendiente de aprobación.',
    generico: 'Revisa tus datos e inténtalo nuevamente'
  };

  const motivoGuardado = sessionStorage.getItem('motivoErrorLogin');
  const mensajeEl = document.getElementById('mensaje-causa');

  if (mensajeEl && motivoGuardado && motivos[motivoGuardado]) {
    mensajeEl.textContent = motivos[motivoGuardado];
  }

  // Botón "Reintentar" -> vuelve al formulario de login
  const btnReintentar = document.getElementById('btn-reintentar');
  if (btnReintentar) {
    btnReintentar.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  }

  // Limpiar el motivo guardado para que no persista en próximos intentos
  sessionStorage.removeItem('motivoErrorLogin');
});