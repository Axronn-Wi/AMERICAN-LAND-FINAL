-- Archivos subidos (fotos del muro y de perfil, guías de tareas, material y entregas)
-- guardados en la base de datos, porque el disco de Render se borra en cada reinicio.
-- Se puede ejecutar varias veces sin romper nada.

CREATE TABLE IF NOT EXISTS archivos (
  nombre     VARCHAR(255) PRIMARY KEY,
  tipo_mime  VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
  tamano     INTEGER      NOT NULL,
  datos      BYTEA        NOT NULL,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
