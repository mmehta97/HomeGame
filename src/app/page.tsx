'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureConnected } from '@/lib/socket';
import type { GameConfig } from '@/types';

const DEFAULT_CONFIG: GameConfig = {
  variant: 'nlh',
  smallBlind: 1,
  bigBlind: 2,
  minBuyIn: 0,
  maxBuyIn: 0,
  turnTimer: 30,
  timeBank: 30,
  autoFoldOnTimeout: true,
  allowStraddle: false,
  ante: 0,
  bbAnte: false,
  runItTwice: false,
  maxPlayers: 9,
};

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      const socket = await ensureConnected();
      socket.emit('room:create', DEFAULT_CONFIG, (roomId: string) => {
        router.push(`/game/${roomId}`);
      });

      // Safety timeout — if room:create callback never fires
      setTimeout(() => {
        setCreating(false);
        setError('Server not responding. Try again.');
      }, 10000);
    } catch {
      setCreating(false);
      setError('Could not connect to server. Try again.');
    }
  };

  return (
    <div className="h-dvh flex flex-col items-center justify-center p-6" style={{ background: '#0e1015' }}>
      <div className="text-center space-y-8 max-w-xs w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-[#3b82f6]">Home</span><span className="text-white">Game</span>
          </h1>
          <p className="text-[#6b7280] text-[14px] mt-1">Texas Hold&apos;em with friends</p>
        </div>

        <button onClick={handleCreate} disabled={creating}
          className="w-full py-3 rounded font-bold text-[14px] text-white transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: creating ? '#1c2028' : '#1e40af', border: '1px solid rgba(59,130,246,0.3)' }}>
          {creating ? 'Creating...' : 'Create Game'}
        </button>

        {error && (
          <div className="rounded bg-[#ef4444]/10 border border-[#ef4444]/20 px-3 py-2 text-[12px] text-[#ef4444]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#1c2028]" />
          <span className="text-[11px] text-[#3d4350]">or paste a game link to join</span>
          <div className="flex-1 h-px bg-[#1c2028]" />
        </div>
      </div>
    </div>
  );
}
