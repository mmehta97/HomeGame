'use client';

import { PublicPlayer, GamePhase } from '@/types';
import Card from './Card';

interface PlayerSeatProps {
  player?: PublicPlayer;
  position: number;      // Visual position (0=bottom center, clockwise)
  seatIndex: number;     // Actual seat index
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActive: boolean;
  isMe: boolean;
  phase: GamePhase;
  turnTimer: number;
  timeRemaining: number;
  onSelectSeat?: () => void;
  totalPositions: number;
  numHoleCards: number;  // 2 for NLH, 4 for PLO
}

// Visual positions around the table — position 0 is always bottom center (the player's seat)
function getVisualPosition(position: number, total: number): { top: string; left: string } {
  const positions: Record<number, [number, number][]> = {
    2: [[84, 50], [6, 50]],
    3: [[84, 50], [20, 10], [20, 90]],
    4: [[84, 50], [40, 4], [6, 50], [40, 96]],
    5: [[84, 50], [56, 3], [10, 15], [10, 85], [56, 97]],
    6: [[84, 50], [62, 3], [16, 8], [6, 50], [16, 92], [62, 97]],
    7: [[84, 50], [66, 2], [30, 2], [4, 26], [4, 74], [30, 98], [66, 98]],
    8: [[84, 50], [70, 2], [38, 1], [8, 16], [4, 50], [8, 84], [38, 99], [70, 98]],
    9: [[84, 50], [72, 3], [46, 1], [18, 6], [3, 30], [3, 70], [18, 94], [46, 99], [72, 97]],
  };
  const p = (positions[total] || positions[9])[position] || [50, 50];
  return { top: `${p[0]}%`, left: `${p[1]}%` };
}

export default function PlayerSeat({
  player, position, seatIndex, isDealer, isSmallBlind, isBigBlind,
  isActive, isMe, phase, turnTimer, timeRemaining, onSelectSeat, totalPositions, numHoleCards,
}: PlayerSeatProps) {
  const pos = getVisualPosition(position, totalPositions);
  const timerPct = turnTimer > 0 && isActive ? (timeRemaining / turnTimer) : 0;

  // Empty seat
  if (!player) {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={pos}>
        <button
          onClick={onSelectSeat}
          className="w-[76px] h-[34px] rounded-full border border-dashed border-[#262b33] bg-[#0e1015]/50 hover:border-[#22c55e]/50 hover:bg-[#0e1015]/80 transition-all text-[10px] text-[#3d4350] hover:text-[#22c55e]/70"
        >
          Seat {seatIndex + 1}
        </button>
      </div>
    );
  }

  const folded = player.status === 'folded';
  const allIn = player.status === 'all-in';

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={pos}>
      <div className={`flex flex-col items-center gap-[1px] ${folded ? 'opacity-35' : ''} ${!player.isConnected ? 'opacity-25' : ''}`}>
        {/* Hole cards */}
        {player.hasCards && (
          <div className="flex gap-[2px] mb-[-2px] z-20">
            {player.holeCards && player.holeCards.length > 0
              ? player.holeCards.map((c, i) => <Card key={i} card={c} size="sm" />)
              : Array.from({ length: numHoleCards }).map((_, i) => <Card key={i} faceDown size="sm" />)
            }
          </div>
        )}

        {/* Player box */}
        <div className={`relative min-w-[80px] rounded overflow-hidden ${isActive ? 'animate-pulse-ring' : ''}`}>
          {/* Timer bar */}
          {isActive && turnTimer > 0 && (
            <div className="h-[2px] bg-[#1c2028]">
              <div className="h-full transition-all duration-300 ease-linear" style={{
                width: `${timerPct * 100}%`,
                background: timerPct > 0.5 ? '#22c55e' : timerPct > 0.2 ? '#eab308' : '#ef4444',
              }} />
            </div>
          )}

          {/* Name */}
          <div className={`px-2 py-[3px] text-center text-[11px] font-semibold truncate max-w-[90px] ${
            isMe ? 'bg-[#1a2a1a] text-[#22c55e]' : 'bg-[#1c2028] text-[#d1d5db]'
          }`}>
            {player.name}
          </div>

          {/* Chips */}
          <div className="px-2 py-[2px] text-center bg-[#13161c]">
            <span className="text-[11px] font-bold text-[#eab308]">{player.chips.toLocaleString()}</span>
          </div>

          {/* Action / All-in label */}
          {(player.lastAction || allIn) && phase !== 'waiting' && (
            <div className="px-2 py-[1px] text-center bg-[#0e1015] border-t border-[#1c2028]">
              <span className={`text-[8px] font-bold uppercase tracking-wider ${
                (player.lastAction === 'fold') ? 'text-[#6b7280]' :
                (player.lastAction === 'raise' || player.lastAction === 'all-in' || allIn) ? 'text-[#ef4444]' :
                (player.lastAction === 'call') ? 'text-[#22c55e]' : 'text-[#3b82f6]'
              }`}>
                {allIn && !player.lastAction ? 'ALL IN' : player.lastAction === 'all-in' ? 'ALL IN' : player.lastAction}
              </span>
            </div>
          )}

          {/* Badges */}
          {isDealer && (
            <div className="absolute -right-2 -top-1 w-[16px] h-[16px] rounded-full bg-white text-[#0e1015] text-[8px] font-black flex items-center justify-center shadow z-30">D</div>
          )}
          {isSmallBlind && (
            <div className="absolute -left-2 -top-1 w-[16px] h-[16px] rounded-full bg-[#3b82f6] text-white text-[7px] font-bold flex items-center justify-center shadow z-30">SB</div>
          )}
          {isBigBlind && (
            <div className="absolute -left-2 -top-1 w-[16px] h-[16px] rounded-full bg-[#eab308] text-[#0e1015] text-[7px] font-bold flex items-center justify-center shadow z-30">BB</div>
          )}
        </div>

        {/* Bet chip */}
        {player.bet > 0 && (
          <div className="flex items-center gap-1 mt-[1px] animate-fade-in">
            <div className="w-[8px] h-[8px] rounded-full bg-gradient-to-b from-[#eab308] to-[#ca8a04] shadow-sm" />
            <span className="text-[10px] font-bold text-[#eab308]">{player.bet}</span>
          </div>
        )}
      </div>
    </div>
  );
}
