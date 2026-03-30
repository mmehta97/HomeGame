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

function getSeatPos(pos: number, total: number): { top: string; left: string } {
  const P: Record<number, [number, number][]> = {
    2: [[85, 50], [5, 50]],
    3: [[85, 50], [22, 8], [22, 92]],
    4: [[85, 50], [42, 3], [5, 50], [42, 97]],
    5: [[85, 50], [58, 3], [12, 14], [12, 86], [58, 97]],
    6: [[85, 50], [64, 2], [18, 8], [5, 50], [18, 92], [64, 98]],
    7: [[85, 50], [68, 2], [32, 2], [4, 25], [4, 75], [32, 98], [68, 98]],
    8: [[85, 50], [70, 2], [40, 1], [10, 15], [4, 50], [10, 85], [40, 99], [70, 98]],
    9: [[85, 50], [73, 3], [48, 1], [20, 6], [3, 28], [3, 72], [20, 94], [48, 99], [73, 97]],
  };
  const s = (P[total] || P[9])[pos] || [50, 50];
  return { top: `${s[0]}%`, left: `${s[1]}%` };
}

export default function PlayerSeat({
  player, position, seatIndex, isDealer, isSmallBlind, isBigBlind,
  isActive, isMe, phase, turnTimer, timeRemaining, onSelectSeat, totalPositions, numHoleCards,
}: PlayerSeatProps) {
  const pos = getSeatPos(position, totalPositions);
  const timerPct = turnTimer > 0 && isActive ? timeRemaining / turnTimer : 0;

  // Empty seat
  if (!player) {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={pos}>
        <button onClick={onSelectSeat} style={{
          width: 78, height: 36, borderRadius: 18,
          border: '1px dashed #333844', background: 'rgba(14,16,21,0.5)',
          color: '#3D4350', fontSize: 11, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          Seat {seatIndex + 1}
        </button>
      </div>
    );
  }

  const folded = player.status === 'folded';
  const allIn = player.status === 'all-in';

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={pos}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: folded ? 0.3 : (!player.isConnected ? 0.2 : 1), transition: 'opacity 0.3s' }}>

        {/* Hole cards */}
        {player.hasCards && (
          <div style={{ display: 'flex', gap: 2, marginBottom: -3, zIndex: 20, position: 'relative' }}>
            {player.holeCards && player.holeCards.length > 0
              ? player.holeCards.map((c, i) => <Card key={i} card={c} size="sm" />)
              : Array.from({ length: numHoleCards }).map((_, i) => <Card key={i} faceDown size="sm" />)
            }
          </div>
        )}

        {/* Player box */}
        <div style={{ position: 'relative', minWidth: 82 }}>
          {/* Timer bar */}
          {isActive && turnTimer > 0 && (
            <div style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 2, borderRadius: '2px 2px 0 0', background: '#1A1C24', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${timerPct * 100}%`,
                background: timerPct > 0.5 ? '#22C55E' : timerPct > 0.2 ? '#EAB308' : '#EF4444',
                transition: 'width 0.3s linear, background 0.3s',
              }} />
            </div>
          )}

          {/* Box */}
          <div style={{
            borderRadius: 6, overflow: 'hidden',
            border: isActive ? '1.5px solid #3B82F6' : '1px solid #2A2D38',
            boxShadow: isActive ? '0 0 12px rgba(59,130,246,0.25)' : '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}>
            {/* Name row */}
            <div style={{
              padding: '3px 10px',
              background: isMe ? '#1A2332' : '#1E2028',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, lineHeight: 1.3,
                color: isMe ? '#7DB4F5' : '#D1D5DB',
                maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{player.name}</div>
            </div>

            {/* Chips row */}
            <div style={{
              padding: '2px 10px 3px',
              background: isMe ? '#141C28' : '#16181F',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E8B730' }}>
                {player.chips.toLocaleString()}
              </span>
            </div>

            {/* Action label */}
            {(player.lastAction || allIn) && phase !== 'waiting' && (
              <div style={{
                padding: '1px 10px 2px', textAlign: 'center',
                background: '#12141A',
                borderTop: '1px solid #1E2028',
              }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: player.lastAction === 'fold' ? '#6B7280'
                    : (player.lastAction === 'raise' || player.lastAction === 'all-in' || allIn) ? '#EF4444'
                    : player.lastAction === 'call' ? '#22C55E'
                    : '#3B82F6',
                }}>
                  {allIn && !player.lastAction ? 'ALL IN' : player.lastAction === 'all-in' ? 'ALL IN' : player.lastAction}
                </span>
              </div>
            )}
          </div>

          {/* Dealer button */}
          {isDealer && (
            <div style={{
              position: 'absolute', right: -6, top: -4, width: 16, height: 16,
              borderRadius: '50%', background: '#FFFFFF', color: '#0E1015',
              fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 30,
            }}>D</div>
          )}

          {/* SB/BB badges */}
          {isSmallBlind && (
            <div style={{
              position: 'absolute', left: -6, top: -4, width: 16, height: 16,
              borderRadius: '50%', background: '#3B82F6', color: '#FFF',
              fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 30,
            }}>SB</div>
          )}
          {isBigBlind && (
            <div style={{
              position: 'absolute', left: -6, top: -4, width: 16, height: 16,
              borderRadius: '50%', background: '#EAB308', color: '#0E1015',
              fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)', zIndex: 30,
            }}>BB</div>
          )}
        </div>

        {/* Current bet */}
        {player.bet > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'linear-gradient(180deg, #EAB308, #CA8A04)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#EAB308' }}>{player.bet}</span>
          </div>
        )}
      </div>
    </div>
  );
}
