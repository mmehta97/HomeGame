'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import type { GameConfig } from '@/types';

const DEFAULT_CONFIG: GameConfig = {
  variant: 'nlh',
  smallBlind: 1,
  bigBlind: 2,
  minBuyIn: 0,
  maxBuyIn: 0,
  turnTimer: 30,
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

  const handleCreate = () => {
    setCreating(true);
    const socket = connectSocket();
    const doCreate = () => {
      socket.emit('room:create', DEFAULT_CONFIG, (roomId: string) => {
        router.push(`/game/${roomId}`);
      });
    };
    socket.on('connect', doCreate);
    if (socket.connected) doCreate();
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

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#1c2028]" />
          <span className="text-[11px] text-[#3d4350]">or paste a game link to join</span>
          <div className="flex-1 h-px bg-[#1c2028]" />
        </div>
      </div>
    </div>
  );
}
