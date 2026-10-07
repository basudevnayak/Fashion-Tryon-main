from __future__ import annotations

from contextlib import asynccontextmanager
from io import BytesIO
from threading import Lock
from typing import Callable
import logging
import os

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError

from src.config import ALLOWED_CATEGORIES, Settings, get_settings


logger = logging.getLogger(__name__)


PipelineFactory = Callable[[Settings], object]


def build_tryon_pipeline(settings: Settings) -> object:
    settings.mpl_config_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(settings.mpl_config_dir))

    from fashn_vton import TryOnPipeline

    kwargs: dict[str, str] = {"weights_dir": str(settings.weights_dir)}
    if settings.device:
        kwargs["device"] = settings.device

    return TryOnPipeline(**kwargs)


async def read_image(upload: UploadFile, field_name: str) -> Image.Image:
    image_bytes = await upload.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail=f"{field_name} is empty")

    try:
        image = Image.open(BytesIO(image_bytes))
        return image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid image") from exc


def render_tryon_image(
    *,
    pipeline: object,
    lock: Lock,
    person_image: Image.Image,
    garment_image: Image.Image,
    category: str,
    num_timesteps: int = 20,
) -> bytes:
    with lock:
        try:
            result = pipeline(
                person_image=person_image,
                garment_image=garment_image,
                category=category,
                num_timesteps=num_timesteps,
            )
        except TypeError:
            result = pipeline(
                person_image=person_image,
                garment_image=garment_image,
                category=category,
            )

    if not getattr(result, "images", None):
        raise RuntimeError("Try-on pipeline returned no images")

    output = BytesIO()
    result.images[0].save(output, format="PNG")
    return output.getvalue()


def create_app(
    *,
    settings: Settings | None = None,
    pipeline_factory: PipelineFactory = build_tryon_pipeline,
    load_pipeline_on_startup: bool = True,
) -> FastAPI:
    app_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if load_pipeline_on_startup:
            try:
                app.state.tryon_pipeline = pipeline_factory(app_settings)
            except Exception as exc:
                app.state.tryon_pipeline_error = str(exc)
                logger.exception("Failed to load try-on pipeline")
                raise

        yield

    app = FastAPI(title="Virtual Fashion Try-On API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    app.state.settings = app_settings
    app.state.tryon_pipeline = None
    app.state.tryon_pipeline_error = None
    app.state.tryon_pipeline_lock = Lock()

    @app.get("/health")
    async def health() -> dict[str, bool | str]:
        response: dict[str, bool | str] = {
            "status": "ok",
            "model_loaded": app.state.tryon_pipeline is not None,
        }

        if app.state.tryon_pipeline_error:
            response["model_error"] = app.state.tryon_pipeline_error

        return response

    @app.post("/try-on")
    async def try_on(
        request: Request,
        person_image: UploadFile = File(...),
        garment_image: UploadFile = File(...),
        category: str = Form(...),
        num_timesteps: int | None = Form(None),
    ) -> Response:
        if category not in ALLOWED_CATEGORIES:
            allowed = ", ".join(sorted(ALLOWED_CATEGORIES))
            raise HTTPException(status_code=400, detail=f"category must be one of: {allowed}")

        pipeline = request.app.state.tryon_pipeline
        if pipeline is None:
            raise HTTPException(status_code=503, detail="Try-on model is not loaded")

        person = await read_image(person_image, "person_image")
        garment = await read_image(garment_image, "garment_image")

        timesteps = num_timesteps if num_timesteps is not None else app_settings.num_timesteps

        try:
            png_bytes = render_tryon_image(
                pipeline=pipeline,
                lock=request.app.state.tryon_pipeline_lock,
                person_image=person,
                garment_image=garment,
                category=category,
                num_timesteps=timesteps,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Try-on inference failed")
            raise HTTPException(status_code=500, detail="Try-on inference failed") from exc

        return Response(content=png_bytes, media_type="image/png")

    return app


app = create_app()
