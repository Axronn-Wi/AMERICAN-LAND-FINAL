// ---------------------------------------------------------------
// Validación de textos que llegan de los formularios.
// Los largos máximos son los de las columnas de la base de datos: si un
// texto es más largo, se responde 400 con un mensaje claro en vez de que
// PostgreSQL falle con un error 500.
// ---------------------------------------------------------------
const LARGO = {
  nombre: 150,          // usuarios.nombre_completo
  correo: 150,          // usuarios.correo
  telefono: 20,         // usuarios.telefono
  pais: 50,             // usuarios.pais
  ciudad: 50,           // usuarios.ciudad
  especialidad: 100,    // docentes.especialidad
  cargo: 50,            // admin.cargo / secretarias.cargo
  sede: 50,             // admin.sede / secretarias.sede
  salon: 50,            // salones.nombre
  titulo: 150,          // tareas.titulo / material_apoyo.titulo
  tipoTarea: 30,        // tareas.tipo
  descripcionTarea: 2000,
  referenciaPago: 100,  // pagos.referencia_transaccion
  observaciones: 200,   // matriculas.observaciones (el formulario permite 200)
  retroalimentacion: 500,
  comentarioEntrega: 500
};

// bcrypt solo usa los primeros 72 bytes: una contraseña más larga se cortaría sin avisar
const CONTRASENA_MIN = 6;
const CONTRASENA_MAX_BYTES = 72;

const REGEX_TELEFONO = /^[0-9+()\s-]{7,20}$/;

// Texto opcional: recortado, vacío -> null; devuelve { error } si supera el máximo
function textoOpcional(valor, maximo, nombreCampo) {
  if (valor === undefined || valor === null) return { valor: null };
  const limpio = String(valor).trim();
  if (limpio.length > maximo) return { error: `${nombreCampo} no puede superar los ${maximo} caracteres.` };
  return { valor: limpio || null };
}

// Texto obligatorio: además no puede quedar vacío
function textoObligatorio(valor, maximo, nombreCampo) {
  const t = textoOpcional(valor, maximo, nombreCampo);
  if (t.error) return t;
  if (!t.valor) return { error: `${nombreCampo} es obligatorio.` };
  return t;
}

// Teléfono opcional con el mismo formato que piden los formularios
function telefonoOpcional(valor) {
  const t = textoOpcional(valor, LARGO.telefono, 'El teléfono');
  if (t.error) return t;
  if (t.valor && !REGEX_TELEFONO.test(t.valor)) return { error: 'El teléfono no es válido.' };
  return t;
}

// Fecha opcional AAAA-MM-DD, no futura; devuelve { valor } o { error }
function fechaNacimientoOpcional(valor) {
  if (!valor) return { valor: null };
  const fecha = String(valor).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    return { error: 'La fecha de nacimiento no es válida.' };
  }
  if (fecha > new Date().toISOString().slice(0, 10) || Number(fecha.slice(0, 4)) < 1920) {
    return { error: 'Revisa la fecha de nacimiento.' };
  }
  return { valor: fecha };
}

// Devuelve el mensaje de error de una contraseña nueva, o null si sirve
function errorContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < CONTRASENA_MIN) {
    return `La contraseña debe tener al menos ${CONTRASENA_MIN} caracteres.`;
  }
  if (Buffer.byteLength(contrasena, 'utf8') > CONTRASENA_MAX_BYTES) {
    return `La contraseña no puede superar los ${CONTRASENA_MAX_BYTES} caracteres.`;
  }
  return null;
}

module.exports = {
  LARGO, REGEX_TELEFONO,
  textoOpcional, textoObligatorio, telefonoOpcional, fechaNacimientoOpcional, errorContrasena
};
