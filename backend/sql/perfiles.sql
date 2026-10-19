-- Perfil de usuario: foto, titular y descripción (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.

-- Nombre del archivo de la foto (se guarda en UPLOADS_DIR/perfiles)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url VARCHAR(255);

-- Frase corta debajo del nombre, por ejemplo "Docente de inglés · B1–C1"
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS titular VARCHAR(120);

-- Sección "Sobre mí"
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS descripcion VARCHAR(1000);
