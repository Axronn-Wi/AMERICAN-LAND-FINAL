// ===== login-exitoso.js =====
// Lee los datos de sesión guardados por login.js y redirige
// automáticamente al panel correspondiente según el rol.

document.addEventListener('DOMContentLoaded', () => {

  // Datos guardados al iniciar sesión (login.js debe guardarlos así)
  const rol    = sessionStorage.getItem('rolUsuario');     // "estudiante" | "docente" | "admin"
  const nombre = sessionStorage.getItem('nombreUsuario');  // nombre del usuario (opcional)

  // Mapa de rutas de redirección por rol
  const rutasPorRol = {
    estudiante: '../estudiante/inicio.html',
    docente:    '../docente/inicio.html',
    admin:      '../admin/inicio.html'
  };

  // Nombres legibles para mostrar en el mensaje
  const nombrePanel = {
    estudiante: ' de estudiante',
    docente:    ' de docente',
    admin:      ' de administrador'
  };

  const rolNormalizado = (rol || '').toLowerCase().trim();
  const rutaDestino = rutasPorRol[rolNormalizado] || '../auth/login.html';

  // Personalizar mensaje de bienvenida
  const spanNombre = document.getElementById('nombre-usuario');
  if (spanNombre && nombre) {
    spanNombre.textContent = nombre;
  }

  // Personalizar texto de redirección según el rol
  const spanRolDestino = document.getElementById('rol-destino');
  if (spanRolDestino) {
    spanRolDestino.textContent = nombrePanel[rolNormalizado] || '';
  }

  // ===== Contador y redirección automática =====
  let segundosRestantes = 3;
  const contadorEl = document.getElementById('contador');

  const intervalo = setInterval(() => {
    segundosRestantes--;

    if (contadorEl) {
      contadorEl.textContent = segundosRestantes;
    }

    if (segundosRestantes <= 0) {
      clearInterval(intervalo);
      window.location.href = rutaDestino;
    }
  }, 1000);

  // ===== Botón "Ir ahora" =====
  const btnIrAhora = document.getElementById('btn-ir-ahora');
  if (btnIrAhora) {
    btnIrAhora.addEventListener('click', () => {
      clearInterval(intervalo);
      window.location.href = rutaDestino;
    });
  }
});