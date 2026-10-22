-- Comentario del estudiante para el profesor al entregar una tarea (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.
ALTER TABLE entregas_tareas ADD COLUMN IF NOT EXISTS comentario VARCHAR(500);
