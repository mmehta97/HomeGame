'use client';

import { useEffect, useState } from 'react';

interface TableInfo {
  roomId: string;
  variant: string;
  blinds: string;
  playerCount: number;
  maxPlayers: number;
  handsPlayed: number;
  createdAt: number;
  players: { name: string; chips: number }[];
}

interface Stats {
  activeTables: number;
  totalPlayers: number;
  totalTablesCreated: number;
  totalHandsPlayed: number;
  totalPlayersJoined: number;
  serverUptime: number;
  tables: TableInfo[];
  recentEvents: { type: string; roomId: string; timestamp: number; data?: Record<string, unknown> }[];
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAge(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
      const res = await fetch(`${url}/api/admin/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-6" style={{ background: '#0e1015', overflow: 'auto' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              <span className="text-[#3b82f6]">Home</span>Game <span className="text-[#6b7280] text-[14px] font-normal">Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#3d4350]">Auto-refreshes every 5s</span>
            <button onClick={fetchStats} className="px-3 py-1 rounded text-[11px] font-medium text-[#6b7280] bg-[#1c2028] border border-[#262b33]">
              Refresh
            </button>
          </div>
        </div>

        {loading && <div className="text-[#6b7280] text-[13px]">Loading...</div>}
        {error && <div className="rounded bg-[#ef4444]/10 border border-[#ef4444]/20 px-3 py-2 text-[12px] text-[#ef4444]">{error}</div>}

        {stats && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Active Tables', value: stats.activeTables, color: '#3b82f6' },
                { label: 'Players Online', value: stats.totalPlayers, color: '#22c55e' },
                { label: 'Tables Created', value: stats.totalTablesCreated, color: '#6b7280' },
                { label: 'Hands Played', value: stats.totalHandsPlayed, color: '#eab308' },
                { label: 'Uptime', value: formatUptime(stats.serverUptime), color: '#6b7280' },
              ].map(card => (
                <div key={card.label} className="rounded-lg bg-[#161a21] border border-[#1c2028] p-3">
                  <div className="text-[10px] text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                  <div className="text-[20px] font-bold mt-1" style={{ color: card.color }}>
                    {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Active tables */}
            <div className="rounded-lg bg-[#161a21] border border-[#1c2028] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1c2028]">
                <span className="text-[13px] font-semibold text-white">Active Tables</span>
                <span className="text-[11px] text-[#6b7280] ml-2">({stats.tables.length})</span>
              </div>
              {stats.tables.length === 0 ? (
                <div className="px-4 py-6 text-[12px] text-[#3d4350] text-center">No active tables</div>
              ) : (
                <div className="divide-y divide-[#1c2028]">
                  {stats.tables.map(t => (
                    <div key={t.roomId} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[12px] text-[#3b82f6]">{t.roomId}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1c2028] text-[#6b7280]">{t.variant.toUpperCase()}</span>
                          <span className="text-[11px] text-[#6b7280]">{t.blinds}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#6b7280]">
                          <span>{t.playerCount}/{t.maxPlayers} players</span>
                          <span>{t.handsPlayed} hands</span>
                          <span>Created {formatAge(t.createdAt)}</span>
                        </div>
                      </div>
                      {t.players.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {t.players.map((p, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#0e1015] border border-[#262b33] text-[#d1d5db]">
                              {p.name} <span className="text-[#eab308]">{p.chips}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent events */}
            <div className="rounded-lg bg-[#161a21] border border-[#1c2028] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1c2028]">
                <span className="text-[13px] font-semibold text-white">Recent Events</span>
                <span className="text-[11px] text-[#6b7280] ml-2">(last 50)</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {stats.recentEvents.length === 0 ? (
                  <div className="px-4 py-6 text-[12px] text-[#3d4350] text-center">No events yet</div>
                ) : (
                  <div className="divide-y divide-[#1c2028]">
                    {stats.recentEvents.map((ev, i) => (
                      <div key={i} className="px-4 py-2 flex items-center gap-3">
                        <span className="text-[10px] text-[#3d4350] font-mono w-[65px] shrink-0">{formatTime(ev.timestamp)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          ev.type === 'table_created' ? 'bg-[#1e40af20] text-[#3b82f6]' :
                          ev.type === 'player_joined' ? 'bg-[#16a34a20] text-[#22c55e]' :
                          ev.type === 'hand_started' ? 'bg-[#eab30820] text-[#eab308]' :
                          'bg-[#1c2028] text-[#6b7280]'
                        }`}>
                          {ev.type.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-[#6b7280]">{ev.roomId}</span>
                        {ev.data && (
                          <span className="text-[10px] text-[#3d4350]">
                            {Object.entries(ev.data).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
