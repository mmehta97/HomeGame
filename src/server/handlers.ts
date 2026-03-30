import { Server, Socket } from 'socket.io';
import {
  GameConfig,
  GamePhase,
  PlayerActionEvent,
  PlayerPreferences,
  WinResult,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../types';
import {
  addPlayer,
  removePlayer,
  canStartHand,
  startNewHand,
  getValidActions,
  processAction,
  getPublicState,
  calculatePots,
  evaluateHand,
  evaluatePloHand,
  compareHands,
} from '../lib/engine';
import {
  Room,
  createRoom,
  getRoom,
  deleteRoom,
  getRoomBySocketId,
  updateLedger,
  getLedgerEntries,
} from './rooms';
import { trackEvent } from './analytics';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ============================================================
// Broadcast helpers
// ============================================================

function broadcastGameState(io: AppServer, room: Room): void {
  const ledger = getLedgerEntries(room);
  for (const [socketId, playerId] of room.playerSocketMap.entries()) {
    const publicState = getPublicState(room.gameState, playerId);
    io.to(socketId).emit('game:state', { ...publicState, hostId: room.hostId, ledger });
  }
  // Also broadcast to anyone in the socket.io room who isn't a player (observers)
  const playerSocketIds = new Set(room.playerSocketMap.keys());
  io.in(room.id).fetchSockets().then(sockets => {
    for (const s of sockets) {
      if (!playerSocketIds.has(s.id)) {
        const publicState = getPublicState(room.gameState);
        s.emit('game:state', { ...publicState, hostId: room.hostId, ledger });
      }
    }
  });
}

function notifyActionRequired(io: AppServer, room: Room): void {
  const state = room.gameState;
  if (state.activePlayerIndex === -1) return;

  const activePlayer = state.players.find(
    (p) => p.seatIndex === state.activePlayerIndex && p.status === 'active'
  );
  if (!activePlayer) return;

  const validActions = getValidActions(state, activePlayer.id);
  const timeRemaining = state.config.turnTimer > 0 ? state.config.turnTimer : 0;

  for (const [socketId, playerId] of room.playerSocketMap.entries()) {
    if (playerId === activePlayer.id) {
      io.to(socketId).emit('game:action-required', {
        playerId: activePlayer.id,
        timeRemaining,
        validActions,
      });
      break;
    }
  }
}

function clearTurnTimer(room: Room): void {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}

function clearNextHandTimer(room: Room): void {
  if (room.nextHandTimer) { clearTimeout(room.nextHandTimer); room.nextHandTimer = null; }
}

function startTurnTimer(io: AppServer, room: Room): void {
  clearTurnTimer(room);
  const state = room.gameState;
  if (!state.config.turnTimer || state.config.turnTimer <= 0) return;
  if (state.activePlayerIndex === -1) return;
  if (!state.config.autoFoldOnTimeout) return;

  const activePlayer = state.players.find(
    (p) => p.seatIndex === state.activePlayerIndex && p.status === 'active'
  );
  if (!activePlayer) return;

  room.turnTimer = setTimeout(() => {
    const toCall = room.gameState.currentBet - activePlayer.bet;
    const autoAction: PlayerActionEvent = toCall === 0 ? { action: 'check' } : { action: 'fold' };
    const result = processAction(room.gameState, activePlayer.id, autoAction);
    if (!result.error) {
      room.gameState = result.state;
      broadcastGameState(io, room);
      handlePostAction(io, room);
    }
  }, state.config.turnTimer * 1000);
}

/** Deal the next street for all-in runouts with staggered timing */
function dealNextStreet(io: AppServer, room: Room): void {
  const gs = room.gameState;
  const deck = [...gs.deck];
  const cc = [...gs.communityCards];
  const hist = [...gs.handHistory];
  let nextPhase = gs.phase;

  if (gs.phase === 'preflop') {
    cc.push(deck.shift()!, deck.shift()!, deck.shift()!);
    nextPhase = 'flop';
    hist.push({ handNumber: gs.handNumber, action: 'flop', cards: cc.slice(-3), timestamp: Date.now() });
  } else if (gs.phase === 'flop') {
    cc.push(deck.shift()!);
    nextPhase = 'turn';
    hist.push({ handNumber: gs.handNumber, action: 'turn', cards: cc.slice(-1), timestamp: Date.now() });
  } else if (gs.phase === 'turn') {
    cc.push(deck.shift()!);
    nextPhase = 'river';
    hist.push({ handNumber: gs.handNumber, action: 'river', cards: cc.slice(-1), timestamp: Date.now() });
  }

  room.gameState = { ...gs, deck, communityCards: cc, phase: nextPhase as GamePhase, handHistory: hist };
  broadcastGameState(io, room);

  if (nextPhase === 'river') {
    // After river, resolve showdown after a short delay
    room.turnTimer = setTimeout(() => resolveAllInShowdown(io, room), 800);
  } else {
    // Schedule next street
    room.turnTimer = setTimeout(() => dealNextStreet(io, room), 800);
  }
}

/** Resolve showdown for all-in runouts */
function resolveAllInShowdown(io: AppServer, room: Room): void {
  const gs = room.gameState;
  const pots = calculatePots(gs.players);
  const players = gs.players.map(p => ({ ...p }));
  const winners: WinResult[] = [];

  for (let pi = 0; pi < pots.length; pi++) {
    const pot = pots[pi];
    const eligible = pot.eligiblePlayerIds
      .map(id => players.find(p => p.id === id)!)
      .filter(p => p && p.status !== 'folded');

    if (eligible.length === 0) continue;
    if (eligible.length === 1) {
      eligible[0].chips += pot.amount;
      winners.push({ playerId: eligible[0].id, amount: pot.amount, potIndex: pi });
      continue;
    }

    const variant = gs.config.variant;
    const hands = eligible.map(p => ({
      player: p,
      hand: (variant === 'plo4' || variant === 'plo5' || variant === 'plo6')
        ? evaluatePloHand(p.holeCards, gs.communityCards)
        : evaluateHand([...p.holeCards, ...gs.communityCards]),
    }));
    hands.sort((a, b) => compareHands(b.hand, a.hand));
    const bestVal = hands[0].hand.value;
    const potWinners = hands.filter(h => h.hand.value === bestVal);
    const share = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount - share * potWinners.length;
    potWinners.forEach((w, i) => {
      const amt = share + (i === 0 ? remainder : 0);
      w.player.chips += amt;
      winners.push({ playerId: w.player.id, amount: amt, hand: w.hand, potIndex: pi });
    });
  }

  room.gameState = { ...gs, players, pots, phase: 'showdown' as GamePhase, activePlayerIndex: -1, winners };
  broadcastGameState(io, room);
  handlePostAction(io, room);
}

function handlePostAction(io: AppServer, room: Room): void {
  const state = room.gameState;
  if (state.phase === 'showdown') {
    clearTurnTimer(room);
    if (state.winners.length > 0) {
      io.to(room.id).emit('game:winner', state.winners);
    }
    // Increment hands played in ledger
    for (const p of state.players) {
      const entry = room.ledger.get(p.id);
      if (entry && p.status !== 'waiting') entry.handsPlayed++;
    }

    // Process auto top-ups between hands
    const updatedPlayers = room.gameState.players.map(p => {
      if (p.preferences.autoTopUp && p.preferences.autoTopUpApproved &&
          p.preferences.autoTopUpTarget > 0 && p.preferences.autoTopUpThreshold > 0 &&
          p.chips < p.preferences.autoTopUpThreshold && p.chips < p.preferences.autoTopUpTarget) {
        const topUpAmount = p.preferences.autoTopUpTarget - p.chips;
        if (topUpAmount > 0) {
          updateLedger(room, p.id, p.name, topUpAmount);
          return { ...p, chips: p.preferences.autoTopUpTarget };
        }
      }
      return p;
    });
    room.gameState = { ...room.gameState, players: updatedPlayers };

    // Auto-start next hand
    clearNextHandTimer(room);
    room.nextHandTimer = setTimeout(() => {
      if (canStartHand(room.gameState)) {
        room.gameState = startNewHand(room.gameState);
        broadcastGameState(io, room);
        notifyActionRequired(io, room);
        startTurnTimer(io, room);
      }
    }, 5000);
  } else {
    // Check if anyone can act — if not, this is an all-in runout
    const canAct = room.gameState.players.filter(p => p.status === 'active');
    if (canAct.length === 0 && room.gameState.activePlayerIndex === -1) {
      // All-in runout: advance to next street after a delay
      // Flop gets 1.2s (cards peel), turn/river get 0.8s
      const delay = room.gameState.phase === 'preflop' ? 500 : 800;
      clearTurnTimer(room);
      room.turnTimer = setTimeout(() => {
        dealNextStreet(io, room);
      }, delay);
    } else {
      notifyActionRequired(io, room);
      startTurnTimer(io, room);
    }
  }
}

// ============================================================
// Socket event handlers
// ============================================================

export function registerHandlers(io: AppServer, socket: AppSocket): void {

  // --- room:create ---
  socket.on('room:create', (config: GameConfig, callback) => {
    const room = createRoom(config, socket.id);
    socket.join(room.id);
    trackEvent({ type: 'table_created', roomId: room.id, timestamp: Date.now(), data: { variant: config.variant } });
    console.log(`Room ${room.id} created by ${socket.id}`);
    callback(room.id);
  });

  // --- room:info ---
  socket.on('room:info', (roomId: string) => {
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('game:error', 'Room not found');
      return;
    }
    socket.join(roomId);
    const ledger = getLedgerEntries(room);
    socket.emit('game:state', { ...getPublicState(room.gameState), hostId: room.hostId, ledger });
    socket.emit('room:info', {
      id: room.id,
      config: room.gameState.config,
      playerCount: room.gameState.players.length,
      maxPlayers: room.gameState.config.maxPlayers,
      hostId: room.hostId,
      createdAt: room.createdAt,
    });
  });

  // --- room:join ---
  socket.on('room:join', (data, callback) => {
    const { roomId, playerName, seatIndex, buyIn } = data;
    const room = getRoom(roomId);

    if (!room) { callback(false, 'Room not found'); return; }

    if (room.playerSocketMap.get(socket.id)) {
      callback(false, 'Already in this room');
      return;
    }

    // Reconnection: find disconnected player with same name
    const disconnected = room.gameState.players.find(p => p.name === playerName && !p.isConnected);
    if (disconnected) {
      room.playerSocketMap.set(socket.id, disconnected.id);
      room.gameState = {
        ...room.gameState,
        players: room.gameState.players.map(p =>
          p.id === disconnected.id ? { ...p, isConnected: true } : p
        ),
      };
      socket.join(roomId);
      const isHost = room.hostId === disconnected.id;
      socket.emit('room:joined', { roomId, playerId: disconnected.id, seatIndex: disconnected.seatIndex, isHost });
      broadcastGameState(io, room);
      callback(true);
      return;
    }

    // Check for duplicate name
    const nameTaken = room.gameState.players.some(
      p => p.name.toLowerCase() === playerName.toLowerCase() && p.isConnected
    );
    if (nameTaken) { callback(false, 'Name already taken'); return; }

    // First player joins directly as host; others need host approval
    const isFirstPlayer = room.playerSocketMap.size === 0;

    if (!isFirstPlayer) {
      // Queue join request for host approval
      room.pendingJoins.set(socket.id, {
        socketId: socket.id,
        playerName,
        seatIndex,
        buyIn,
        timestamp: Date.now(),
      });
      socket.join(roomId); // Join socket room to receive updates
      socket.emit('room:join-pending');

      // Notify host
      for (const [hostSocketId, pid] of room.playerSocketMap.entries()) {
        if (pid === room.hostId) {
          io.to(hostSocketId).emit('room:join-request', {
            socketId: socket.id, playerName, seatIndex, buyIn, timestamp: Date.now(),
          });
          break;
        }
      }

      callback(true); // Acknowledge receipt (not yet seated)
      return;
    }

    // First player: seat directly as host
    const playerId = socket.id;
    const result = addPlayer(room.gameState, playerId, playerName, seatIndex, buyIn);
    if (result.error) { callback(false, result.error); return; }

    room.gameState = result.state;
    room.playerSocketMap.set(socket.id, playerId);
    room.hostId = playerId;

    // Track in ledger
    updateLedger(room, playerId, playerName, buyIn);

    socket.join(roomId);
    socket.emit('room:joined', { roomId, playerId, seatIndex, isHost: true });

    broadcastGameState(io, room);
    trackEvent({ type: 'player_joined', roomId, timestamp: Date.now(), data: { playerName, seatIndex } });
    console.log(`Player ${playerName} joined room ${roomId} at seat ${seatIndex}`);
    callback(true);
  });

  // --- room:approve-join --- Host approves a pending join (with optional buy-in override)
  socket.on('room:approve-join', (requestSocketId: string, adjustedBuyIn?: number) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    const myId = room.playerSocketMap.get(socket.id);
    if (myId !== room.hostId) return;

    const request = room.pendingJoins.get(requestSocketId);
    if (!request) return;

    room.pendingJoins.delete(requestSocketId);

    // Add the player (use adjusted buy-in if host changed it)
    const finalBuyIn = adjustedBuyIn && adjustedBuyIn > 0 ? adjustedBuyIn : request.buyIn;
    const playerId = requestSocketId;
    const result = addPlayer(room.gameState, playerId, request.playerName, request.seatIndex, finalBuyIn);
    if (result.error) {
      io.to(requestSocketId).emit('room:join-denied', result.error);
      return;
    }

    room.gameState = result.state;
    room.playerSocketMap.set(requestSocketId, playerId);
    updateLedger(room, playerId, request.playerName, finalBuyIn);

    io.to(requestSocketId).emit('room:joined', {
      roomId: room.id, playerId, seatIndex: request.seatIndex, isHost: false,
    });

    broadcastGameState(io, room);
    trackEvent({ type: 'player_joined', roomId: room.id, timestamp: Date.now(), data: { playerName: request.playerName, seatIndex: request.seatIndex } });
    console.log(`Host approved ${request.playerName} to join room ${room.id}`);
  });

  // --- room:deny-join --- Host denies a pending join
  socket.on('room:deny-join', (requestSocketId: string, reason?: string) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;

    const myId = room.playerSocketMap.get(socket.id);
    if (myId !== room.hostId) return;

    room.pendingJoins.delete(requestSocketId);
    io.to(requestSocketId).emit('room:join-denied', reason || 'Host denied your request');
  });

  // --- room:leave ---
  socket.on('room:leave', () => handlePlayerLeave(io, socket));

  // --- game:start --- Host only
  socket.on('game:start', () => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { socket.emit('game:error', 'Not in a room'); return; }

    const playerId = room.playerSocketMap.get(socket.id);
    if (!playerId) { socket.emit('game:error', 'Not seated'); return; }
    if (playerId !== room.hostId) { socket.emit('game:error', 'Only the host can start'); return; }

    if (!canStartHand(room.gameState)) {
      socket.emit('game:error', 'Not enough players');
      return;
    }

    clearNextHandTimer(room);
    room.gameState = startNewHand(room.gameState);
    broadcastGameState(io, room);
    notifyActionRequired(io, room);
    startTurnTimer(io, room);
    trackEvent({ type: 'hand_started', roomId: room.id, timestamp: Date.now(), data: { handNumber: room.gameState.handNumber } });
    console.log(`Hand #${room.gameState.handNumber} in room ${room.id}`);
  });

  // --- game:pause --- Host only, stops auto-deal of next hand
  socket.on('game:pause', () => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { socket.emit('game:error', 'Not in a room'); return; }

    const playerId = room.playerSocketMap.get(socket.id);
    if (!playerId || playerId !== room.hostId) {
      socket.emit('game:error', 'Only the host can pause');
      return;
    }

    clearNextHandTimer(room);
    clearTurnTimer(room);
    // Set phase to waiting if we're between hands (showdown)
    if (room.gameState.phase === 'showdown') {
      room.gameState = { ...room.gameState, phase: 'waiting' };
    }
    broadcastGameState(io, room);
    console.log(`Game paused in room ${room.id}`);
  });

  // --- game:action ---
  socket.on('game:action', (action: PlayerActionEvent, callback) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { callback(false, 'Not in a room'); return; }

    const playerId = room.playerSocketMap.get(socket.id);
    if (!playerId) { callback(false, 'Player not found'); return; }

    const player = room.gameState.players.find(p => p.id === playerId);
    if (!player || player.seatIndex !== room.gameState.activePlayerIndex) {
      callback(false, 'Not your turn');
      return;
    }

    const result = processAction(room.gameState, playerId, action);
    if (result.error) { callback(false, result.error); return; }

    clearTurnTimer(room);
    room.gameState = result.state;
    broadcastGameState(io, room);
    handlePostAction(io, room);
    callback(true);
  });

  // --- game:rebuy ---
  socket.on('game:rebuy', (amount: number, callback) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { callback(false, 'Not in a room'); return; }

    const playerId = room.playerSocketMap.get(socket.id);
    if (!playerId) { callback(false, 'Player not found'); return; }

    const player = room.gameState.players.find(p => p.id === playerId);
    if (!player) { callback(false, 'Player not found'); return; }

    if (player.chips > 0 && player.status !== 'waiting') {
      callback(false, 'Cannot rebuy while in play');
      return;
    }

    const { config } = room.gameState;
    if (amount <= 0) { callback(false, 'Amount must be greater than 0'); return; }
    const minChips = config.minBuyIn > 0 ? config.minBuyIn * config.bigBlind : 0;
    const maxChips = config.maxBuyIn > 0 ? config.maxBuyIn * config.bigBlind : Infinity;
    if (minChips > 0 && amount < minChips) { callback(false, `Minimum rebuy is ${minChips}`); return; }
    if (maxChips < Infinity && amount > maxChips) { callback(false, `Maximum rebuy is ${maxChips}`); return; }

    room.gameState = {
      ...room.gameState,
      players: room.gameState.players.map(p =>
        p.id === playerId ? { ...p, chips: p.chips + amount, status: 'waiting' as const } : p
      ),
    };

    updateLedger(room, playerId, player.name, amount);
    broadcastGameState(io, room);
    callback(true);
  });

  // --- game:update-config --- Host only
  socket.on('game:update-config', (configUpdate: Partial<GameConfig>, callback) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { callback(false, 'Not in a room'); return; }

    const playerId = room.playerSocketMap.get(socket.id);
    if (playerId !== room.hostId) {
      callback(false, 'Only the host can change settings');
      return;
    }

    // Apply config changes (takes effect next hand for blinds/variant, immediately for timer etc.)
    room.gameState = {
      ...room.gameState,
      config: { ...room.gameState.config, ...configUpdate },
    };

    broadcastGameState(io, room);
    callback(true);
  });

  // --- game:update-stack --- Host only
  socket.on('game:update-stack', (data: { playerId: string; newStack: number }, callback) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { callback(false, 'Not in a room'); return; }

    const myPlayerId = room.playerSocketMap.get(socket.id);
    if (myPlayerId !== room.hostId) {
      callback(false, 'Only the host can change stacks');
      return;
    }

    const target = room.gameState.players.find(p => p.id === data.playerId);
    if (!target) { callback(false, 'Player not found'); return; }

    const diff = data.newStack - target.chips;
    room.gameState = {
      ...room.gameState,
      players: room.gameState.players.map(p =>
        p.id === data.playerId ? { ...p, chips: data.newStack } : p
      ),
    };

    // Update ledger if adding chips
    if (diff > 0) {
      updateLedger(room, data.playerId, target.name, diff);
    }

    broadcastGameState(io, room);
    callback(true);
  });

  // --- player:update-preferences ---
  socket.on('player:update-preferences', (prefs: Partial<PlayerPreferences>, callback) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { callback(false, 'Not in a room'); return; }

    const playerId = room.playerSocketMap.get(socket.id);
    if (!playerId) { callback(false, 'Not seated'); return; }

    room.gameState = {
      ...room.gameState,
      players: room.gameState.players.map(p =>
        p.id === playerId
          ? { ...p, preferences: { ...p.preferences, ...prefs, autoTopUpApproved: p.preferences.autoTopUpApproved } }
          : p
      ),
    };

    broadcastGameState(io, room);
    callback(true);
  });

  // --- player:approve-topup --- Host approves a player's auto top-up
  socket.on('player:approve-topup', (targetPlayerId: string, callback) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) { callback(false, 'Not in a room'); return; }

    const myId = room.playerSocketMap.get(socket.id);
    if (myId !== room.hostId) { callback(false, 'Only host can approve'); return; }

    const target = room.gameState.players.find(p => p.id === targetPlayerId);
    if (!target) { callback(false, 'Player not found'); return; }

    room.gameState = {
      ...room.gameState,
      players: room.gameState.players.map(p =>
        p.id === targetPlayerId
          ? { ...p, preferences: { ...p.preferences, autoTopUpApproved: true } }
          : p
      ),
    };

    broadcastGameState(io, room);
    callback(true);
  });

  // --- chat:send ---
  socket.on('chat:send', (message: string) => {
    const room = getRoomBySocketId(socket.id);
    if (!room) return;
    const playerId = room.playerSocketMap.get(socket.id);
    if (!playerId) return;
    const player = room.gameState.players.find(p => p.id === playerId);
    if (!player) return;
    io.to(room.id).emit('chat:message', { playerName: player.name, message, timestamp: Date.now() });
  });

  // --- disconnect ---
  socket.on('disconnect', () => handlePlayerDisconnect(io, socket));
}

// ============================================================
// Disconnect / leave helpers
// ============================================================

function handlePlayerLeave(io: AppServer, socket: AppSocket): void {
  const room = getRoomBySocketId(socket.id);
  if (!room) return;

  const playerId = room.playerSocketMap.get(socket.id);
  if (!playerId) return;

  const player = room.gameState.players.find(p => p.id === playerId);

  // Fold if it's their turn
  if (player && player.status === 'active' && player.seatIndex === room.gameState.activePlayerIndex) {
    const result = processAction(room.gameState, playerId, { action: 'fold' });
    if (!result.error) room.gameState = result.state;
  }

  // Update ledger with cash-out
  const entry = room.ledger.get(playerId);
  if (entry && player) {
    entry.cashOut = player.chips;
    entry.netResult = player.chips - entry.buyIns;
    entry.isActive = false;
  }

  room.gameState = removePlayer(room.gameState, playerId);
  room.playerSocketMap.delete(socket.id);
  socket.leave(room.id);
  io.to(room.id).emit('room:player-left', playerId);

  // Transfer host
  if (room.hostId === playerId) {
    if (room.playerSocketMap.size === 0) {
      deleteRoom(room.id);
      return;
    }
    const [, newHostId] = [...room.playerSocketMap.entries()][0];
    room.hostId = newHostId;
  }

  if (room.playerSocketMap.size === 0) { deleteRoom(room.id); return; }
  broadcastGameState(io, room);
}

function handlePlayerDisconnect(io: AppServer, socket: AppSocket): void {
  const room = getRoomBySocketId(socket.id);
  if (!room) return;

  const playerId = room.playerSocketMap.get(socket.id);
  if (!playerId) return;

  const player = room.gameState.players.find(p => p.id === playerId);
  if (!player) return;

  room.gameState = {
    ...room.gameState,
    players: room.gameState.players.map(p =>
      p.id === playerId ? { ...p, isConnected: false } : p
    ),
  };

  // Auto-fold after grace period
  if (player.status === 'active' && player.seatIndex === room.gameState.activePlayerIndex) {
    clearTurnTimer(room);
    room.turnTimer = setTimeout(() => {
      const current = room.gameState.players.find(p => p.id === playerId);
      if (current && !current.isConnected && current.seatIndex === room.gameState.activePlayerIndex) {
        const toCall = room.gameState.currentBet - current.bet;
        const autoAction: PlayerActionEvent = toCall === 0 ? { action: 'check' } : { action: 'fold' };
        const result = processAction(room.gameState, playerId, autoAction);
        if (!result.error) {
          room.gameState = result.state;
          broadcastGameState(io, room);
          handlePostAction(io, room);
        }
      }
    }, 10000);
  }

  room.playerSocketMap.delete(socket.id);

  // Transfer host
  if (room.hostId === playerId && room.playerSocketMap.size > 0) {
    const [, newHostId] = [...room.playerSocketMap.entries()][0];
    room.hostId = newHostId;
  }

  broadcastGameState(io, room);
}
