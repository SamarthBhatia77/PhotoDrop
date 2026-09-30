import crypto from 'crypto';
import type { WebSocket } from 'ws';

function generateId(length: number): string {
  return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64url').slice(0, length);
}

export interface RoomPeer {
  id: string;
  socket: WebSocket;
  role: 'receiver' | 'sender';
  joinedAt: number;
}

export interface Room {
  id: string;
  shortCode: string;
  createdAt: number;
  lastActive: number;
  receiver: RoomPeer | null;
  sender: RoomPeer | null;
}

class RoomManager {
  private rooms = new Map<string, Room>();
  private shortCodeMap = new Map<string, string>(); // shortCode -> roomId
  private socketToRoom = new Map<WebSocket, { roomId: string; role: 'receiver' | 'sender' }>();
  private readonly INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Run cleanup interval every 2 minutes
    setInterval(() => this.cleanupExpiredRooms(), 2 * 60 * 1000);
  }

  private generateShortCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous chars like 0, O, 1, I
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // ensure unique
    if (this.shortCodeMap.has(code)) {
      return this.generateShortCode();
    }
    return code;
  }

  public createRoom(receiverSocket: WebSocket): Room {
    const id = generateId(10);
    const shortCode = this.generateShortCode();
    const now = Date.now();

    const peerId = 'rx_' + generateId(6);
    const receiver: RoomPeer = {
      id: peerId,
      socket: receiverSocket,
      role: 'receiver',
      joinedAt: now,
    };

    const room: Room = {
      id,
      shortCode,
      createdAt: now,
      lastActive: now,
      receiver,
      sender: null,
    };

    this.rooms.set(id, room);
    this.shortCodeMap.set(shortCode.toUpperCase(), id);
    this.socketToRoom.set(receiverSocket, { roomId: id, role: 'receiver' });

    return room;
  }

  public getRoom(roomIdOrCode: string): Room | undefined {
    const normalized = roomIdOrCode.trim();
    if (this.rooms.has(normalized)) {
      return this.rooms.get(normalized);
    }
    const mappedId = this.shortCodeMap.get(normalized.toUpperCase());
    if (mappedId && this.rooms.has(mappedId)) {
      return this.rooms.get(mappedId);
    }
    return undefined;
  }

  public joinRoom(roomIdOrCode: string, senderSocket: WebSocket): { room: Room; peerId: string } | { error: string } {
    const room = this.getRoom(roomIdOrCode);
    if (!room) {
      return { error: 'Room not found or expired. Please check the code or scan the QR again.' };
    }

    if (room.sender && room.sender.socket.readyState === 1 /* OPEN */) {
      return { error: 'This room already has an active phone connected. Please create a new room.' };
    }

    const peerId = 'tx_' + generateId(6);
    const sender: RoomPeer = {
      id: peerId,
      socket: senderSocket,
      role: 'sender',
      joinedAt: Date.now(),
    };

    room.sender = sender;
    room.lastActive = Date.now();
    this.socketToRoom.set(senderSocket, { roomId: room.id, role: 'sender' });

    return { room, peerId };
  }

  public handleDisconnect(socket: WebSocket): { room?: Room; disconnectedRole?: 'receiver' | 'sender'; peerId?: string } {
    const info = this.socketToRoom.get(socket);
    if (!info) return {};

    this.socketToRoom.delete(socket);
    const room = this.rooms.get(info.roomId);
    if (!room) return {};

    room.lastActive = Date.now();
    let disconnectedPeerId = '';

    if (info.role === 'receiver') {
      disconnectedPeerId = room.receiver?.id || '';
      room.receiver = null;
      // If receiver disconnected and no sender, remove room immediately
      if (!room.sender) {
        this.destroyRoom(room.id);
      }
    } else {
      disconnectedPeerId = room.sender?.id || '';
      room.sender = null;
    }

    return { room, disconnectedRole: info.role, peerId: disconnectedPeerId };
  }

  public touch(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActive = Date.now();
    }
  }

  public destroyRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      this.shortCodeMap.delete(room.shortCode.toUpperCase());
      this.rooms.delete(roomId);
    }
  }

  private cleanupExpiredRooms() {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      const isDead = (!room.receiver && !room.sender) || (now - room.lastActive > this.INACTIVITY_TIMEOUT_MS);
      if (isDead) {
        this.destroyRoom(id);
      }
    }
  }
}

export const roomManager = new RoomManager();
