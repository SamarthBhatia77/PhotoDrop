import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { roomManager } from './rooms.js';
import type { SignalingMessage } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;

    for (const iface of ifaceList) {
      // IPv4 and not internal (i.e. not 127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prioritize Wi-Fi and common LAN IP patterns
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          addresses.unshift(iface.address);
        } else {
          addresses.push(iface.address);
        }
      }
    }
  }

  // Remove duplicates
  return Array.from(new Set(addresses));
}

import fs from 'fs';
import { spawn } from 'child_process';

let activeTunnelUrl = '';
let tunnelProcess: any = null;

function findCloudflared(): string | null {
  const possible = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ];
  for (const p of possible) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function startTunnel(port: number) {
  const bin = findCloudflared();
  if (!bin) return;

  try {
    tunnelProcess = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`]);
    const handleOutput = (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !activeTunnelUrl) {
        activeTunnelUrl = match[0];
        console.log(`\n========================================`);
        console.log(`⚡ iPhone Hotspot Tunnel Active!`);
        console.log(`🌐 Public URL: ${activeTunnelUrl}`);
        console.log(`========================================\n`);
      }
    };
    tunnelProcess.stdout?.on('data', handleOutput);
    tunnelProcess.stderr?.on('data', handleOutput);
  } catch (err) {
    console.warn('Failed to start cloudflared:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  startTunnel(PORT);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (e) {
      // Let other listeners handle or drop
    }
  });

  // API to get local network IP and tunnel information
  app.get('/api/network-info', (req, res) => {
    const ips = getLocalIpAddresses();
    const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || activeTunnelUrl || '';
    res.json({
      localIps: ips,
      port: PORT,
      primaryIp: ips[0] || 'localhost',
      tunnelUrl: publicUrl,
    });
  });

  // WebSocket signaling
  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (rawData: any) => {
      try {
        let msg: SignalingMessage;
        if (typeof rawData === 'string') {
          msg = JSON.parse(rawData);
        } else if (rawData instanceof Buffer) {
          msg = JSON.parse(rawData.toString('utf-8'));
        } else {
          return;
        }

        switch (msg.type) {
          case 'create_room': {
            const room = roomManager.createRoom(ws);
            const ips = getLocalIpAddresses();
            const response: SignalingMessage = {
              type: 'room_created',
              roomId: room.id,
              shortCode: room.shortCode,
              peerId: room.receiver?.id,
              payload: {
                localIps: ips,
                port: PORT,
                tunnelUrl: activeTunnelUrl,
              },
            };
            ws.send(JSON.stringify(response));
            break;
          }

          case 'join_room': {
            const roomIdOrCode = msg.roomId || msg.shortCode;
            if (!roomIdOrCode) {
              ws.send(JSON.stringify({ type: 'error', error: 'Missing room code' }));
              return;
            }

            const result = roomManager.joinRoom(roomIdOrCode, ws);
            if ('error' in result) {
              ws.send(JSON.stringify({ type: 'error', error: result.error }));
              return;
            }

            const { room, peerId } = result;
            // Notify joiner
            ws.send(
              JSON.stringify({
                type: 'room_joined',
                roomId: room.id,
                shortCode: room.shortCode,
                peerId: peerId,
                role: 'sender',
              })
            );

            // Notify laptop receiver that sender has joined
            if (room.receiver && room.receiver.socket.readyState === WebSocket.OPEN) {
              room.receiver.socket.send(
                JSON.stringify({
                  type: 'peer_joined',
                  roomId: room.id,
                  peerId: peerId,
                  role: 'sender',
                })
              );
            }
            break;
          }

          case 'webrtc_offer':
          case 'webrtc_answer':
          case 'ice_candidate':
          case 'relay_data': {
            // Forward signal directly to counterpart in room
            if (!msg.roomId) return;
            const room = roomManager.getRoom(msg.roomId);
            if (!room) return;

            roomManager.touch(room.id);

            // Determine destination: if sender sent, deliver to receiver; if receiver sent, deliver to sender
            let targetSocket: WebSocket | null = null;
            if (room.receiver && room.receiver.socket === ws) {
              targetSocket = room.sender?.socket || null;
            } else if (room.sender && room.sender.socket === ws) {
              targetSocket = room.receiver?.socket || null;
            }

            if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
              targetSocket.send(JSON.stringify(msg));
            }
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }
        }
      } catch (err: any) {
        console.error('Signaling message parse error:', err.message);
      }
    });

    ws.on('close', () => {
      const { room, disconnectedRole, peerId } = roomManager.handleDisconnect(ws);
      if (room) {
        const remainingSocket = disconnectedRole === 'receiver' ? room.sender?.socket : room.receiver?.socket;
        if (remainingSocket && remainingSocket.readyState === WebSocket.OPEN) {
          remainingSocket.send(
            JSON.stringify({
              type: 'peer_left',
              role: disconnectedRole,
              peerId: peerId,
            })
          );
        }
      }
    });
  });

  // Client routing / dev server middleware
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIpAddresses();
    console.log(`\n========================================`);
    console.log(`🚀 PhotoDrop Server Running!`);
    console.log(`💻 Laptop:    http://localhost:${PORT}`);
    if (ips.length > 0) {
      console.log(`📱 iPhone:    http://${ips[0]}:${PORT}`);
      for (let i = 1; i < ips.length; i++) {
        console.log(`   (Alt IP:   http://${ips[i]}:${PORT})`);
      }
    }
    console.log(`🔒 Zero-Cloud Mode: Active`);
    console.log(`========================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PhotoDrop server:', err);
  process.exit(1);
});
