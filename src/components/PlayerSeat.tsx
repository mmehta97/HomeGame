'use client';

import { PublicPlayer, GamePhase } from '@/types';
import Card from './Card';

interface PlayerSeatProps {
  player?: PublicPlayer;
  position: number;
  seatIndex: number;
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
  numHoleCards: number;
}

// Seat positions (top%, left%)
function getSeatPos(pos: number, total: number): [number, number] {
  const P: Record<number, [number, number][]> = {
    2: [[85,50],[5,50]],
    3: [[85,50],[22,8],[22,92]],
    4: [[85,50],[42,3],[5,50],[42,97]],
    5: [[85,50],[58,3],[12,14],[12,86],[58,97]],
    6: [[85,50],[64,2],[18,8],[5,50],[18,92],[64,98]],
    7: [[85,50],[68,2],[32,2],[4,25],[4,75],[32,98],[68,98]],
    8: [[85,50],[70,2],[40,1],[10,15],[4,50],[10,85],[40,99],[70,98]],
    9: [[85,50],[73,3],[48,1],[20,6],[3,28],[3,72],[20,94],[48,99],[73,97]],
  };
  return (P[total] || P[9])[pos] || [50, 50];
}

// Bet chip position: offset partway from player toward table center (50%, 45%)
function getBetOffset(pos: number, total: number): { x: number; y: number } {
  const [top, left] = getSeatPos(pos, total);
  const cx = 50, cy = 45; // Table center
  const dx = cx - left, dy = cy - top;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: 0, y: 0 };
  // Move 35% of the way toward center
  const factor = 0.35;
  return { x: dx * factor, y: dy * factor };
}

// Timer ring SVG
function TimerRing({ pct, size }: { pct: number; size: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.5 ? '#22C55E' : pct > 0.2 ? '#EAB308' : '#EF4444';

  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%) rotate(-90deg)', pointerEvents: 'none', zIndex: 40 }}>
      {/* Background ring */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1A1C24" strokeWidth={2.5} />
      {/* Progress ring */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={2.5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
      />
    </svg>
  );
}

export default function PlayerSeat({
  player, position, seatIndex, isDealer, isSmallBlind, isBigBlind,
  isActive, isMe, phase, turnTimer, timeRemaining, onSelectSeat, totalPositions, numHoleCards,
}: PlayerSeatProps) {
  const [top, left] = getSeatPos(position, totalPositions);
  const timerPct = turnTimer > 0 && isActive ? timeRemaining / turnTimer : 0;
  const betOff = getBetOffset(position, totalPositions);

  // Empty seat
  if (!player) {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ top: `${top}%`, left: `${left}%` }}>
        <button onClick={onSelectSeat} style={{
          width: 78, height: 36, borderRadius: 18,
          border: '1px dashed #333844', background: 'rgba(14,16,21,0.5)',
          color: '#3D4350', fontSize: 11,
        }}>Seat {seatIndex + 1}</button>
      </div>
    );
  }

  const folded = player.status === 'folded';
  const allIn = player.status === 'all-in';
  const boxWidth = 86;

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ top: `${top}%`, left: `${left}%` }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        opacity: folded ? 0.3 : (!player.isConnected ? 0.2 : 1),
        transition: 'opacity 0.3s',
      }}>

        {/* Hole cards */}
        {player.hasCards && (
          <div style={{ display: 'flex', gap: 2, marginBottom: -3, zIndex: 20, position: 'relative' }}>
            {player.holeCards && player.holeCards.length > 0
              ? player.holeCards.map((c, i) => <Card key={i} card={c} size="sm" />)
              : Array.from({ length: numHoleCards }).map((_, i) => <Card key={i} faceDown size="sm" />)
            }
          </div>
        )}

        {/* Player box with timer ring */}
        <div style={{ position: 'relative', minWidth: boxWidth }}>
          {/* Timer ring around box */}
          {isActive && turnTimer > 0 && (
            <TimerRing pct={timerPct} size={boxWidth + 12} />
          )}

          {/* Box */}
          <div style={{
            borderRadius: 6, overflow: 'hidden',
            border: isActive ? '1.5px solid #3B82F6' : '1px solid #2A2D38',
            boxShadow: isActive ? '0 0 14px rgba(59,130,246,0.3)' : '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}>
            {/* Name */}
            <div style={{
              padding: '3px 10px', textAlign: 'center',
              background: isMe ? '#1A2332' : '#1E2028',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, lineHeight: 1.3,
                color: isMe ? '#7DB4F5' : '#D1D5DB',
                maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{player.name}</div>
            </div>

            {/* Chips */}
            <div style={{
              padding: '2px 10px 3px', textAlign: 'center',
              background: isMe ? '#141C28' : '#16181F',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E8B730', transition: 'all 0.3s' }}>
                {player.chips.toLocaleString()}
              </span>
            </div>

            {/* Action label */}
            {(player.lastAction || allIn) && phase !== 'waiting' && (
              <div style={{
                padding: '1px 10px 2px', textAlign: 'center',
                background: '#12141A', borderTop: '1px solid #1E2028',
              }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                  color: player.lastAction === 'fold' ? '#6B7280'
                    : (player.lastAction === 'raise' || player.lastAction === 'all-in' || allIn) ? '#EF4444'
                    : player.lastAction === 'call' ? '#22C55E' : '#3B82F6',
                }}>
                  {allIn && !player.lastAction ? 'ALL IN' : player.lastAction === 'all-in' ? 'ALL IN' : player.lastAction}
                </span>
              </div>
            )}
          </div>

          {/* Dealer button — positioned with smooth transition */}
          {isDealer && (
            <div style={{
              position: 'absolute', right: -7, top: -5,
              width: 18, height: 18, borderRadius: '50%',
              background: '#FFFFFF', color: '#0E1015',
              fontSize: 9, fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              zIndex: 30, transition: 'all 0.5s ease',
            }}>D</div>
          )}

          {/* SB / BB */}
          {isSmallBlind && (
            <div style={{
              position: 'absolute', left: -7, top: -5,
              width: 18, height: 18, borderRadius: '50%',
              background: '#3B82F6', color: '#FFF',
              fontSize: 7, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 30,
            }}>SB</div>
          )}
          {isBigBlind && (
            <div style={{
              position: 'absolute', left: -7, top: -5,
              width: 18, height: 18, borderRadius: '50%',
              background: '#EAB308', color: '#0E1015',
              fontSize: 7, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 30,
            }}>BB</div>
          )}
        </div>

        {/* Bet chips — positioned partway toward center */}
        {player.bet > 0 && (
          <div className="chip-bet" style={{
            position: 'absolute',
            left: `calc(50% + ${betOff.x * 0.6}px)`,
            top: `calc(50% + ${betOff.y * 3}px)`,
            transform: 'translate(-50%, -50%)',
            display: 'flex', alignItems: 'center', gap: 3,
            zIndex: 5,
            '--from-x': `${-betOff.x * 0.6}px`,
            '--from-y': `${-betOff.y * 3}px`,
          } as React.CSSProperties}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'linear-gradient(180deg, #EAB308, #CA8A04)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#EAB308', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              {player.bet}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
