import { create } from 'zustand';
import type { PublicGameState, ValidAction, PublicPlayer } from '@/types';

interface GameStore {
  isConnected: boolean;
  roomId: string | null;
  playerId: string | null;
  playerName: string | null;
  seatIndex: number | null;
  isHost: boolean;

  gameState: PublicGameState | null;
  validActions: ValidAction[];
  timeRemaining: number;

  // UI panels — only one open at a time
  activePanel: 'none' | 'log' | 'ledger' | 'settings' | 'prefs';

  setConnected: (connected: boolean) => void;
  setRoom: (roomId: string, playerId: string, seatIndex: number, isHost: boolean) => void;
  setPlayerName: (name: string) => void;
  setGameState: (state: PublicGameState) => void;
  setValidActions: (actions: ValidAction[]) => void;
  setTimeRemaining: (time: number) => void;
  setActivePanel: (panel: 'none' | 'log' | 'ledger' | 'settings') => void;
  togglePanel: (panel: 'log' | 'ledger' | 'settings' | 'prefs') => void;
  reset: () => void;

  currentPlayer: () => PublicPlayer | null;
  isMyTurn: () => boolean;
}

const useGameStore = create<GameStore>((set, get) => ({
  isConnected: false,
  roomId: null,
  playerId: null,
  playerName: null,
  seatIndex: null,
  isHost: false,
  gameState: null,
  validActions: [],
  timeRemaining: 0,
  activePanel: 'none',

  setConnected: (isConnected) => set({ isConnected }),
  setRoom: (roomId, playerId, seatIndex, isHost) => set({ roomId, playerId, seatIndex, isHost }),
  setPlayerName: (playerName) => set({ playerName }),
  setGameState: (gameState) => {
    const { playerId } = get();
    set({ gameState, isHost: gameState.hostId === playerId });
  },
  setValidActions: (validActions) => set({ validActions }),
  setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
  setActivePanel: (activePanel) => set({ activePanel }),
  togglePanel: (panel) => set(s => ({ activePanel: s.activePanel === panel ? 'none' : panel })),
  reset: () => set({
    isConnected: false, roomId: null, playerId: null, playerName: null,
    seatIndex: null, isHost: false, gameState: null, validActions: [], timeRemaining: 0, activePanel: 'none',
  }),

  currentPlayer: () => {
    const { gameState, playerId } = get();
    return gameState?.players.find(p => p.id === playerId) ?? null;
  },
  isMyTurn: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return false;
    const me = gameState.players.find(p => p.id === playerId);
    return me?.seatIndex === gameState.activePlayerIndex && me?.status === 'active';
  },
}));

export default useGameStore;
