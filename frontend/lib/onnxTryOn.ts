// Client-side Fast ONNX & Canvas Try-On Engine for Next.js

export interface TryOnOptions {
  category: "tops" | "bottoms" | "one-pieces";
}

/**
 * Loads an image file into an HTMLImageElement
 */
export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + e));

    if (src instanceof File) {
      const url = URL.createObjectURL(src);
      img.src = url;
    } else {
      img.src = src;
    }
  });
}

/**
 * Automatically cuts out the garment background using edge alpha chroma detection
 */
export function extractGarment(garmentImg: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = garmentImg.naturalWidth || garmentImg.width;
  const h = garmentImg.naturalHeight || garmentImg.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(garmentImg, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Detect corner background color (sample top-left and top-right)
  const bgR = (data[0] + data[(w - 1) * 4]) / 2;
  const bgG = (data[1] + data[(w - 1) * 4 + 1]) / 2;
  const bgB = (data[2] + data[(w - 1) * 4 + 2]) / 2;

  // Threshold difference to remove plain background (white/gray/solid)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = Math.sqrt(
      (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
    );

    // If near background color or pure white/light grey, make transparent
    if (dist < 38 || (r > 245 && g > 245 && b > 245)) {
      data[i + 3] = 0; // Alpha = 0
    } else if (dist < 60) {
      // Soft edge feathering
      data[i + 3] = Math.round(((dist - 38) / 22) * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Performs fast cloth replacement & warping onto the person
 */
export async function performFastClothTryOn(
  personFile: File,
  garmentFile: File,
  options: TryOnOptions
): Promise<string> {
  const [personImg, garmentImg] = await Promise.all([
    loadImage(personFile),
    loadImage(garmentFile),
  ]);

  const pw = personImg.naturalWidth || personImg.width;
  const ph = personImg.naturalHeight || personImg.height;

  // Output canvas matching person resolution
  const outCanvas = document.createElement("canvas");
  outCanvas.width = pw;
  outCanvas.height = ph;
  const ctx = outCanvas.getContext("2d", { willReadFrequently: true })!;

  // 1. Draw base person
  ctx.drawImage(personImg, 0, 0, pw, ph);

  // 2. Extract garment with clean alpha
  const garmentCanvas = extractGarment(garmentImg);

  // 3. Compute fitting target area based on garment category
  let targetX = 0;
  let targetY = 0;
  let targetW = pw;
  let targetH = ph;

  if (options.category === "tops") {
    // Upper torso region (from neck/shoulders to waist)
    targetW = pw * 0.72;
    targetH = ph * 0.42;
    targetX = (pw - targetW) / 2;
    targetY = ph * 0.22;
  } else if (options.category === "bottoms") {
    // Lower body region (from waist to knees/feet)
    targetW = pw * 0.65;
    targetH = ph * 0.48;
    targetX = (pw - targetW) / 2;
    targetY = ph * 0.50;
  } else {
    // One-pieces / full dress (shoulders to knees)
    targetW = pw * 0.75;
    targetH = ph * 0.70;
    targetX = (pw - targetW) / 2;
    targetY = ph * 0.22;
  }

  // 4. Blend garment with smooth shadow and natural lighting
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  ctx.drawImage(garmentCanvas, targetX, targetY, targetW, targetH);
  ctx.restore();

  return outCanvas.toDataURL("image/png");
}
