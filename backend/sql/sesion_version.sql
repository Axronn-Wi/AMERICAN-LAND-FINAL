-- Versión de la sesión de cada usuario (PostgreSQL)
-- Se puede ejecutar varias veces sin romper nada.

-- Viaja dentro del token de sesión y sube en 1 cada vez que cambia la contraseña
-- (restablecer, cambiar desde el perfil o cuando la administración la cambia):
-- los tokens firmados con una versión anterior dejan de servir.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0;
