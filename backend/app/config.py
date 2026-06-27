from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    jwt_secret: str
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "axiom-llm"
    ollama_embed_model: str = "nomic-embed-text"
    admin_username: str = "admin"
    admin_password: str = "changeme"
    # Separate signing secret for admin JWTs; prevents user-token to admin-token forgery.
    # If left empty, falls back to jwt_secret for existing deployments.
    admin_jwt_secret: str = ""
    redis_url: str = ""
    sentry_dsn: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_verify_service_sid: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""
    stripe_price_basic: str = ""   # Stripe recurring price id for Basic
    stripe_price_pro: str = ""     # Stripe recurring price id for Pro
    # Transactional email (Resend). Leave resend_api_key empty to disable sending.
    resend_api_key: str = ""
    email_from: str = "Axiom <onboarding@resend.dev>"
    # Fallback recipient for sales enquiries when an agency has no email on file.
    support_email: str = ""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")


settings = Settings()
