from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Prawo Jazdy Backend"
    DATABASE_URL: str = "sqlite+aiosqlite:///./prawo_jazdy.db"
    SECRET_KEY: str = "super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    XLSX_PATH: str = "../baza_pytan.xlsx"
    CLANKER_API_KEY: str = ""
    CLANKER_API_URL: str = "https://clanker.voidy.xyz"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
