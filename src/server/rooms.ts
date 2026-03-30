import { GameState, GameConfig, LedgerEntry, JoinRequest } from '../types';
import { createGameState } from '../lib/engine';

function generateRoomId(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface Room {
  id: string;
  gameState: GameState;
  hostId: string;               // playerId of the host (not socket ID)
  playerSocketMap: Map<string, string>; // socketId -> playerId
  turnTimer: ReturnType<typeof setTimeout> | null;
  nextHandTimer: ReturnType<typeof setTimeout> | null;
  ledger: Map<string, LedgerEntry>;    // playerId -> ledger
  pendingJoins: Map<string, JoinRequest>; // socketId -> join request
  createdAt: number;
}

const rooms = new Map<string, Room>();

export function createRoom(config: GameConfig, hostSocketId: string): Room {
  const roomId = generateRoomId(6);
  const gameState = createGameState(roomId, config);

  const room: Room = {
    id: roomId,
    gameState,
    hostId: hostSocketId,  // Will be updated to playerId on first join
    playerSocketMap: new Map(),
    turnTimer: null,
    nextHandTimer: null,
    ledger: new Map(),
    pendingJoins: new Map(),
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    if (room.nextHandTimer) clearTimeout(room.nextHandTimer);
    rooms.delete(roomId);
  }
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}

export function getRoomBySocketId(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.playerSocketMap.has(socketId)) return room;
  }
  return undefined;
}

export function updateLedger(room: Room, playerId: string, playerName: string, buyInAmount: number): void {
  const existing = room.ledger.get(playerId);
  if (existing) {
    existing.buyIns += buyInAmount;
    existing.playerName = playerName;
    existing.isActive = true;
  } else {
    room.ledger.set(playerId, {
      playerId,
      playerName,
      buyIns: buyInAmount,
      cashOut: 0,
      netResult: 0,
      handsPlayed: 0,
      isActive: true,
    });
  }
}

export function getLedgerEntries(room: Room): LedgerEntry[] {
  // Update net results for active players based on current chips
  const entries = Array.from(room.ledger.values()).map(e => {
    if (e.isActive) {
      const player = room.gameState.players.find(p => p.id === e.playerId);
      const currentChips = player ? player.chips : 0;
      return { ...e, netResult: currentChips - e.buyIns };
    }
    return { ...e, netResult: e.cashOut - e.buyIns };
  });
  return entries;
}
