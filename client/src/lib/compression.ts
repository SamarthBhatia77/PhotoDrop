import type { CompressionPreset } from '../types';

export interface CompressionResult {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function calculateSavings(original: number, compressed: number): number {
  if (!original || original <= 0) return 0;
  const diff = original - compressed;
  if (diff <= 0) return 0;
  return Math.round((diff / original) * 100);
}

// Convert filename extension to .jpg if converted
function sanitizeFilename(originalName: string, targetExt = '.jpg'): string {
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot === -1) return `${originalName}${targetExt}`;
  const stem = originalName.substring(0, lastDot);
  return `${stem}${targetExt}`;
}

async function decodeImageToCanvas(file: File): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  // Check if file is HEIC/HEIF
  let workingBlob: Blob = file;
  const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif');

  if (isHeic) {
    try {
      // Test if native decode works first
      const testBmp = await createImageBitmap(file).catch(() => null);
      if (!testBmp) {
        // Fallback to heic2any
        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default || heic2anyModule;
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        });
        workingBlob = Array.isArray(converted) ? converted[0] : converted;
      } else {
        testBmp.close();
      }
    } catch (e) {
      console.warn('HEIC fallback decode attempted:', e);
    }
  }

  // Use createImageBitmap if available for high performance off-main-thread decoding
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(workingBlob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        return { canvas, width: canvas.width, height: canvas.height };
      }
    } catch {
      // fallback to Image
    }
  }

  // Standard Image element fallback
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(workingBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, width: canvas.width, height: canvas.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to decode image: ${file.name}`));
    };

    img.src = url;
  });
}

export async function compressImage(
  file: File,
  preset: CompressionPreset = 'balanced'
): Promise<CompressionResult> {
  const originalSize = file.size;

  // In original preset, if already a standard image, keep unmodified
  if (preset === 'original' && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
    return {
      blob: file,
      name: file.name,
      width: 0,
      height: 0,
      originalSize,
      compressedSize: originalSize,
      mimeType: file.type,
    };
  }

  const { canvas, width: origWidth, height: origHeight } = await decodeImageToCanvas(file);

  // Configuration based on preset
  let maxDimension = 2400; // default Balanced
  let quality = 0.82;

  if (preset === 'fast') {
    maxDimension = 1600;
    quality = 0.72;
  } else if (preset === 'original') {
    maxDimension = Math.max(origWidth, origHeight);
    quality = 0.95;
  }

  // Calculate target dimensions
  let targetWidth = origWidth;
  let targetHeight = origHeight;

  if (origWidth > maxDimension || origHeight > maxDimension) {
    if (origWidth >= origHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((origHeight * maxDimension) / origWidth);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((origWidth * maxDimension) / origHeight);
    }
  }

  // If resizing is needed, draw onto a resized canvas
  let outputCanvas = canvas;
  if (targetWidth !== origWidth || targetHeight !== origHeight) {
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;
    const ctx = resizedCanvas.getContext('2d', { alpha: false });
    if (ctx) {
      // Use high quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
      outputCanvas = resizedCanvas;
    }
  }

  // Convert to JPEG Blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      quality
    );
  });

  const outputName = sanitizeFilename(file.name, '.jpg');

  return {
    blob,
    name: outputName,
    width: targetWidth,
    height: targetHeight,
    originalSize,
    compressedSize: blob.size,
    mimeType: 'image/jpeg',
  };
}
