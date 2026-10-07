from dataclasses import dataclass
from pathlib import Path
import os
import tempfile


BACKEND_DIR = Path(__file__).resolve().parents[1]
ALLOWED_CATEGORIES = {"tops", "bottoms", "one-pieces"}
DEFAULT_CORS_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


def _default_mpl_config_dir() -> Path:
    return Path(tempfile.gettempdir()) / "virtual-fashion-tryon-matplotlib"


@dataclass(frozen=True)
class Settings:
    weights_dir: Path
    device: str | None
    mpl_config_dir: Path
    cors_origins: list[str]
    num_timesteps: int = 10


def _parse_csv(value: str | None, default: tuple[str, ...]) -> list[str]:
    if not value:
        return list(default)

    return [item.strip() for item in value.split(",") if item.strip()]


def get_settings() -> Settings:
    weights_dir = Path(os.getenv("FASHN_WEIGHTS_DIR", BACKEND_DIR / "models")).expanduser()
    device = os.getenv("FASHN_DEVICE") or None
    mpl_config_dir = Path(os.getenv("MPLCONFIGDIR", _default_mpl_config_dir())).expanduser()
    cors_origins = _parse_csv(os.getenv("CORS_ORIGINS"), DEFAULT_CORS_ORIGINS)
    num_timesteps = int(os.getenv("FASHN_NUM_TIMESTEPS", "5"))

    return Settings(
        weights_dir=weights_dir.resolve(),
        device=device,
        mpl_config_dir=mpl_config_dir.resolve(),
        cors_origins=cors_origins,
        num_timesteps=num_timesteps,
    )
