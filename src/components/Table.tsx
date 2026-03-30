'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PublicGameState, WinResult } from '@/types';
import PlayerSeat from './PlayerSeat';
import Card from './Card';

interface ChipAnim { id: number; x: number; y: number }

interface TableProps {
  gameState: PublicGameState;
  myPlayerId: string | null;
  timeRemaining: number;
  onSelectSeat?: (seatIndex: number) => void;
  winners?: WinResult[];
}

function getVisualPos(seat: number, mySeat: number | null, max: number): number {
  if (mySeat === null) return seat;
  return (seat - mySeat + max) % max;
}

export default function Table({ gameState, myPlayerId, timeRemaining, onSelectSeat, winners = [] }: TableProps) {
  const { players, communityCards, pots, phase, dealerIndex, config, activePlayerIndex } = gameState;
  const [copied, setCopied] = useState(false);
  const prevCardCount = useRef(0);
  const [newCardStart, setNewCardStart] = useState(-1);
  const [chipAnims, setChipAnims] = useState<ChipAnim[]>([]);
  const prevWinners = useRef('');
  const prevPhase = useRef(phase);
  const [showSweep, setShowSweep] = useState(false);

  // Card animation
  useEffect(() => {
    const curr = communityCards.length, prev = prevCardCount.current;
    if (curr > prev && curr > 0) {
      setNewCardStart(prev);
      const t = setTimeout(() => setNewCardStart(-1), 1200);
      prevCardCount.current = curr;
      return () => clearTimeout(t);
    }
    if (curr === 0) { prevCardCount.current = 0; setNewCardStart(-1); }
  }, [communityCards.length]);

  // Pot sweep animation — when phase advances (bets collected into pot)
  useEffect(() => {
    if (phase !== prevPhase.current) {
      const wasActive = ['preflop', 'flop', 'turn', 'river'].includes(prevPhase.current);
      const isNext = ['flop', 'turn', 'river', 'showdown'].includes(phase);
      if (wasActive && isNext) {
        setShowSweep(true);
        setTimeout(() => setShowSweep(false), 500);
      }
      prevPhase.current = phase;
    }
  }, [phase]);

  // Win chip animation
  useEffect(() => {
    const k = winners.map(w => w.playerId + w.amount).join(',');
    if (k && k !== prevWinners.current && winners.length > 0) {
      prevWinners.current = k;
      const chips: ChipAnim[] = [];
      for (let i = 0; i < Math.min(winners.length * 5, 12); i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
        chips.push({ id: i, x: Math.cos(a) * (40 + Math.random() * 60), y: Math.sin(a) * (30 + Math.random() * 40) - 20 });
      }
      setChipAnims(chips);
      setTimeout(() => setChipAnims([]), 1000);
    }
    if (winners.length === 0) prevWinners.current = '';
  }, [winners]);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const myPlayer = players.find(p => p.id === myPlayerId);
  const mySeat = myPlayer?.seatIndex ?? null;

  // SB/BB calc
  const inHand = players.filter(p => p.hasCards || p.status === 'all-in');
  let sbSeat = -1, bbSeat = -1;
  if (dealerIndex >= 0 && inHand.length >= 2) {
    const seats = inHand.map(p => p.seatIndex).sort((a, b) => a - b);
    const di = seats.indexOf(dealerIndex);
    if (di !== -1) {
      if (inHand.length === 2) { sbSeat = dealerIndex; bbSeat = seats[(di + 1) % seats.length]; }
      else { sbSeat = seats[(di + 1) % seats.length]; bbSeat = seats[(di + 2) % seats.length]; }
    }
  }

  // Pot: committed pot (from pots array) vs current round bets
  const committedPot = pots.reduce((s, p) => s + p.amount, 0);
  const currentBets = players.reduce((s, p) => s + p.bet, 0);
  const totalPot = committedPot + currentBets;

  return (
    <div className="relative w-full max-w-[780px] mx-auto" style={{ aspectRatio: '16 / 9' }}>
      {/* Table rail */}
      <div className="absolute inset-[7%] rounded-[50%]" style={{
        background: 'linear-gradient(180deg, #1F2130 0%, #181A28 100%)',
        boxShadow: '0 0 0 3px #2A2D3A, 0 10px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Felt */}
        <div className="absolute inset-[3px] rounded-[50%] overflow-hidden" style={{
          background: 'radial-gradient(ellipse at 50% 42%, #1B3F6E 0%, #163458 35%, #112B4A 65%, #0D2240 100%)',
        }}>
          {/* Inner line */}
          <div className="absolute inset-[7%] rounded-[50%]" style={{ border: '1px solid rgba(255,255,255,0.04)' }} />

          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span style={{ fontSize: '3vw', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.04)', textTransform: 'uppercase' }}>HomeGame</span>
          </div>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {/* Community cards */}
            {phase !== 'waiting' && (
              <div style={{ display: 'flex', gap: 5 }}>
                {communityCards.map((card, i) => {
                  const isNew = newCardStart >= 0 && i >= newCardStart;
                  const isFlop = newCardStart === 0 && i < 3;
                  const animClass = isNew ? (isFlop ? 'card-peel' : 'card-flip') : '';
                  const delay = isFlop ? `${(i - newCardStart) * 0.3}s` : '0s';
                  return <Card key={i} card={card} size="md" className={animClass} style={isNew ? { animationDelay: delay } : undefined} />;
                })}
                {communityCards.length < 5 && Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                  <div key={`e${i}`} style={{ width: 48, height: 66, borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }} />
                ))}
              </div>
            )}

            {/* Pot display */}
            {totalPot > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {/* Total pot */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: '3px 12px',
                  transition: 'all 0.3s ease',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EAB308' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FFF' }}>
                    {totalPot.toLocaleString()}
                  </span>
                </div>

                {/* Breakdown: committed + current round */}
                {committedPot > 0 && currentBets > 0 && (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                    {committedPot.toLocaleString()} + {currentBets.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Side pots */}
            {pots.length > 1 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {pots.map((pot, i) => (
                  <span key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '1px 6px' }}>
                    {i === 0 ? 'Main' : `Side ${i}`}: {pot.amount}
                  </span>
                ))}
              </div>
            )}

            {/* Sweep animation — chips collecting into pot */}
            {showSweep && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const angle = (i / 6) * Math.PI * 2;
                  return (
                    <div key={i} className="absolute chip-sweep" style={{
                      '--to-x': '0px', '--to-y': '0px',
                      left: `calc(50% + ${Math.cos(angle) * 80}px)`,
                      top: `calc(50% + ${Math.sin(angle) * 50}px)`,
                      animationDelay: `${i * 0.05}s`,
                    } as React.CSSProperties}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(180deg, #EAB308, #CA8A04)' }} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Win chip burst */}
            {chipAnims.length > 0 && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {chipAnims.map(c => (
                  <div key={c.id} className="absolute chip-fly" style={{ '--fly-x': `${c.x}px`, '--fly-y': `${c.y}px`, animationDelay: `${c.id * 0.04}s` } as React.CSSProperties}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(180deg, #EAB308, #CA8A04)', boxShadow: '0 1px 4px rgba(234,179,8,0.4)' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Waiting state */}
            {phase === 'waiting' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                  {players.length < 2 ? 'Waiting for players...' : 'Ready to deal'}
                </span>
                {myPlayerId && (
                  <button onClick={copyLink} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      {/* Seats */}
      {Array.from({ length: config.maxPlayers }).map((_, si) => {
        const p = players.find(pl => pl.seatIndex === si);
        return (
          <PlayerSeat key={si} player={p}
            position={getVisualPos(si, mySeat, config.maxPlayers)}
            seatIndex={si}
            isDealer={dealerIndex === si}
            isSmallBlind={sbSeat === si}
            isBigBlind={bbSeat === si}
            isActive={activePlayerIndex === si}
            isMe={p?.id === myPlayerId}
            phase={phase}
            turnTimer={config.turnTimer}
            timeRemaining={activePlayerIndex === si ? timeRemaining : 0}
            onSelectSeat={() => onSelectSeat?.(si)}
            totalPositions={config.maxPlayers}
            numHoleCards={{ nlh: 2, plo4: 4, plo5: 5, plo6: 6 }[config.variant] || 2}
          />
        );
      })}
    </div>
  );
}
