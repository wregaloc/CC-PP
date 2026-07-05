from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la aplicación, leída exclusivamente desde variables de entorno.

    Nunca se hardcodean valores por defecto sensibles (secretos, credenciales) —
    ver [[local-development-environment]] y [[enterprise-security]].
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    environment: str = "development"
    debug: bool = False

    database_url: str
    # Supabase (y la mayoría de Postgres gestionados en la nube) exige SSL.
    # En local no hace falta — se deja apagado por defecto.
    database_ssl_required: bool = False

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30

    # La cookie del refresh token debe ser Secure en producción (HTTPS obligatorio,
    # ver [[enterprise-security]]). En desarrollo local (HTTP plano, sin NGINX/TLS)
    # un navegador descarta silenciosamente una cookie Secure, así que se permite
    # apagarlo vía env var — nunca se apaga por defecto salvo que se declare explícito.
    cookie_secure: bool = True

    # Rate limiting de login (TDD §9.3): 5 intentos fallidos / 15 min por IP.
    # Implementado contra Postgres (audit_logs), no Redis — ver revoked_token.py.
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    # Almacenamiento temporal de archivos subidos (TDD §6.2: "almacenamiento
    # temporal con nombre único") — sin Docker en esta fase, se usa disco local.
    # El archivo se borra tras procesarse; el dato ya vive en Postgres.
    upload_storage_dir: str = "storage/uploads"

    # Se declara como str plano (no list[str]): pydantic-settings intenta decodificar
    # los tipos complejos como JSON antes de validarlos, lo que rompe con un valor
    # separado por comas como "http://a,http://b". Se expone como lista mediante
    # la propiedad cors_origins de abajo. validation_alias mantiene CORS_ORIGINS
    # como nombre de la variable de entorno.
    cors_origins_raw: str = Field(default="", validation_alias="CORS_ORIGINS")

    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Instancia cacheada de Settings, para usar vía Depends(get_settings)."""
    return Settings()
