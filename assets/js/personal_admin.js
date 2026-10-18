/* ============================================================
   personal_admin.js — CRUD de administradores y secretarias
   Instituto American Land
   Ubicación: assets/js/personal_admin.js
   Solo para el rol admin.
============================================================ */

(function () {
  'use strict';

  const P = window.Panel;
  if (!P.iniciar(['admin'])) return;

  const AYUDA_ROL = {
    secretaria: 'Puede gestionar estudiantes, matrículas, pagos, anuncios y contactos. No puede borrar datos ni ver docentes, salones o personal.',
    admin: 'Acceso total al panel, incluida la gestión del personal. Dale este rol solo a quien lo necesite.'
  };

  let personal = [];
  let yo = null;
  let editando = null;

  const porId = function (id) { return document.getElementById(id); };

  // ── Carga ────────────────────────────────────────────────
  async function cargar() {
    const r = await P.api('/admin/personal');
    if (!r.ok) {
      porId('tbody-personal').textContent = '';
      P.alerta('error', r.datos.mensaje || 'No se pudo cargar el personal.');
      return;
    }
    personal = r.datos.personal;
    yo = r.datos.yo;
    pintarStats();
    pintarTabla();
  }

  function pintarStats() {
    const admins = personal.filter(function (p) { return p.rol === 'admin'; });
    const secretarias = personal.filter(function (p) { return p.rol === 'secretaria'; });
    porId('stat-admins').textContent = admins.length;
    porId('stat-secretarias').textContent = secretarias.length;
    const adminsActivos = admins.filter(function (p) { return p.activo; }).length;
    const secretariasActivas = secretarias.filter(function (p) { return p.activo; }).length;
    porId('delta-admins').textContent = adminsActivos + (adminsActivos === 1 ? ' activo' : ' activos');
    porId('delta-secretarias').textContent = secretariasActivas + (secretariasActivas === 1 ? ' activa' : ' activas');
  }

  function filtrados() {
    const texto = porId('input-busqueda').value.trim().toLowerCase();
    const rol = porId('filtro-rol').value;
    return personal.filter(function (p) {
      if (rol && p.rol !== rol) return false;
      if (!texto) return true;
      return (p.nombre_completo + ' ' + p.correo).toLowerCase().indexOf(texto) !== -1;
    });
  }

  function boton(clase, icono, titulo, alClic) {
    const b = P.crear('button', clase, icono);
    b.type = 'button';
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    b.addEventListener('click', alClic);
    return b;
  }

  function pintarTabla() {
    const tbody = porId('tbody-personal');
    const lista = filtrados();
    tbody.textContent = '';
    porId('badge-total').textContent = lista.length + (lista.length === 1 ? ' persona' : ' personas');

    if (lista.length === 0) {
      const tr = P.crear('tr');
      const td = P.crear('td', 'gris-texto', 'No hay personal con ese criterio.');
      td.colSpan = 6;
      td.style.cssText = 'padding:28px;text-align:center';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    lista.forEach(function (p) {
      const esYo = p.id === yo;
      const tr = P.crear('tr');

      const tdNombre = P.crear('td');
      const info = P.crear('div', 'docente-info');
      const avatar = P.crear('div', 'avatar-docente', P.iniciales(p.nombre_completo));
      avatar.style.background = p.rol === 'admin'
        ? 'linear-gradient(135deg, var(--morado), var(--morado-claro))'
        : 'linear-gradient(135deg, var(--azul), var(--morado-claro))';
      info.appendChild(avatar);
      const textos = P.crear('div');
      const nombre = P.crear('p', 'docente-nombre', p.nombre_completo);
      if (esYo) {
        nombre.appendChild(document.createTextNode(' '));
        nombre.appendChild(P.crear('span', 'chip chip-yo', 'Tú'));
      }
      textos.appendChild(nombre);
      textos.appendChild(P.crear('p', 'docente-correo', p.correo));
      info.appendChild(textos);
      tdNombre.appendChild(info);
      tr.appendChild(tdNombre);

      const tdRol = P.crear('td');
      tdRol.appendChild(P.crear('span', 'chip chip-' + p.rol, p.rol === 'admin' ? 'Administrador' : 'Secretaria'));
      tr.appendChild(tdRol);

      const tdCargo = P.crear('td');
      tdCargo.appendChild(P.crear('div', null, p.cargo || '—'));
      tdCargo.appendChild(P.crear('div', 'docente-correo', p.sede || ''));
      tr.appendChild(tdCargo);

      tr.appendChild(P.crear('td', p.telefono ? '' : 'gris-texto', p.telefono || '—'));

      const tdEstado = P.crear('td');
      tdEstado.appendChild(P.crear('span', 'badge-estado ' + (p.activo ? 'activo' : 'inactivo'), p.activo ? 'Activo' : 'Inactivo'));
      tr.appendChild(tdEstado);

      const tdAcc = P.crear('td');
      const acc = P.crear('div', 'acciones-fila');
      acc.appendChild(boton('btn-editar', '✎', 'Editar', function () { abrirModal(p); }));
      if (!esYo) {
        if (p.activo) {
          acc.appendChild(boton('btn-ver', '⏸', 'Desactivar', function () { cambiarEstado(p, false); }));
        } else {
          acc.appendChild(boton('btn-editar', '✔', 'Activar', function () { cambiarEstado(p, true); }));
        }
        acc.appendChild(boton('btn-eliminar', '🗑', 'Eliminar', function () { eliminar(p); }));
      }
      tdAcc.appendChild(acc);
      tr.appendChild(tdAcc);

      tbody.appendChild(tr);
    });
  }

  // ── Crear / editar ───────────────────────────────────────
  function abrirModal(p) {
    editando = p || null;
    porId('form-personal').reset();
    porId('err-personal').textContent = '';
    porId('modal-personal-titulo').textContent = p ? 'Editar a ' + p.nombre_completo : 'Nuevo miembro del personal';
    porId('per-rol').disabled = !!p;
    porId('per-contrasena-req').style.display = p ? 'none' : '';
    porId('ayuda-edicion').style.display = p ? 'block' : 'none';
    porId('btn-guardar-personal').textContent = p ? 'Guardar cambios' : 'Crear cuenta';
    if (p) {
      porId('per-rol').value = p.rol;
      porId('per-nombre').value = p.nombre_completo;
      porId('per-correo').value = p.correo;
      porId('per-cargo').value = p.cargo || '';
      porId('per-sede').value = p.sede || '';
      porId('per-telefono').value = p.telefono || '';
    }
    porId('ayuda-rol').textContent = AYUDA_ROL[porId('per-rol').value];
    P.abrirModal('modal-personal');
  }

  porId('per-rol').addEventListener('change', function () {
    porId('ayuda-rol').textContent = AYUDA_ROL[this.value];
  });

  porId('form-personal').addEventListener('submit', async function (e) {
    e.preventDefault();
    const err = porId('err-personal');
    const datos = {
      nombre_completo: porId('per-nombre').value.trim(),
      correo: porId('per-correo').value.trim(),
      telefono: porId('per-telefono').value.trim(),
      datosPerfil: { cargo: porId('per-cargo').value.trim(), sede: porId('per-sede').value.trim() }
    };
    const contrasena = porId('per-contrasena').value;

    if (!datos.nombre_completo || !datos.correo) { err.textContent = 'El nombre y el correo son obligatorios.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) { err.textContent = 'El correo no es válido.'; return; }
    if (!editando && contrasena.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    if (editando && contrasena && contrasena.length < 6) { err.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; return; }
    if (contrasena) datos.contrasena = contrasena;

    const btn = porId('btn-guardar-personal');
    btn.disabled = true;
    const r = editando
      ? await P.api('/admin/usuarios/' + editando.id, { method: 'PUT', body: datos })
      : await P.api('/admin/usuarios', { method: 'POST', body: Object.assign({ rol: porId('per-rol').value }, datos) });
    btn.disabled = false;

    if (!r.ok) { err.textContent = r.datos.mensaje || 'No se pudo guardar.'; return; }
    P.cerrarModal('modal-personal');
    P.alerta('exito', editando ? 'Cambios guardados.' : 'Cuenta creada. Ya puede iniciar sesión con su correo y contraseña.');
    cargar();
  });

  // ── Activar / desactivar / eliminar ──────────────────────
  async function cambiarEstado(p, activo) {
    if (!activo) {
      const ok = await P.confirmar('¿Desactivar cuenta?',
        p.nombre_completo + ' no podrá iniciar sesión hasta que la actives de nuevo.', 'Sí, desactivar');
      if (!ok) return;
    }
    const r = await P.api('/admin/usuarios/' + p.id + '/estado', { method: 'PUT', body: { activo: activo } });
    if (!r.ok) { P.alerta('error', r.datos.mensaje || 'No se pudo cambiar el estado.'); return; }
    P.alerta('exito', activo ? 'Cuenta activada.' : 'Cuenta desactivada.');
    cargar();
  }

  async function eliminar(p) {
    const ok = await P.confirmar('¿Eliminar cuenta?',
      'Vas a eliminar definitivamente a ' + p.nombre_completo + '. Si ya registró matrículas, pagos o anuncios no se podrá borrar: en ese caso desactívala.',
      'Sí, eliminar');
    if (!ok) return;
    const r = await P.api('/admin/usuarios/' + p.id, { method: 'DELETE' });
    if (!r.ok) { P.alerta('error', r.datos.mensaje || 'No se pudo eliminar.'); return; }
    P.alerta('exito', 'Cuenta eliminada.');
    cargar();
  }

  // ── Eventos ──────────────────────────────────────────────
  porId('btn-nuevo').addEventListener('click', function () { abrirModal(null); });
  porId('btn-cerrar-personal').addEventListener('click', function () { P.cerrarModal('modal-personal'); });
  porId('btn-cancelar-personal').addEventListener('click', function () { P.cerrarModal('modal-personal'); });
  porId('input-busqueda').addEventListener('input', pintarTabla);
  porId('filtro-rol').addEventListener('change', pintarTabla);

  cargar();
})();
