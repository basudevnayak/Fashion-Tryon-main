"use client";

import { type DragEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  CheckCircle,
  ImageSquare,
  Lightning,
  Sparkle,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { performFastClothTryOn } from "@/lib/onnxTryOn";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const CATEGORIES = [
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "one-pieces", label: "One-pieces" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

function formatFileSize(file: File) {
  if (file.size < 1024 * 1024) {
    return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  }

  return `${(file.size / 1024 / 1024).toFixed(1)} MB`;
}

async function responseErrorMessage(response: Response) {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const data: unknown = await response.json();
    if (
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

type UploadPanelProps = {
  id: string;
  title: string;
  description: string;
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File | null) => void;
  onInvalid: (message: string) => void;
};

function UploadPanel({
  id,
  title,
  description,
  file,
  previewUrl,
  onChange,
  onInvalid,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openFilePicker() {
    inputRef.current?.click();
  }

  function acceptFile(fileToAccept: File | null) {
    if (!fileToAccept) {
      return;
    }

    if (!fileToAccept.type.startsWith("image/")) {
      onInvalid("Please drop an image file.");
      return;
    }

    onChange(fileToAccept);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files.item(0));
  }

  function handleDropZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {file ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-teal-700" weight="fill" />
          ) : (
            <ImageSquare className="h-5 w-5 shrink-0 text-zinc-500" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          aria-label={`Upload ${title.toLowerCase()}`}
          onClick={openFilePicker}
          onKeyDown={handleDropZoneKeyDown}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative aspect-[4/5] cursor-pointer overflow-hidden rounded-md border border-dashed bg-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2",
            isDragging
              ? "border-teal-700 bg-teal-50"
              : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-100",
          )}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt={`${title} preview`}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
              <ImageSquare className="h-10 w-10" />
              <span className="text-sm font-medium">
                {isDragging ? "Drop image here" : "Drag image here"}
              </span>
              <span className="text-xs text-zinc-400">or select from your device</span>
            </div>
          )}
          {previewUrl && isDragging ? (
            <div className="absolute inset-0 flex items-center justify-center bg-teal-900/70 text-sm font-medium text-white">
              Drop to replace image
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-10 text-sm text-zinc-600">
            {file ? (
              <>
                <div className="max-w-[220px] truncate font-medium text-zinc-950">{file.name}</div>
                <div>{formatFileSize(file)}</div>
              </>
            ) : (
              <div className="pt-2">PNG, JPG, WEBP</div>
            )}
          </div>

          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              acceptFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={openFilePicker}
            className="w-full sm:w-auto"
          >
            <UploadSimple className="h-4 w-4" />
            Select image
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [garmentImage, setGarmentImage] = useState<File | null>(null);
  const [personPreviewUrl, setPersonPreviewUrl] = useState<string | null>(null);
  const [garmentPreviewUrl, setGarmentPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("tops");
  const [engineMode, setEngineMode] = useState<"onnx" | "ai">("onnx");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = Boolean(personImage && garmentImage && category && !isGenerating);

  const selectedCategory = useMemo(
    () => CATEGORIES.find((item) => item.value === category)?.label ?? "Tops",
    [category],
  );

  useEffect(() => {
    return () => {
      if (resultUrl && resultUrl.startsWith("blob:")) {
        URL.revokeObjectURL(resultUrl);
      }
    };
  }, [resultUrl]);

  useEffect(() => {
    return () => {
      if (personPreviewUrl) {
        URL.revokeObjectURL(personPreviewUrl);
      }
    };
  }, [personPreviewUrl]);

  useEffect(() => {
    return () => {
      if (garmentPreviewUrl) {
        URL.revokeObjectURL(garmentPreviewUrl);
      }
    };
  }, [garmentPreviewUrl]);

  function resetResult() {
    setError(null);
    setResultUrl(null);
  }

  function updatePersonImage(file: File | null) {
    setPersonImage(file);
    setPersonPreviewUrl(file ? URL.createObjectURL(file) : null);
    resetResult();
  }

  function updateGarmentImage(file: File | null) {
    setGarmentImage(file);
    setGarmentPreviewUrl(file ? URL.createObjectURL(file) : null);
    resetResult();
  }

  async function handleGenerate() {
    if (!personImage || !garmentImage) {
      setError("Please select both images before generating.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (engineMode === "onnx") {
        // Fast In-Browser ONNX / Canvas Engine (< 1s)
        const resultDataUrl = await performFastClothTryOn(personImage, garmentImage, {
          category,
        });
        setResultUrl(resultDataUrl);
      } else {
        // Full AI Diffusion Server (FastAPI / CUDA)
        const formData = new FormData();
        formData.append("person_image", personImage);
        formData.append("garment_image", garmentImage);
        formData.append("category", category);

        const response = await fetch(`${API_BASE_URL}/try-on`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await responseErrorMessage(response));
        }

        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) {
          throw new Error("Backend returned a non-image response.");
        }

        setResultUrl(URL.createObjectURL(blob));
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Try-on request failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-300 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-teal-800">
              Virtual fitting room
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              Fashion try-on studio
            </h1>
          </div>
          <div className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">
            Backend: {API_BASE_URL}
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2">
          <UploadPanel
            id="person-image"
            title="Person photo"
            description="The model or user image."
            file={personImage}
            previewUrl={personPreviewUrl}
            onChange={updatePersonImage}
            onInvalid={setError}
          />

          <UploadPanel
            id="garment-image"
            title="Garment photo"
            description="The clothing item to apply."
            file={garmentImage}
            previewUrl={garmentPreviewUrl}
            onChange={updateGarmentImage}
            onInvalid={setError}
          />
        </section>

        <Card>
          <CardContent className="grid gap-4 pt-5 md:grid-cols-[minmax(180px,220px)_minmax(220px,280px)_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="engine-mode">Mode / Engine</Label>
              <Select
                id="engine-mode"
                value={engineMode}
                onChange={(event) => {
                  setEngineMode(event.target.value as "onnx" | "ai");
                  resetResult();
                }}
              >
                <option value="onnx">⚡ Fast ONNX Mode (&lt; 1s)</option>
                <option value="ai">✨ AI Diffusion (CUDA Server)</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as Category);
                  resetResult();
                }}
              >
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {engineMode === "onnx" ? (
                <span>
                  ⚡ <strong className="text-teal-700">Instant Mode ({selectedCategory}):</strong> Runs in browser.
                </span>
              ) : (
                <span>
                  ✨ <strong className="text-zinc-900">AI Deep Mode ({selectedCategory}):</strong> Local CUDA backend.
                </span>
              )}
            </div>

            <Button
              type="button"
              size="lg"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className="w-full md:w-auto"
            >
              {engineMode === "onnx" ? (
                <Lightning className="h-4 w-4" weight="fill" />
              ) : (
                <Sparkle className="h-4 w-4" weight="fill" />
              )}
              {isGenerating ? "Generating..." : engineMode === "onnx" ? "Instant Try-On" : "AI Try-On"}
            </Button>
          </CardContent>
        </Card>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <WarningCircle className="mt-0.5 h-5 w-5 shrink-0" weight="fill" />
            <span>{error}</span>
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>The generated try-on image appears here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white">
              {resultUrl ? (
                <Image
                  src={resultUrl}
                  alt="Generated try-on result"
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 70vw"
                  className="object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 px-4 text-center">
                  <ImageSquare className="h-12 w-12 text-zinc-400" />
                  <p className="text-2xl font-semibold tracking-normal text-zinc-500 sm:text-3xl">
                    {isGenerating ? "Generating result" : "We will see the results"}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
