"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowsClockwise, Camera, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let active = true;
    const currentVideo = videoRef.current;

    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (currentVideo) {
        currentVideo.srcObject = null;
      }
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (currentVideo) {
          currentVideo.srcObject = stream;
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error("Camera access error:", err);
        setError(
          "Could not access camera. Please allow camera permissions in your browser."
        );
      });

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (currentVideo) {
        currentVideo.srcObject = null;
      }
    };
  }, [isOpen, facingMode]);

  function takeSnapshot() {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror image for front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedPhotoUrl(URL.createObjectURL(blob));
        }
      },
      "image/jpeg",
      0.95
    );
  }

  function handleCloseModal() {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
    setError(null);
    onClose();
  }

  function handleConfirm() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `photo_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    handleCloseModal();
  }

  function handleRetake() {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }
    setCapturedPhotoUrl(null);
    setCapturedBlob(null);
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-teal-400" weight="fill" />
            <span className="font-semibold">Take Photo</span>
          </div>
          <button
            onClick={handleCloseModal}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative aspect-[3/4] w-full bg-black">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-red-400">
              <p className="text-sm font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setFacingMode((prev) => prev);
                }}
                className="mt-4 border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
              >
                Retry Camera
              </Button>
            </div>
          ) : capturedPhotoUrl ? (
            <Image
              src={capturedPhotoUrl}
              alt="Captured snapshot"
              fill
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${
                facingMode === "user" ? "-scale-x-100" : ""
              }`}
            />
          )}

          {/* Toggle Facing Mode Button */}
          {!capturedPhotoUrl && !error && (
            <button
              onClick={toggleCamera}
              title="Switch Camera"
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white backdrop-blur-md hover:bg-black/80 transition"
            >
              <ArrowsClockwise className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Controls Footer */}
        <div className="flex items-center justify-between bg-zinc-950 p-4">
          {capturedPhotoUrl ? (
            <>
              <Button
                variant="outline"
                onClick={handleRetake}
                className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
              >
                Retake
              </Button>
              <Button
                onClick={handleConfirm}
                className="bg-teal-600 font-medium text-white hover:bg-teal-500"
              >
                Use This Photo
              </Button>
            </>
          ) : (
            <div className="flex w-full items-center justify-center">
              <button
                onClick={takeSnapshot}
                disabled={Boolean(error)}
                className="group flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-teal-500 shadow-lg active:scale-95 disabled:opacity-50 transition"
              >
                <div className="h-12 w-12 rounded-full bg-white group-hover:scale-90 transition" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
