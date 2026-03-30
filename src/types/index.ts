// ============================================================
// Shared types for HomeGame poker app
// ============================================================

export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandRankName =
  | 'Royal Flush'
  | 'Straight Flush'
  | 'Four of a Kind'
  | 'Full House'
  | 'Flush'
  | 'Straight'
  | 'Three of a Kind'
  | 'Two Pair'
  | 'One Pair'
  | 'High Card';

export interface HandResult {
  rank: number;
  name: HandRankName;
  value: number;
  cards: Card[];
  description: string;
}

export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export interface PlayerActionEvent {
  action: PlayerAction;
  amount?: number;
}

export type PlayerStatus =
  | 'waiting'
  | 'active'
  | 'folded'
  | 'all-in'
  | 'sitting-out';

export interface PlayerPreferences {
  autoStraddle: boolean;
  runItTwice: boolean;        // Player's preference for running it twice
  runItThrice: boolean;       // Player's preference for running it thrice
  autoTopUp: boolean;         // Auto top-up enabled
  autoTopUpTarget: number;    // Top up to this amount
  autoTopUpThreshold: number; // When chips fall below this, trigger top-up
  autoTopUpApproved: boolean; // Host has approved this player's auto top-up
}

export const DEFAULT_PREFERENCES: PlayerPreferences = {
  autoStraddle: false,
  runItTwice: false,
  runItThrice: false,
  autoTopUp: false,
  autoTopUpTarget: 0,
  autoTopUpThreshold: 0,
  autoTopUpApproved: false,
};

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  chips: number;
  bet: number;
  totalBet: number;
  holeCards: Card[];
  status: PlayerStatus;
  isConnected: boolean;
  lastAction?: PlayerAction;
  preferences: PlayerPreferences;
}

export interface PublicPlayer {
  id: string;
  name: string;
  seatIndex: number;
  chips: number;
  bet: number;
  totalBet: number;
  hasCards: boolean;
  status: PlayerStatus;
  isConnected: boolean;
  lastAction?: PlayerAction;
  holeCards?: Card[];
  preferences: PlayerPreferences;
}

export interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

export type GameVariant = 'nlh' | 'plo4' | 'plo5' | 'plo6';

export interface GameConfig {
  variant: GameVariant;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnTimer: number;
  autoFoldOnTimeout: boolean;
  allowStraddle: boolean;
  ante: number;
  bbAnte: boolean;
  runItTwice: boolean;
  maxPlayers: number;
}

export type GamePhase =
  | 'waiting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown';

export interface GameState {
  id: string;
  config: GameConfig;
  players: Player[];
  communityCards: Card[];
  deck: Card[];
  pots: Pot[];
  phase: GamePhase;
  dealerIndex: number;
  activePlayerIndex: number;
  currentBet: number;
  minRaise: number;
  lastRaiserIndex: number;
  handNumber: number;
  turnStartedAt: number;
  winners: WinResult[];
  handHistory: HandHistoryEntry[];
}

export interface WinResult {
  playerId: string;
  amount: number;
  hand?: HandResult;
  potIndex: number;
}

export interface HandHistoryEntry {
  handNumber: number;
  action: string;
  playerName?: string;
  amount?: number;
  cards?: Card[];
  timestamp: number;
}

// Ledger entry — tracks all buy-ins and results per player
export interface LedgerEntry {
  playerId: string;
  playerName: string;
  buyIns: number;        // Total chips bought in
  cashOut: number;       // Chips at cash-out (0 if still playing)
  netResult: number;     // cashOut - buyIns (or current chips - buyIns if still playing)
  handsPlayed: number;
  isActive: boolean;     // Still at the table
}

// What clients receive
export interface PublicGameState {
  id: string;
  config: GameConfig;
  players: PublicPlayer[];
  communityCards: Card[];
  pots: Pot[];
  phase: GamePhase;
  dealerIndex: number;
  activePlayerIndex: number;
  currentBet: number;
  minRaise: number;
  handNumber: number;
  turnStartedAt: number;
  winners: WinResult[];
  handHistory: HandHistoryEntry[];
  hostId: string;
  ledger: LedgerEntry[];
}

export interface RoomInfo {
  id: string;
  config: GameConfig;
  playerCount: number;
  maxPlayers: number;
  hostId: string;
  createdAt: number;
}

// Socket events
export interface JoinRequest {
  socketId: string;
  playerName: string;
  seatIndex: number;
  buyIn: number;
  timestamp: number;
}

export interface ServerToClientEvents {
  'game:state': (state: PublicGameState) => void;
  'game:action-required': (data: { playerId: string; timeRemaining: number; validActions: ValidAction[] }) => void;
  'game:winner': (winners: WinResult[]) => void;
  'game:error': (message: string) => void;
  'room:joined': (data: { roomId: string; playerId: string; seatIndex: number; isHost: boolean }) => void;
  'room:player-joined': (player: PublicPlayer) => void;
  'room:player-left': (playerId: string) => void;
  'room:info': (info: RoomInfo) => void;
  'room:join-request': (request: JoinRequest) => void;
  'room:join-denied': (reason: string) => void;
  'room:join-pending': () => void;
  'chat:message': (data: { playerName: string; message: string; timestamp: number }) => void;
}

export interface ClientToServerEvents {
  'room:create': (config: GameConfig, callback: (roomId: string) => void) => void;
  'room:join': (data: { roomId: string; playerName: string; seatIndex: number; buyIn: number }, callback: (success: boolean, error?: string) => void) => void;
  'room:info': (roomId: string) => void;
  'room:leave': () => void;
  'game:action': (action: PlayerActionEvent, callback: (success: boolean, error?: string) => void) => void;
  'game:start': () => void;
  'game:pause': () => void;
  'game:rebuy': (amount: number, callback: (success: boolean, error?: string) => void) => void;
  'game:update-config': (config: Partial<GameConfig>, callback: (success: boolean, error?: string) => void) => void;
  'game:update-stack': (data: { playerId: string; newStack: number }, callback: (success: boolean, error?: string) => void) => void;
  'player:update-preferences': (prefs: Partial<PlayerPreferences>, callback: (success: boolean, error?: string) => void) => void;
  'player:approve-topup': (playerId: string, callback: (success: boolean, error?: string) => void) => void;
  'room:approve-join': (socketId: string) => void;
  'room:deny-join': (socketId: string, reason?: string) => void;
  'chat:send': (message: string) => void;
}

export interface ValidAction {
  action: PlayerAction;
  minAmount?: number;
  maxAmount?: number;
}
