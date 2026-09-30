export interface RoomInfo {
  roomId: string;
  shortCode: string;
  createdAt: number;
  lastActiveAt: number;
  receiverSocket: any | null;
  senderSocket: any | null;
}

export type SignalingMessageType =
  | 'create_room'
  | 'room_created'
  | 'join_room'
  | 'room_joined'
  | 'peer_joined'
  | 'peer_left'
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'ice_candidate'
  | 'relay_data'
  | 'ping'
  | 'pong'
  | 'error';

export interface SignalingMessage {
  type: SignalingMessageType;
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
