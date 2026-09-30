export interface SignalingMessage {
  type: string;
  roomId?: string;
  shortCode?: string;
  role?: 'receiver' | 'sender';
  peerId?: string;
  to?: string;
  sdp?: any;
  candidate?: any;
  payload?: any;
  error?: string;
}

export type MessageHandler = (msg: SignalingMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private isExplicitlyClosed = false;

  constructor(serverUrl?: string) {
    if (serverUrl) {
      this.url = serverUrl;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${protocol}//${loc.host}/ws`;
    }
  }

  public connect(): Promise<void> {
    this.isExplicitlyClosed = false;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.emit('open', { type: 'open' });
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: SignalingMessage = JSON.parse(event.data);
            this.emit(data.type, data);
            this.emit('*', data);
          } catch (e) {
            console.error('Failed to parse signaling message:', e);
          }
        };

        this.ws.onerror = (err) => {
          this.emit('error', { type: 'error', error: 'WebSocket error' });
        };

        this.ws.onclose = () => {
          this.stopHeartbeat();
          this.emit('close', { type: 'close' });
          if (!this.isExplicitlyClosed) {
            // Attempt auto reconnect after 2 seconds
            this.reconnectTimer = setTimeout(() => {
              this.connect().catch(() => {});
            }, 2000);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public send(msg: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  private emit(type: string, msg: SignalingMessage): void {
    const list = this.handlers.get(type);
    if (list) {
      list.forEach((fn) => {
        try {
          fn(msg);
        } catch (e) {
          console.error(`Error in signaling handler for ${type}:`, e);
        }
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
