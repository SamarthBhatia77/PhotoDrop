import { SignalingClient, SignalingMessage } from './signaling';

export type WebRTCConnectionState = 'idle' | 'connecting' | 'connected' | 'failed' | 'closed';

export interface WebRTCManagerOptions {
  signaling: SignalingClient;
  roomId: string;
  isInitiator: boolean;
  onStateChange: (state: WebRTCConnectionState) => void;
  onDataMessage: (data: string | ArrayBuffer) => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private options: WebRTCManagerOptions;
  private isClosed = false;
  private cleanupSignaling: Array<() => void> = [];
  private fallbackToRelay = false;
  private connectTimeoutTimer: any = null;

  private static ICE_SERVERS: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  constructor(options: WebRTCManagerOptions) {
    this.options = options;
    this.setupSignalingListeners();
  }

  private setupSignalingListeners() {
    const unsubOffer = this.options.signaling.on('webrtc_offer', async (msg: SignalingMessage) => {
      if (this.isClosed || !msg.sdp) return;
      try {
        await this.ensurePeerConnection();
        await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);

        this.options.signaling.send({
          type: 'webrtc_answer',
          roomId: this.options.roomId,
          sdp: answer,
        });
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    const unsubAnswer = this.options.signaling.on('webrtc_answer', async (msg: SignalingMessage) => {
      if (this.isClosed || !msg.sdp || !this.pc) return;
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    const unsubIce = this.options.signaling.on('ice_candidate', async (msg: SignalingMessage) => {
      if (this.isClosed || !msg.candidate || !this.pc) return;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (err) {
        console.warn('Could not add ICE candidate:', err);
      }
    });

    const unsubRelay = this.options.signaling.on('relay_data', (msg: SignalingMessage) => {
      if (msg.payload) {
        this.options.onDataMessage(msg.payload);
      }
    });

    this.cleanupSignaling = [unsubOffer, unsubAnswer, unsubIce, unsubRelay];
  }

  private async ensurePeerConnection(): Promise<RTCPeerConnection> {
    if (this.pc) return this.pc;

    const pc = new RTCPeerConnection(WebRTCManager.ICE_SERVERS);
    this.pc = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && !this.isClosed) {
        this.options.signaling.send({
          type: 'ice_candidate',
          roomId: this.options.roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
        this.options.onStateChange('connected');
      } else if (state === 'failed' || state === 'disconnected') {
        console.warn('WebRTC ICE state:', state);
        this.enableRelayFallback();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
        this.options.onStateChange('connected');
      } else if (pc.connectionState === 'failed') {
        this.enableRelayFallback();
      }
    };

    if (!this.options.isInitiator) {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }

    return pc;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
      this.options.onStateChange('connected');
    };

    channel.onclose = () => {
      if (!this.isClosed) {
        this.options.onStateChange('closed');
      }
    };

    channel.onerror = (err) => {
      console.warn('DataChannel error:', err);
      this.enableRelayFallback();
    };

    channel.onmessage = (event) => {
      this.options.onDataMessage(event.data);
    };
  }

  public async startNegotiation(): Promise<void> {
    if (this.isClosed) return;
    this.options.onStateChange('connecting');

    // 8 second timeout before enabling relay fallback
    this.connectTimeoutTimer = setTimeout(() => {
      if (!this.isConnected()) {
        console.warn('WebRTC direct connection timed out; enabling in-memory relay fallback');
        this.enableRelayFallback();
      }
    }, 8000);

    try {
      const pc = await this.ensurePeerConnection();

      if (this.options.isInitiator) {
        const dc = pc.createDataChannel('photodrop-transfer', { ordered: true });
        this.setupDataChannel(dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.options.signaling.send({
          type: 'webrtc_offer',
          roomId: this.options.roomId,
          sdp: offer,
        });
      }
    } catch (err) {
      console.error('Failed to start WebRTC negotiation:', err);
      this.enableRelayFallback();
    }
  }

  private enableRelayFallback() {
    this.fallbackToRelay = true;
    this.options.onStateChange('connected'); // relay operates via open WebSocket
  }

  public isConnected(): boolean {
    if (this.fallbackToRelay) return true;
    return (
      this.dataChannel !== null &&
      this.dataChannel.readyState === 'open' &&
      this.pc !== null &&
      (this.pc.connectionState === 'connected' || this.pc.iceConnectionState === 'connected')
    );
  }

  public isUsingRelay(): boolean {
    return this.fallbackToRelay;
  }

  public async sendData(data: string | ArrayBuffer): Promise<void> {
    if (this.isClosed) throw new Error('Connection closed');

    // If using direct WebRTC DataChannel
    if (!this.fallbackToRelay && this.dataChannel && this.dataChannel.readyState === 'open') {
      // Respect backpressure
      const HIGH_WATER_MARK = 64 * 1024;
      if (this.dataChannel.bufferedAmount > HIGH_WATER_MARK) {
        this.dataChannel.bufferedAmountLowThreshold = 16 * 1024;
        await new Promise<void>((resolve) => {
          const handler = () => {
            if (this.dataChannel) {
              this.dataChannel.removeEventListener('bufferedamountlow', handler);
            }
            resolve();
          };
          this.dataChannel!.addEventListener('bufferedamountlow', handler);
        });
      }

      this.dataChannel.send(data as any);
      return;
    }

    // Ephemeral WebSocket relay fallback
    if (typeof data === 'string') {
      this.options.signaling.send({
        type: 'relay_data',
        roomId: this.options.roomId,
        payload: data,
      });
    } else {
      // Convert ArrayBuffer to base64 for JSON transport over WebSocket
      const bytes = new Uint8Array(data);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      this.options.signaling.send({
        type: 'relay_data',
        roomId: this.options.roomId,
        payload: { __bin: true, base64 },
      });
    }
  }

  public close(): void {
    this.isClosed = true;
    if (this.connectTimeoutTimer) clearTimeout(this.connectTimeoutTimer);
    this.cleanupSignaling.forEach((fn) => fn());
    this.cleanupSignaling = [];

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.options.onStateChange('closed');
  }
}
