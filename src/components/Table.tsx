'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PublicGameState, WinResult } from '@/types';
import PlayerSeat from './PlayerSeat';
import Card from './Card';

interface ChipAnim {
  id: number;
  x: number;
  y: number;
}

interface TableProps {
  gameState: PublicGameState;
  myPlayerId: string | null;
  timeRemaining: number;
  onSelectSeat?: (seatIndex: number) => void;
  winners?: WinResult[];
}

/**
 * Rotate seat positions so that the current player (myPlayerId) is always
 * at visual position 0 (bottom center). Other seats rotate around relative.
 */
function getVisualPosition(actualSeatIndex: number, mySeatIndex: number | null, maxPlayers: number): number {
  if (mySeatIndex === null) return actualSeatIndex;
  // Shift so mySeatIndex maps to position 0
  return (actualSeatIndex - mySeatIndex + maxPlayers) % maxPlayers;
}

export default function Table({ gameState, myPlayerId, timeRemaining, onSelectSeat, winners = [] }: TableProps) {
  const { players, communityCards, pots, phase, dealerIndex, config, activePlayerIndex } = gameState;
  const [copied, setCopied] = useState(false);
  const [chipAnims, setChipAnims] = useState<ChipAnim[]>([]);
  const prevWinners = useRef<string>('');
  const tableRef = useRef<HTMLDivElement>(null);

  // Chip fly animation when winners change
  useEffect(() => {
    const winKey = winners.map(w => w.playerId + w.amount).join(',');
    if (winKey && winKey !== prevWinners.current && winners.length > 0) {
      prevWinners.current = winKey;
      // Create chip particles flying outward from center
      const chips: ChipAnim[] = [];
      for (let i = 0; i < Math.min(winners.length * 5, 12); i++) {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 40 + Math.random() * 60;
        chips.push({
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 20,
        });
      }
      setChipAnims(chips);
      setTimeout(() => setChipAnims([]), 1000);
    }
    if (winners.length === 0) prevWinners.current = '';
  }, [winners]);
  const prevCardCount = useRef(0);
  const [newCardStart, setNewCardStart] = useState(-1); // index where new cards begin

  useEffect(() => {
    const curr = communityCards.length;
    const prev = prevCardCount.current;
    if (curr > prev && curr > 0) {
      setNewCardStart(prev); // cards from prev..curr are new
      // Clear animation class after animation completes
      const timeout = setTimeout(() => setNewCardStart(-1), 1200);
      prevCardCount.current = curr;
      return () => clearTimeout(timeout);
    }
    if (curr === 0) {
      prevCardCount.current = 0;
      setNewCardStart(-1);
    }
  }, [communityCards.length]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const myPlayer = players.find(p => p.id === myPlayerId);
  const mySeatIndex = myPlayer?.seatIndex ?? null;

  // SB/BB calculation
  const inHand = players.filter(p => p.hasCards || p.status === 'all-in');
  let sbSeat = -1, bbSeat = -1;
  if (dealerIndex >= 0 && inHand.length >= 2) {
    const seats = inHand.map(p => p.seatIndex).sort((a, b) => a - b);
    const dealerPos = seats.indexOf(dealerIndex);
    if (dealerPos !== -1) {
      if (inHand.length === 2) {
        sbSeat = dealerIndex;
        bbSeat = seats[(dealerPos + 1) % seats.length];
      } else {
        sbSeat = seats[(dealerPos + 1) % seats.length];
        bbSeat = seats[(dealerPos + 2) % seats.length];
      }
    }
  }

  const potTotal = pots.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="relative w-full max-w-[780px] mx-auto" style={{ aspectRatio: '16 / 9' }}>
      {/* Table surface */}
      <div className="absolute inset-[7%] rounded-[50%]"
        style={{
          background: 'linear-gradient(180deg, #1a1a22 0%, #12121a 100%)',
          boxShadow: '0 0 0 4px #262b33, 0 0 0 6px #1a1e25, 0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Blue felt */}
        <div className="absolute inset-[3px] rounded-[50%] overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, #1e4976 0%, #173d66 30%, #123358 60%, #0e2845 100%)' }}
        >
          {/* Subtle inner line */}
          <div className="absolute inset-[6%] rounded-[50%] border border-white/[0.04]" />

          {/* HomeGame watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className="text-[3.5vw] font-bold tracking-[0.15em] text-white/[0.06] uppercase">HomeGame</span>
          </div>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {/* Community cards */}
            {phase !== 'waiting' && (
              <div className="flex gap-[5px]">
                {communityCards.map((card, i) => {
                  const isNew = newCardStart >= 0 && i >= newCardStart;
                  const isFlop = newCardStart === 0 && i < 3;
                  const isTurnOrRiver = newCardStart >= 3;
                  const animClass = isNew ? (isFlop ? 'card-peel' : 'card-flip') : '';
                  const delay = isFlop ? `${(i - newCardStart) * 0.3}s` : '0s';
                  return (
                    <Card key={i} card={card} size="md"
                      className={animClass}
                      style={isNew ? { animationDelay: delay } : undefined}
                    />
                  );
                })}
                {communityCards.length < 5 &&
                  Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                    <div key={`e${i}`} className="w-[50px] h-[70px] rounded-md border border-white/[0.06]" />
                  ))
                }
              </div>
            )}

            {/* Pot */}
            {potTotal > 0 && (
              <div className="flex items-center gap-1.5 bg-black/30 rounded-full px-3 py-0.5 backdrop-blur-sm">
                <div className="w-[7px] h-[7px] rounded-full bg-gradient-to-b from-[#eab308] to-[#ca8a04]" />
                <span className="text-[12px] font-bold text-white">{potTotal.toLocaleString()}</span>
              </div>
            )}

            {pots.length > 1 && (
              <div className="flex gap-1.5 flex-wrap justify-center">
                {pots.map((pot, i) => (
                  <span key={i} className="text-[9px] text-white/40 bg-black/20 rounded-full px-2 py-0.5">
                    {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount}
                  </span>
                ))}
              </div>
            )}

            {/* Chip fly animation */}
            {chipAnims.length > 0 && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {chipAnims.map(c => (
                  <div key={c.id} className="absolute chip-fly"
                    style={{
                      '--fly-x': `${c.x}px`,
                      '--fly-y': `${c.y}px`,
                      animationDelay: `${c.id * 0.04}s`,
                    } as React.CSSProperties}
                  >
                    <div className="w-[10px] h-[10px] rounded-full bg-gradient-to-b from-[#eab308] to-[#ca8a04] shadow-md shadow-yellow-500/30" />
                  </div>
                ))}
              </div>
            )}

            {phase === 'waiting' && (
              <div className="flex flex-col items-center gap-2">
                <div className="text-white/30 text-[12px]">
                  {players.length < 2 ? 'Waiting for players...' : 'Ready to deal'}
                </div>
                {myPlayerId && (
                  <button onClick={copyLink}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-[13px] font-semibold text-white/70 hover:text-white transition-all active:scale-[0.97]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    {copied ? 'Copied!' : 'Copy invite link'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seats — rotated so player is always at bottom */}
      {Array.from({ length: config.maxPlayers }).map((_, seatIdx) => {
        const player = players.find(p => p.seatIndex === seatIdx);
        const visualPos = getVisualPosition(seatIdx, mySeatIndex, config.maxPlayers);

        return (
          <PlayerSeat
            key={seatIdx}
            player={player}
            position={visualPos}
            seatIndex={seatIdx}
            isDealer={dealerIndex === seatIdx}
            isSmallBlind={sbSeat === seatIdx}
            isBigBlind={bbSeat === seatIdx}
            isActive={activePlayerIndex === seatIdx}
            isMe={player?.id === myPlayerId}
            phase={phase}
            turnTimer={config.turnTimer}
            timeRemaining={activePlayerIndex === seatIdx ? timeRemaining : 0}
            onSelectSeat={() => onSelectSeat?.(seatIdx)}
            totalPositions={config.maxPlayers}
            numHoleCards={{ nlh: 2, plo4: 4, plo5: 5, plo6: 6 }[config.variant] || 2}
          />
        );
      })}
    </div>
  );
}
