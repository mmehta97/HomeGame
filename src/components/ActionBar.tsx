'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ValidAction, PublicGameState } from '@/types';

interface ActionBarProps {
  validActions: ValidAction[];
  gameState: PublicGameState;
  myChips: number;
  myBet: number;
  onAction: (action: string, amount?: number) => void;
}

export default function ActionBar({ validActions, gameState, myChips, myBet, onAction }: ActionBarProps) {
  const raiseAction = validActions.find(a => a.action === 'raise');
  const callAction = validActions.find(a => a.action === 'call');
  const canCheck = validActions.some(a => a.action === 'check');
  const canFold = validActions.some(a => a.action === 'fold');
  const allInAction = validActions.find(a => a.action === 'all-in');

  const minRaise = raiseAction?.minAmount || 0;
  const maxRaise = raiseAction?.maxAmount || myChips;

  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaise, setShowRaise] = useState(false);

  useEffect(() => { setRaiseAmount(minRaise); }, [minRaise]);

  const potTotal = gameState.pots.reduce((s, p) => s + p.amount, 0) +
    gameState.players.reduce((s, p) => s + p.bet, 0);
  const bb = gameState.config.bigBlind;

  const presets = useMemo(() => {
    const p: { label: string; value: number }[] = [];
    if (3 * bb >= minRaise && 3 * bb <= maxRaise) p.push({ label: '3BB', value: 3 * bb });
    const half = Math.floor(potTotal / 2);
    if (half >= minRaise && half <= maxRaise) p.push({ label: '½', value: half });
    const threeFourth = Math.floor(potTotal * 0.75);
    if (threeFourth >= minRaise && threeFourth <= maxRaise) p.push({ label: '¾', value: threeFourth });
    if (potTotal >= minRaise && potTotal <= maxRaise) p.push({ label: 'Pot', value: potTotal });
    return p;
  }, [potTotal, bb, minRaise, maxRaise]);

  const handleRaiseSubmit = useCallback(() => {
    onAction('raise', raiseAmount);
    setShowRaise(false);
  }, [raiseAmount, onAction]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === 'f' && canFold) onAction('fold');
      else if (k === 'k' && canCheck) onAction('check');
      else if (k === 'c' && callAction) onAction('call');
      else if (k === 'r' && raiseAction) {
        if (showRaise) handleRaiseSubmit();
        else { setRaiseAmount(minRaise); setShowRaise(true); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canFold, canCheck, callAction, raiseAction, showRaise, minRaise, handleRaiseSubmit, onAction]);

  if (validActions.length === 0) return null;

  const btnBase: React.CSSProperties = {
    flex: '1 1 0', maxWidth: 130, padding: '10px 0',
    borderRadius: 6, fontWeight: 700, fontSize: 13,
    border: 'none', cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.1s',
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      {/* Raise panel */}
      {showRaise && raiseAction && (
        <div style={{ background: '#161A21', borderTop: '1px solid #1E2028', padding: '10px 16px' }}>
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            {/* Presets */}
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 8 }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => setRaiseAmount(p.value)} style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: raiseAmount === p.value ? '#3B82F6' : '#1E2028', color: raiseAmount === p.value ? '#FFF' : '#6B7280',
                }}>{p.label}</button>
              ))}
              <button onClick={() => setRaiseAmount(maxRaise)} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: raiseAmount === maxRaise ? '#EF4444' : '#1E2028', color: raiseAmount === maxRaise ? '#FFF' : '#6B7280',
              }}>Max</button>
            </div>
            {/* Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={minRaise} max={maxRaise} value={raiseAmount}
                onChange={e => setRaiseAmount(Number(e.target.value))}
                style={{ flex: 1, height: 4, accentColor: '#3B82F6' }} />
              <input type="number" value={raiseAmount}
                onChange={e => setRaiseAmount(Math.min(maxRaise, Math.max(minRaise, Number(e.target.value))))}
                style={{
                  width: 56, padding: '4px 6px', borderRadius: 4, border: '1px solid #262B33',
                  background: '#0E1015', color: '#FFF', fontSize: 12, textAlign: 'center', outline: 'none',
                  fontFamily: 'monospace',
                }} />
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ background: '#0E1015', borderTop: '1px solid #1A1C24', padding: '8px 16px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', gap: 6, justifyContent: 'center' }}>
          {canFold && (
            <button onClick={() => onAction('fold')} style={{ ...btnBase, background: '#262A33', color: '#8B949E' }}>
              Fold <span style={{ fontSize: 9, opacity: 0.4, marginLeft: 3 }}>F</span>
            </button>
          )}
          {canCheck && (
            <button onClick={() => onAction('check')} style={{ ...btnBase, background: '#1B7A3D', color: '#FFF' }}>
              Check <span style={{ fontSize: 9, opacity: 0.4, marginLeft: 3 }}>K</span>
            </button>
          )}
          {callAction && (
            <button onClick={() => onAction('call')} style={{ ...btnBase, background: '#1B7A3D', color: '#FFF' }}>
              Call {callAction.minAmount} <span style={{ fontSize: 9, opacity: 0.4, marginLeft: 3 }}>C</span>
            </button>
          )}
          {raiseAction && !showRaise && (
            <button onClick={() => { setRaiseAmount(minRaise); setShowRaise(true); }} style={{ ...btnBase, background: '#2563EB', color: '#FFF' }}>
              Raise <span style={{ fontSize: 9, opacity: 0.4, marginLeft: 3 }}>R</span>
            </button>
          )}
          {showRaise && (
            <>
              <button onClick={() => setShowRaise(false)} style={{ ...btnBase, maxWidth: 70, background: '#262A33', color: '#6B7280' }}>Back</button>
              <button onClick={handleRaiseSubmit} style={{ ...btnBase, background: '#2563EB', color: '#FFF' }}>
                Raise {(raiseAmount + myBet).toLocaleString()} <span style={{ fontSize: 9, opacity: 0.4, marginLeft: 3 }}>R</span>
              </button>
            </>
          )}
          {!raiseAction && allInAction && !showRaise && (
            <button onClick={() => onAction('all-in')} style={{ ...btnBase, background: '#DC2626', color: '#FFF' }}>
              All-In {allInAction.minAmount?.toLocaleString()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
