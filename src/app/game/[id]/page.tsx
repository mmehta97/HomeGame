'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { connectSocket, getSocket, ensureConnected } from '@/lib/socket';
import useGameStore from '@/lib/store';
import Table from '@/components/Table';
import ActionBar from '@/components/ActionBar';
import WinnerToast from '@/components/WinnerToast';
import type { PublicGameState, WinResult, GameConfig, PlayerPreferences } from '@/types';

// Lazy imports for panels — they'll be loaded when opened
import dynamic from 'next/dynamic';
const GameLog = dynamic(() => import('@/components/GameLog'), { ssr: false });
const Ledger = dynamic(() => import('@/components/Ledger'), { ssr: false });
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel'), { ssr: false });
const PreferencesPanel = dynamic(() => import('@/components/PreferencesPanel'), { ssr: false });

export default function GamePage() {
  const params = useParams();
  const roomId = params.id as string;

  const {
    isConnected, playerId, gameState, isHost,
    validActions, timeRemaining, activePanel,
    setConnected, setRoom, setPlayerName, setGameState,
    setValidActions, setTimeRemaining, togglePanel,
  } = useGameStore();

  // Join form state
  const [joinName, setJoinName] = useState('');
  const [buyIn, setBuyIn] = useState(200);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState<WinResult[]>([]);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [joinRequests, setJoinRequests] = useState<Array<{ socketId: string; playerName: string; seatIndex: number; buyIn: number }>>([]);
  const [joinDeniedMsg, setJoinDeniedMsg] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Socket setup ---
  useEffect(() => {
    const socket = connectSocket();

    const requestInfo = () => socket.emit('room:info', roomId);

    socket.on('connect', () => { setConnected(true); requestInfo(); });
    socket.on('disconnect', () => setConnected(false));

    socket.on('game:state', (state: PublicGameState) => {
      setGameState(state);
      if (!playerId) setBuyIn(state.config.minBuyIn * state.config.bigBlind);
    });

    socket.on('room:joined', (data) => {
      setRoom(data.roomId, data.playerId, data.seatIndex, data.isHost);
    });

    socket.on('game:action-required', (data) => {
      if (data.playerId === playerId) {
        setValidActions(data.validActions);
        setTimeRemaining(data.timeRemaining);
      }
    });

    socket.on('game:winner', (w: WinResult[]) => {
      setWinners(w);
      setTimeout(() => setWinners([]), 4000);
    });

    socket.on('game:error', (msg: string) => {
      if (msg === 'Room not found') setRoomNotFound(true);
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('room:join-pending', () => setJoinPending(true));

    socket.on('room:join-request', (req) => {
      setJoinRequests(prev => [...prev, req]);
    });

    socket.on('room:join-denied', (reason) => {
      setJoinPending(false);
      setJoinDeniedMsg(reason);
      setSelectedSeat(null);
      setTimeout(() => setJoinDeniedMsg(null), 4000);
    });

    // If already connected (navigated from another page), immediately set state and request info
    if (socket.connected) {
      setConnected(true);
      requestInfo();
    }

    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('game:state');
      socket.off('room:joined'); socket.off('game:action-required');
      socket.off('game:winner'); socket.off('game:error');
      socket.off('room:join-pending'); socket.off('room:join-request'); socket.off('room:join-denied');
    };
  }, [roomId, playerId, setConnected, setRoom, setGameState, setValidActions, setTimeRemaining, setPlayerName]);

  // Turn timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameState && gameState.config.turnTimer > 0 && gameState.activePlayerIndex >= 0) {
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - gameState.turnStartedAt) / 1000;
        setTimeRemaining(Math.max(0, gameState.config.turnTimer - elapsed));
      }, 200);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.turnStartedAt, gameState?.activePlayerIndex, gameState?.config.turnTimer, setTimeRemaining]);

  // Clear actions when not my turn
  useEffect(() => {
    if (!gameState || !playerId) return;
    const me = gameState.players.find(p => p.id === playerId);
    if (!me || me.seatIndex !== gameState.activePlayerIndex || me.status !== 'active') setValidActions([]);
  }, [gameState?.activePlayerIndex, playerId, gameState, setValidActions]);

  // --- Handlers ---
  const handleJoin = useCallback(() => {
    if (!joinName.trim() || selectedSeat === null) return;
    getSocket().emit('room:join', {
      roomId, playerName: joinName.trim(), seatIndex: selectedSeat, buyIn,
    }, (success: boolean, err?: string) => {
      if (success) {
        setPlayerName(joinName.trim());
      } else {
        setError(err || 'Failed to join');
      }
    });
  }, [joinName, selectedSeat, buyIn, roomId, setPlayerName]);

  const handleAction = useCallback((action: string, amount?: number) => {
    getSocket().emit('game:action', {
      action: action as 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount,
    }, (ok: boolean, err?: string) => {
      if (!ok) setError(err || 'Action failed');
    });
    setValidActions([]);
  }, [setValidActions]);

  const handleStart = useCallback(() => getSocket().emit('game:start'), []);
  const handlePause = useCallback(() => getSocket().emit('game:pause'), []);

  const handleRebuy = useCallback(() => {
    const amt = gameState ? gameState.config.minBuyIn * gameState.config.bigBlind : 200;
    getSocket().emit('game:rebuy', amt, (ok: boolean, err?: string) => { if (!ok) setError(err || 'Rebuy failed'); });
  }, [gameState]);

  const handleUpdateConfig = useCallback((update: Partial<GameConfig>) => {
    getSocket().emit('game:update-config', update, (ok: boolean, err?: string) => {
      if (!ok) setError(err || 'Failed to update');
    });
  }, []);

  const handleUpdatePrefs = useCallback((prefs: Partial<PlayerPreferences>) => {
    getSocket().emit('player:update-preferences', prefs, (ok: boolean, err?: string) => {
      if (!ok) setError(err || 'Failed to update preferences');
    });
  }, []);

  const handleApproveJoin = useCallback((socketId: string) => {
    getSocket().emit('room:approve-join', socketId);
    setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
  }, []);

  const handleDenyJoin = useCallback((socketId: string) => {
    getSocket().emit('room:deny-join', socketId);
    setJoinRequests(prev => prev.filter(r => r.socketId !== socketId));
  }, []);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // --- Room not found ---
  if (roomNotFound) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-3" style={{ background: '#0e1015' }}>
        <span className="text-[#6b7280] text-[14px]">Room not found</span>
        <Link href="/" className="text-[#3b82f6] text-[12px] hover:underline">Create a new game</Link>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: '#0e1015' }}>
        <span className="text-[#3d4350] text-[13px]">Connecting...</span>
      </div>
    );
  }

  // --- Join flow (not yet seated) — full table with overlay ---
  if (!playerId) {
    return (
      <div className="h-dvh flex flex-col" style={{ background: '#0e1015' }}>
        {/* Header */}
        <header className="flex items-center justify-between px-3 h-[40px] bg-[#161a21] border-b border-[#1c2028] shrink-0 z-20">
          <h1 className="text-[14px] font-bold">
            <span className="text-[#22c55e]">Home</span><span className="text-white">Game</span>
          </h1>
          <span className="text-[11px] text-[#3d4350] font-mono">{roomId}</span>
        </header>

        {/* Full-size table behind */}
        <div className="flex-1 flex items-center justify-center p-2 min-h-0 relative">
          {gameState && (
            <Table gameState={gameState} myPlayerId={null} timeRemaining={0} onSelectSeat={s => setSelectedSeat(s)} />
          )}

          {/* Join flow — seat-first, then name/buy-in form */}
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            {selectedSeat === null ? (
              /* Step 1: Prompt to pick a seat */
              <div className="rounded-lg bg-[#161a21] border border-[#262b33] px-5 py-3 animate-fade-in shadow-2xl pointer-events-auto">
                <div className="text-[13px] text-[#6b7280]">Click a seat to join</div>
              </div>
            ) : joinPending ? (
              /* Waiting for host approval */
              <div className="w-[260px] rounded-lg bg-[#161a21] border border-[#262b33] p-4 space-y-2 animate-fade-in shadow-2xl pointer-events-auto text-center">
                <div className="text-[13px] text-white font-semibold">Waiting for host approval</div>
                <div className="text-[11px] text-[#6b7280]">The host will approve your request to sit at Seat {selectedSeat + 1}</div>
                <div className="w-5 h-5 mx-auto border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mt-2" />
                {joinDeniedMsg && (
                  <div className="rounded bg-[#ef4444]/10 border border-[#ef4444]/20 px-3 py-1.5 text-[11px] text-[#ef4444]">{joinDeniedMsg}</div>
                )}
              </div>
            ) : (
              /* Step 2: Name + buy-in form after seat selected */
              <div className="w-[260px] rounded-lg bg-[#161a21] border border-[#262b33] p-4 space-y-3 animate-fade-in shadow-2xl pointer-events-auto">
                <div className="text-center mb-1">
                  <div className="text-[11px] text-[#3b82f6]">Seat {selectedSeat + 1}</div>
                </div>

                <div>
                  <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-semibold">Name</label>
                  <input type="text" value={joinName} onChange={e => setJoinName(e.target.value)}
                    placeholder="Your name" maxLength={16} autoFocus
                    className="w-full mt-1 bg-[#0e1015] border border-[#262b33] rounded px-3 py-2 text-[13px] text-white placeholder-[#3d4350] focus:border-[#3b82f6] focus:outline-none" />
                </div>

                <div>
                  <label className="text-[10px] text-[#6b7280] uppercase tracking-wider font-semibold">
                    Buy-in
                    {gameState && gameState.config.minBuyIn > 0 && gameState.config.maxBuyIn > 0 && (
                      <span className="normal-case text-[#3d4350]"> ({gameState.config.minBuyIn * gameState.config.bigBlind}–{gameState.config.maxBuyIn * gameState.config.bigBlind})</span>
                    )}
                  </label>
                  <input type="text" inputMode="numeric" value={String(buyIn)}
                    onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setBuyIn(v === '' ? 0 : parseInt(v, 10)); }}
                    className="w-full mt-1 bg-[#0e1015] border border-[#262b33] rounded px-3 py-2 text-[13px] text-white focus:border-[#3b82f6] focus:outline-none" />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setSelectedSeat(null)}
                    className="px-3 py-2.5 rounded text-[12px] font-semibold text-[#6b7280] bg-[#1c2028] border border-[#262b33] transition-all active:scale-[0.97]">
                    Back
                  </button>
                  <button onClick={handleJoin} disabled={!joinName.trim() || buyIn <= 0}
                    className="flex-1 py-2.5 rounded font-bold text-[13px] text-white transition-all active:scale-[0.98] disabled:opacity-25"
                    style={{
                      background: (!joinName.trim() || buyIn <= 0) ? '#1c2028' : '#1e40af',
                      border: `1px solid ${(!joinName.trim() || buyIn <= 0) ? '#262b33' : 'rgba(59,130,246,0.3)'}`,
                    }}>
                    Sit Down
                  </button>
                </div>

                {error && (
                  <div className="rounded bg-[#ef4444]/10 border border-[#ef4444]/20 px-3 py-1.5 text-[11px] text-[#ef4444] text-center">{error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Main game ---
  const me = gameState?.players.find(p => p.id === playerId);
  const canStart = gameState?.phase === 'waiting' && (gameState?.players.filter(p => p.chips > 0).length || 0) >= 2;
  const isEliminated = me && me.chips === 0 && me.status === 'waiting';

  return (
    <div className="h-dvh flex flex-col" style={{ background: '#0e1015' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-3 h-[40px] bg-[#161a21] border-b border-[#1c2028] shrink-0 z-20">
        <h1 className="text-[14px] font-bold">
          <span className="text-[#22c55e]">Home</span><span className="text-white">Game</span>
        </h1>

        <div className="flex items-center gap-1">
          {/* Copy link button */}
          <button onClick={copyLink}
            className="px-2 py-1 rounded text-[10px] text-[#6b7280] hover:text-white bg-[#1c2028] hover:bg-[#262b33] border border-[#262b33] transition-all">
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {/* Panel toggles — Settings only for host, Prefs for everyone */}
          {(['log', 'ledger', 'prefs', ...(isHost ? ['settings'] as const : [])] as const).map(panel => (
            <button key={panel} onClick={() => togglePanel(panel as 'log' | 'ledger' | 'settings' | 'prefs')}
              className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                activePanel === panel
                  ? 'bg-[#262b33] text-white border-[#3b82f6]/30'
                  : 'text-[#6b7280] hover:text-white bg-[#1c2028] border-[#262b33]'
              }`}>
              {panel === 'log' ? 'Log' : panel === 'ledger' ? 'Ledger' : panel === 'prefs' ? 'Prefs' : 'Settings'}
            </button>
          ))}

          <div className="flex items-center gap-2 ml-1 text-[10px] text-[#3d4350]">
            <span className="font-mono">
              {{ nlh: 'NLH', plo4: 'PLO4', plo5: 'PLO5', plo6: 'PLO6' }[gameState?.config.variant || 'nlh']} {gameState?.config.smallBlind}/{gameState?.config.bigBlind}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
          </div>
        </div>
      </header>

      {/* Join request notifications — host only */}
      {isHost && joinRequests.length > 0 && (
        <div className="px-3 py-2 bg-[#161a21] border-b border-[#1c2028] flex flex-col gap-1.5 shrink-0 z-20">
          {joinRequests.map(req => (
            <div key={req.socketId} className="flex items-center justify-between bg-[#1c2028] rounded px-3 py-2">
              <div>
                <span className="text-[12px] text-white font-medium">{req.playerName}</span>
                <span className="text-[10px] text-[#6b7280] ml-2">Seat {req.seatIndex + 1} &middot; Buy-in {req.buyIn}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => handleApproveJoin(req.socketId)}
                  className="px-3 py-1 rounded text-[10px] font-bold text-white bg-[#1e40af] border border-[#3b82f680] hover:bg-[#2563eb] transition-all">
                  Approve
                </button>
                <button onClick={() => handleDenyJoin(req.socketId)}
                  className="px-3 py-1 rounded text-[10px] font-bold text-[#6b7280] bg-[#0e1015] border border-[#262b33] hover:text-white transition-all">
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table area */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        {gameState && <Table gameState={gameState} myPlayerId={playerId} timeRemaining={timeRemaining} winners={winners} />}
      </div>

      {/* Deal / Pause — host only */}
      {isHost && canStart && (
        <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <button onClick={handleStart}
            className="px-6 py-2.5 rounded font-bold text-[13px] text-white active:scale-[0.97]"
            style={{ background: '#166534', border: '1px solid rgba(34,197,94,0.25)', boxShadow: '0 4px 16px rgba(34,197,94,0.15)' }}>
            Deal Cards
          </button>
        </div>
      )}
      {isHost && gameState?.phase !== 'waiting' && gameState?.phase !== 'showdown' && (
        <div className="fixed bottom-[70px] right-4 z-40">
          <button onClick={handlePause}
            className="px-4 py-2 rounded text-[11px] font-semibold text-[#6b7280] hover:text-white bg-[#1c2028] border border-[#262b33] transition-all active:scale-[0.97]">
            Pause
          </button>
        </div>
      )}
      {isEliminated && (
        <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <button onClick={handleRebuy}
            className="px-6 py-2.5 rounded font-bold text-[13px] text-white active:scale-[0.97]"
            style={{ background: '#854d0e', border: '1px solid rgba(234,179,8,0.25)' }}>
            Rebuy
          </button>
        </div>
      )}

      {/* Action bar */}
      {validActions.length > 0 && gameState && me && (
        <ActionBar validActions={validActions} gameState={gameState} myChips={me.chips} myBet={me.bet} onAction={handleAction} />
      )}

      {/* Side panels */}
      {gameState && (
        <>
          <GameLog history={gameState.handHistory} isOpen={activePanel === 'log'} onClose={() => togglePanel('log')} />
          <Ledger ledger={gameState.ledger} isOpen={activePanel === 'ledger'} onClose={() => togglePanel('ledger')} />
          <SettingsPanel config={gameState.config} isHost={isHost} isOpen={activePanel === 'settings'}
            onClose={() => togglePanel('settings')} onUpdateConfig={handleUpdateConfig} />
          {me && (
            <PreferencesPanel preferences={me.preferences} isOpen={activePanel === 'prefs'}
              onClose={() => togglePanel('prefs')} onUpdate={handleUpdatePrefs} />
          )}
        </>
      )}

      {/* Toasts */}
      {gameState && <WinnerToast winners={winners} players={gameState.players} />}
      {error && (
        <div className="fixed top-[48px] left-1/2 -translate-x-1/2 z-50 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 px-3 py-1.5 text-[11px] text-[#ef4444] animate-slide-up">
          {error}
        </div>
      )}
    </div>
  );
}
