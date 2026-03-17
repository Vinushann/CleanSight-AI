import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CleanSight AI"
    # Additional settings like secret keys, etc. can go here
    
    class Config:
        env_file = ".env"

settings = Settings()
