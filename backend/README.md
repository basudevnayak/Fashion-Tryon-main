# Virtual Fashion Try-On Backend

FastAPI backend for running FASHN virtual try-on inference from uploaded images.

## Setup

Install dependencies:

```bash
uv sync
```

The default model weights path is `./models`. It should contain:

```text
models/model.safetensors
models/dwpose/yolox_l.onnx
models/dwpose/dw-ll_ucoco_384.onnx
```

Optional environment variables:

```bash
FASHN_WEIGHTS_DIR=./models
FASHN_DEVICE=cuda
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
HOST=0.0.0.0
PORT=8000
RELOAD=false
```

## Run

```bash
uv run python run.py
```

The app loads the try-on pipeline during startup.

## API

Health:

```bash
curl http://localhost:8000/health
```

Try-on:

```bash
curl -X POST http://localhost:8000/try-on \
  -F person_image=@/path/to/person.png \
  -F garment_image=@/path/to/garment.png \
  -F category=tops \
  --output output.png
```

`category` must be one of `tops`, `bottoms`, or `one-pieces`.

## Tests

```bash
uv run python -m unittest discover -s tests -v
```

The tests inject a fake pipeline and do not load the real model weights.
