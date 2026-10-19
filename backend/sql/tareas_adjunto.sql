-- Archivo adjunto de una tarea (guía, taller en PDF, etc.) (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.
-- El archivo se guarda en la carpeta de material (UPLOADS_DIR/material).

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS archivo_url VARCHAR(255);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS archivo_nombre VARCHAR(255);
