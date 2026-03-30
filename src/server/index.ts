import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server } from 'socket.io';
import { registerHandlers } from './handlers';
import { ClientToServerEvents, ServerToClientEvents } from '../types';
import { getStats, TableSnapshot } from './analytics';
import { getAllRooms } from './rooms';

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS for admin API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  if (req.url === '/api/admin/stats') {
    // Check admin key if set
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${adminKey}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    const rooms = getAllRooms();
    const tables: TableSnapshot[] = [];
    for (const [, room] of rooms) {
      tables.push({
        roomId: room.id,
        variant: room.gameState.config.variant,
        blinds: `${room.gameState.config.smallBlind}/${room.gameState.config.bigBlind}`,
        playerCount: room.gameState.players.length,
        maxPlayers: room.gameState.config.maxPlayers,
        handsPlayed: room.gameState.handNumber,
        createdAt: room.createdAt,
        players: room.gameState.players.map(p => ({ name: p.name, chips: p.chips })),
      });
    }

    const stats = getStats(tables);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

const httpServer = createServer(handleRequest);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  registerHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
