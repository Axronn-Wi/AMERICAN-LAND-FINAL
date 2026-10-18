// Para router.param('id', validarId): un :id que no sea entero positivo responde 400
// en vez de llegar a PostgreSQL y terminar en un error 500
function validarId(req, res, next, valor) {
  if (!/^\d{1,9}$/.test(String(valor)) || Number(valor) < 1) {
    return res.status(400).json({ mensaje: 'Identificador inválido.' });
  }
  next();
}

module.exports = { validarId };
