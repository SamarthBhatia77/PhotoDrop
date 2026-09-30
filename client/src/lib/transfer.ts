import { WebRTCManager } from './webrtc';
import type { PhotoItem, PhotoStartMeta, TransferControlMessage } from '../types';

export const CHUNK_SIZE = 32 * 1024; // 32 KB chunks

export interface TransferCallbacks {
  onPhotoStart?: (meta: PhotoStartMeta) => void;
  onProgress?: (photoId: string, progress: number, speedText: string) => void;
  onPhotoComplete?: (photo: PhotoItem) => void;
  onError?: (photoId: string, error: string) => void;
}

export class PhotoTransferProtocol {
  private webrtc: WebRTCManager;
  private callbacks: TransferCallbacks;

  // Receiver active state
  private incomingMeta: PhotoStartMeta | null = null;
  private incomingChunks: ArrayBuffer[] = [];
  private receivedBytes = 0;
  private transferStartTime = 0;

  // Sender state
  private isSendingQueue = false;
  private cancelRequested = false;

  constructor(webrtc: WebRTCManager, callbacks: TransferCallbacks) {
    this.webrtc = webrtc;
    this.callbacks = callbacks;
  }

  public handleIncomingMessage(rawData: string | ArrayBuffer | any): void {
    // If incoming message is relay base64
    if (typeof rawData === 'object' && rawData !== null && rawData.__bin && typeof rawData.base64 === 'string') {
      const binStr = atob(rawData.base64);
      const len = binStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      this.handleChunk(bytes.buffer);
      return;
    }

    // Binary chunk (from WebRTC DataChannel)
    if (rawData instanceof ArrayBuffer) {
      this.handleChunk(rawData);
      return;
    }

    // Control message JSON string
    if (typeof rawData === 'string') {
      try {
        const msg: TransferControlMessage = JSON.parse(rawData);
        this.handleControlMessage(msg);
      } catch (err) {
        console.warn('Non-JSON control string received:', rawData);
      }
    }
  }

  private handleControlMessage(msg: TransferControlMessage) {
    switch (msg.type) {
      case 'PHOTO_START': {
        this.incomingMeta = msg;
        this.incomingChunks = [];
        this.receivedBytes = 0;
        this.transferStartTime = performance.now();
        this.callbacks.onPhotoStart?.(msg);
        break;
      }

      case 'PHOTO_END': {
        if (!this.incomingMeta) return;

        const totalBytes = this.incomingMeta.compressedSize;
        const blob = new Blob(this.incomingChunks, { type: this.incomingMeta.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const elapsedSec = Math.max((performance.now() - this.transferStartTime) / 1000, 0.05);
        const speedMBs = (totalBytes / (1024 * 1024) / elapsedSec).toFixed(1);

        const photo: PhotoItem = {
          id: this.incomingMeta.photoId,
          name: this.incomingMeta.name,
          originalSize: this.incomingMeta.originalSize,
          compressedSize: blob.size,
          mimeType: this.incomingMeta.mimeType,
          width: this.incomingMeta.width,
          height: this.incomingMeta.height,
          blob,
          objectUrl,
          progress: 100,
          status: 'completed',
          speed: `${speedMBs} MB/s`,
          receivedAt: Date.now(),
          transferTimeMs: Math.round(elapsedSec * 1000),
        };

        // Send ACK
        this.webrtc.sendData(
          JSON.stringify({
            type: 'PHOTO_ACK',
            photoId: photo.id,
            success: true,
          })
        );

        this.callbacks.onPhotoComplete?.(photo);

        // Reset buffer
        this.incomingMeta = null;
        this.incomingChunks = [];
        break;
      }

      case 'PHOTO_ACK': {
        // Dispatched to awaiting promise in sendQueue
        window.dispatchEvent(new CustomEvent('photodrop:ack', { detail: msg }));
        break;
      }

      case 'PHOTO_ERROR': {
        this.callbacks.onError?.(msg.photoId, msg.error);
        break;
      }
    }
  }

  private handleChunk(chunk: ArrayBuffer) {
    if (!this.incomingMeta) return;

    this.incomingChunks.push(chunk);
    this.receivedBytes += chunk.byteLength;

    const total = this.incomingMeta.compressedSize;
    const progress = Math.min(Math.round((this.receivedBytes / total) * 100), 99);

    const elapsed = Math.max((performance.now() - this.transferStartTime) / 1000, 0.01);
    const speedMBs = (this.receivedBytes / (1024 * 1024) / elapsed).toFixed(1);

    this.callbacks.onProgress?.(this.incomingMeta.photoId, progress, `${speedMBs} MB/s`);
  }

  public async sendPhoto(photo: PhotoItem, onProgress: (progress: number) => void): Promise<boolean> {
    if (!photo.blob) throw new Error('Photo blob missing');

    const totalBytes = photo.compressedSize || photo.blob.size;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    // Send PHOTO_START
    const startMeta: PhotoStartMeta = {
      type: 'PHOTO_START',
      photoId: photo.id,
      name: photo.name,
      mimeType: photo.mimeType,
      originalSize: photo.originalSize,
      compressedSize: totalBytes,
      width: photo.width,
      height: photo.height,
      totalChunks,
      chunkSize: CHUNK_SIZE,
    };

    await this.webrtc.sendData(JSON.stringify(startMeta));

    // Send chunks
    const arrayBuffer = await photo.blob.arrayBuffer();
    let offset = 0;
    let chunkIndex = 0;

    while (offset < totalBytes) {
      if (this.cancelRequested) {
        throw new Error('Transfer cancelled');
      }

      const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      await this.webrtc.sendData(chunk);

      offset += chunk.byteLength;
      chunkIndex++;

      const progress = Math.min(Math.round((offset / totalBytes) * 100), 99);
      onProgress(progress);
    }

    // Send PHOTO_END
    await this.webrtc.sendData(
      JSON.stringify({
        type: 'PHOTO_END',
        photoId: photo.id,
      })
    );

    // Await ACK from receiver (with 10-second timeout)
    const ackPromise = new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('photodrop:ack', handler);
        reject(new Error('Timeout waiting for receiver confirmation'));
      }, 10000);

      const handler = (e: any) => {
        if (e.detail?.photoId === photo.id) {
          clearTimeout(timeout);
          window.removeEventListener('photodrop:ack', handler);
          resolve(true);
        }
      };

      window.addEventListener('photodrop:ack', handler);
    });

    await ackPromise;
    onProgress(100);
    return true;
  }

  public cancel(): void {
    this.cancelRequested = true;
  }
}
