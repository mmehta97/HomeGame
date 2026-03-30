'use client';

import { WinResult, PublicPlayer } from '@/types';

interface WinnerToastProps {
  winners: WinResult[];
  players: PublicPlayer[];
}

export default function WinnerToast({ winners, players }: WinnerToastProps) {
  if (winners.length === 0) return null;

  return (
    <div className="fixed top-[52px] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 animate-winner-pop">
      {winners.map((w, i) => {
        const player = players.find(p => p.id === w.playerId);
        return (
          <div key={i} className="rounded px-4 py-2 text-center bg-[#1c1a08] border border-[#eab308]/20 shadow-lg shadow-[#eab308]/10">
            <span className="text-[12px] font-bold text-[#eab308]">{player?.name} wins {w.amount.toLocaleString()}</span>
            {w.hand && <span className="text-[10px] text-[#6b7280] ml-2">{w.hand.description}</span>}
          </div>
        );
      })}
    </div>
  );
}
