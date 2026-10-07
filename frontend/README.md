# Virtual Fashion Try-On Frontend

Single-page Next.js app for uploading a person image and garment image, selecting a garment category, and previewing the generated try-on result from the FastAPI backend.

## Setup

Install dependencies:

```bash
pnpm install
```

The frontend calls `http://localhost:8000` by default. To override it:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Run

Start the backend first from `../backend`, then run:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Contract

The app sends `multipart/form-data` to:

```text
POST /try-on
person_image=<file>
garment_image=<file>
category=tops | bottoms | one-pieces
```

The backend returns `image/png`, which the frontend previews in the result panel.

## Checks

```bash
pnpm lint
pnpm build
```
