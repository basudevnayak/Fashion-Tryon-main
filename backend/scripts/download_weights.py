#!/usr/bin/env python3
"""
Download all model weights required for FASHN VTON.

Usage:
    python scripts/download_weights.py --weights-dir ./models
"""

import argparse
import os
from huggingface_hub import hf_hub_download


def download_tryon_model(weights_dir: str) -> str:
    """Download TryOnModel weights from HuggingFace."""
    print("Downloading TryOnModel weights (model.safetensors)...")
    path = hf_hub_download(
        repo_id="fashn-ai/fashn-vton-1.5",
        filename="model.safetensors",
        local_dir=weights_dir,
    )
    print(f"  Saved to: {path}")
    return path


def download_dwpose_models(weights_dir: str) -> None:
    """Download DWPose ONNX models from HuggingFace."""
    dwpose_dir = os.path.join(weights_dir, "dwpose")
    os.makedirs(dwpose_dir, exist_ok=True)

    repo_id = "fashn-ai/DWPose"
    filenames = ["yolox_l.onnx", "dw-ll_ucoco_384.onnx"]

    for filename in filenames:
        print(f"Downloading DWPose model ({filename})...")
        path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=dwpose_dir,
        )
        print(f"  Saved to: {path}")


def main():
    parser = argparse.ArgumentParser(description="Download FASHN VTON model weights")
    parser.add_argument(
        "--weights-dir",
        type=str,
        default="./models",
        help="Directory to save weights (default: ./models)",
    )
    args = parser.parse_args()

    os.makedirs(args.weights_dir, exist_ok=True)
    download_tryon_model(args.weights_dir)
    download_dwpose_models(args.weights_dir)
    print("\nAll model weights downloaded successfully!")


if __name__ == "__main__":
    main()
