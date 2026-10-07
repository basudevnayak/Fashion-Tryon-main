from io import BytesIO
import unittest

import httpx
from PIL import Image

from src.main import create_app


def make_image_bytes(color: str = "red") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (4, 4), color=color).save(buffer, format="PNG")
    return buffer.getvalue()


class FakePipelineResult:
    def __init__(self) -> None:
        self.images = [Image.new("RGB", (2, 2), color="green")]


class FakePipeline:
    def __init__(self) -> None:
        self.calls = []

    def __call__(self, *, person_image, garment_image, category):
        self.calls.append(
            {
                "person_mode": person_image.mode,
                "garment_mode": garment_image.mode,
                "category": category,
            }
        )
        return FakePipelineResult()


class TryOnApiTests(unittest.IsolatedAsyncioTestCase):
    def make_client(self) -> tuple[object, httpx.AsyncClient]:
        app = create_app(load_pipeline_on_startup=False)
        app.state.tryon_pipeline = FakePipeline()
        transport = httpx.ASGITransport(app=app)
        client = httpx.AsyncClient(transport=transport, base_url="http://testserver")
        return app, client

    async def test_health_reports_loaded_model(self) -> None:
        app, client = self.make_client()
        async with client:
            response = await client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "model_loaded": True})
        self.assertIsInstance(app.state.tryon_pipeline, FakePipeline)

    async def test_startup_loads_pipeline_factory(self) -> None:
        app = create_app(pipeline_factory=lambda settings: FakePipeline())

        async with app.router.lifespan_context(app):
            self.assertIsInstance(app.state.tryon_pipeline, FakePipeline)

    async def test_cors_allows_local_frontend_origin(self) -> None:
        _, client = self.make_client()
        async with client:
            response = await client.options(
                "/try-on",
                headers={
                    "Origin": "http://localhost:3000",
                    "Access-Control-Request-Method": "POST",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")

    async def test_try_on_returns_png(self) -> None:
        app, client = self.make_client()
        async with client:
            response = await client.post(
                "/try-on",
                data={"category": "tops"},
                files={
                    "person_image": ("person.png", make_image_bytes("blue"), "image/png"),
                    "garment_image": ("garment.png", make_image_bytes("red"), "image/png"),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/png")
        self.assertTrue(response.content.startswith(b"\x89PNG"))
        self.assertEqual(app.state.tryon_pipeline.calls[0]["category"], "tops")

    async def test_invalid_category_returns_400(self) -> None:
        _, client = self.make_client()
        async with client:
            response = await client.post(
                "/try-on",
                data={"category": "shoes"},
                files={
                    "person_image": ("person.png", make_image_bytes("blue"), "image/png"),
                    "garment_image": ("garment.png", make_image_bytes("red"), "image/png"),
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("category must be one of", response.json()["detail"])

    async def test_missing_person_image_returns_validation_error(self) -> None:
        _, client = self.make_client()
        async with client:
            response = await client.post(
                "/try-on",
                data={"category": "tops"},
                files={"garment_image": ("garment.png", make_image_bytes("red"), "image/png")},
            )

        self.assertEqual(response.status_code, 422)

    async def test_missing_garment_image_returns_validation_error(self) -> None:
        _, client = self.make_client()
        async with client:
            response = await client.post(
                "/try-on",
                data={"category": "tops"},
                files={"person_image": ("person.png", make_image_bytes("blue"), "image/png")},
            )

        self.assertEqual(response.status_code, 422)

    async def test_non_image_upload_returns_400(self) -> None:
        _, client = self.make_client()
        async with client:
            response = await client.post(
                "/try-on",
                data={"category": "tops"},
                files={
                    "person_image": ("person.txt", b"not an image", "text/plain"),
                    "garment_image": ("garment.png", make_image_bytes("red"), "image/png"),
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "person_image must be a valid image")

    async def test_try_on_without_loaded_model_returns_503(self) -> None:
        app = create_app(load_pipeline_on_startup=False)
        transport = httpx.ASGITransport(app=app)

        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/try-on",
                data={"category": "tops"},
                files={
                    "person_image": ("person.png", make_image_bytes("blue"), "image/png"),
                    "garment_image": ("garment.png", make_image_bytes("red"), "image/png"),
                },
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Try-on model is not loaded")


if __name__ == "__main__":
    unittest.main()
