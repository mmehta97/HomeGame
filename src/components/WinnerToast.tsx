'use client';

import { WinResult, PublicPlayer } from '@/types';

interface WinnerToastProps {
  winners: WinResult[];
  players: PublicPlayer[];
}

export default function WinnerToast({ winners, players }: WinnerToastProps) {
  if (winners.length === 0) return null;

  return (
    <div className="fixed top-[50px] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 animate-winner-pop">
      {winners.map((w, i) => {
        const p = players.find(pl => pl.id === w.playerId);
        return (
          <div key={i} style={{
            borderRadius: 6, padding: '6px 16px', textAlign: 'center',
            background: '#1A1806', border: '1px solid rgba(234,179,8,0.2)',
            boxShadow: '0 4px 16px rgba(234,179,8,0.1)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EAB308' }}>{p?.name} wins {w.amount.toLocaleString()}</span>
            {w.hand && <span style={{ fontSize: 10, color: '#6B7280', marginLeft: 6 }}>{w.hand.description}</span>}
          </div>
        );
      })}
    </div>
  );
}
