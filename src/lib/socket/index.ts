import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    console.log('[Socket] Connecting to:', url);
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
    });

    socket.on('connect', () => console.log('[Socket] Connected:', socket?.id));
    socket.on('connect_error', (err) => console.error('[Socket] Connection error:', err.message));
    socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
  }
  return socket;
}

export function connectSocket(): GameSocket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Returns a promise that resolves when socket is connected */
export function ensureConnected(): Promise<GameSocket> {
  const s = connectSocket();
  if (s.connected) return Promise.resolve(s);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      s.off('connect', onConnect);
      reject(new Error('Connection timeout'));
    }, 8000);

    const onConnect = () => {
      clearTimeout(timeout);
      resolve(s);
    };
    s.once('connect', onConnect);
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect();
}
