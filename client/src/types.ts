export type ConnectionState =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type CompressionPreset = 'balanced' | 'fast' | 'original';

export interface PhotoItem {
  id: string;
  name: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  blob?: Blob;
  objectUrl?: string;
  progress: number;
  status: 'pending' | 'compressing' | 'transferring' | 'completed' | 'failed';
  error?: string;
  speed?: string;
  receivedAt?: number;
  transferTimeMs?: number;
}

export interface RoomState {
  roomId: string;
  shortCode: string;
  role: 'receiver' | 'sender';
  peerConnected: boolean;
  localIps: string[];
  port: number;
}

export interface PhotoStartMeta {
  type: 'PHOTO_START';
  photoId: string;
  name: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  width?: number;
  height?: number;
  totalChunks: number;
  chunkSize: number;
}

export interface PhotoEndMeta {
  type: 'PHOTO_END';
  photoId: string;
}

export interface PhotoAckMeta {
  type: 'PHOTO_ACK';
  photoId: string;
  success: boolean;
}

export interface PhotoErrorMeta {
  type: 'PHOTO_ERROR';
  photoId: string;
  error: string;
}

export type TransferControlMessage = PhotoStartMeta | PhotoEndMeta | PhotoAckMeta | PhotoErrorMeta;
