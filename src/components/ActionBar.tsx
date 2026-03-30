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
    if (half >= minRaise && half <= maxRaise) p.push({ label: '1/2', value: half });
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
      const key = e.key.toLowerCase();
      if (key === 'f' && canFold) { onAction('fold'); }
      else if (key === 'k' && canCheck) { onAction('check'); }
      else if (key === 'c' && callAction) { onAction('call'); }
      else if (key === 'r' && raiseAction) {
        if (showRaise) handleRaiseSubmit();
        else { setRaiseAmount(minRaise); setShowRaise(true); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canFold, canCheck, callAction, raiseAction, showRaise, minRaise, handleRaiseSubmit, onAction]);

  if (validActions.length === 0) return null;

  const btnBase = 'flex-1 max-w-[130px] py-2.5 rounded font-bold text-[13px] transition-all active:scale-[0.97] select-none';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      {/* Raise panel */}
      {showRaise && raiseAction && (
        <div className="bg-[#161a21] border-t border-[#262b33] px-4 py-2.5">
          <div className="max-w-[420px] mx-auto space-y-2">
            <div className="flex gap-1.5 justify-center">
              {presets.map(p => (
                <button key={p.label} onClick={() => setRaiseAmount(p.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    raiseAmount === p.value ? 'bg-[#3b82f6] text-white' : 'bg-[#1c2028] text-[#6b7280] hover:text-white'
                  }`}>{p.label}</button>
              ))}
              <button onClick={() => setRaiseAmount(maxRaise)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  raiseAmount === maxRaise ? 'bg-[#ef4444] text-white' : 'bg-[#1c2028] text-[#6b7280] hover:text-white'
                }`}>Max</button>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={minRaise} max={maxRaise} value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="flex-1 h-[4px] rounded-full appearance-none cursor-pointer accent-[#3b82f6]"
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${((raiseAmount - minRaise) / Math.max(maxRaise - minRaise, 1)) * 100}%, #1c2028 0%)`,
                }}
              />
              <input type="number" value={raiseAmount}
                onChange={(e) => setRaiseAmount(Math.min(maxRaise, Math.max(minRaise, Number(e.target.value))))}
                className="w-[60px] bg-[#0e1015] border border-[#262b33] rounded px-2 py-1 text-[12px] text-white text-center font-mono focus:border-[#3b82f6] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="bg-[#0e1015] border-t border-[#262b33] px-4 py-2.5">
        <div className="max-w-[420px] mx-auto flex gap-2 justify-center">
          {canFold && (
            <button onClick={() => onAction('fold')} className={`${btnBase} bg-[#1c2028] text-[#6b7280] hover:text-white border border-[#262b33]`}>
              Fold <span className="text-[9px] ml-1 opacity-40">F</span>
            </button>
          )}
          {canCheck && (
            <button onClick={() => onAction('check')} className={`${btnBase} bg-[#166534] text-white border border-[#22c55e]/30 hover:bg-[#15803d]`}>
              Check <span className="text-[9px] ml-1 opacity-40">K</span>
            </button>
          )}
          {callAction && (
            <button onClick={() => onAction('call')} className={`${btnBase} bg-[#166534] text-white border border-[#22c55e]/30 hover:bg-[#15803d]`}>
              Call {callAction.minAmount} <span className="text-[9px] ml-1 opacity-40">C</span>
            </button>
          )}
          {raiseAction && !showRaise && (
            <button onClick={() => { setRaiseAmount(minRaise); setShowRaise(true); }}
              className={`${btnBase} bg-[#1e3a5f] text-white border border-[#3b82f6]/30 hover:bg-[#1e40af]`}>
              Raise <span className="text-[9px] ml-1 opacity-40">R</span>
            </button>
          )}
          {showRaise && (
            <>
              <button onClick={() => setShowRaise(false)} className="px-3 py-2.5 rounded text-[12px] font-semibold bg-[#1c2028] text-[#6b7280] border border-[#262b33]">Back</button>
              <button onClick={handleRaiseSubmit} className={`${btnBase} bg-[#1e3a5f] text-white border border-[#3b82f6]/30 hover:bg-[#1e40af]`}>
                Raise {(raiseAmount + myBet).toLocaleString()} <span className="text-[9px] ml-1 opacity-40">R</span>
              </button>
            </>
          )}
          {!raiseAction && allInAction && !showRaise && (
            <button onClick={() => onAction('all-in')} className={`${btnBase} bg-[#7f1d1d] text-white border border-[#ef4444]/30 hover:bg-[#991b1b]`}>
              All-In {allInAction.minAmount?.toLocaleString()}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
