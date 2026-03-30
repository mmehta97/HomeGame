// Analytics tracking — in-memory for now, can be persisted to DB later

export interface AnalyticsEvent {
  type: 'table_created' | 'player_joined' | 'player_left' | 'hand_started' | 'hand_completed';
  roomId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface TableSnapshot {
  roomId: string;
  variant: string;
  blinds: string;
  playerCount: number;
  maxPlayers: number;
  handsPlayed: number;
  createdAt: number;
  players: { name: string; chips: number }[];
}

export interface AnalyticsStats {
  activeTables: number;
  totalPlayers: number;
  totalTablesCreated: number;
  totalHandsPlayed: number;
  totalPlayersJoined: number;
  serverUptime: number;
  tables: TableSnapshot[];
  recentEvents: AnalyticsEvent[];
}

const events: AnalyticsEvent[] = [];
const counters = {
  tablesCreated: 0,
  handsPlayed: 0,
  playersJoined: 0,
};
const serverStartTime = Date.now();

export function trackEvent(event: AnalyticsEvent): void {
  events.push(event);
  // Keep last 1000 events in memory
  if (events.length > 1000) events.splice(0, events.length - 1000);

  switch (event.type) {
    case 'table_created': counters.tablesCreated++; break;
    case 'hand_started': counters.handsPlayed++; break;
    case 'player_joined': counters.playersJoined++; break;
  }
}

export function getStats(tables: TableSnapshot[]): AnalyticsStats {
  return {
    activeTables: tables.length,
    totalPlayers: tables.reduce((s, t) => s + t.playerCount, 0),
    totalTablesCreated: counters.tablesCreated,
    totalHandsPlayed: counters.handsPlayed,
    totalPlayersJoined: counters.playersJoined,
    serverUptime: Date.now() - serverStartTime,
    tables,
    recentEvents: events.slice(-50).reverse(),
  };
}
