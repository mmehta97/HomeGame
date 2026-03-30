import {
  GameState, GameConfig, Player, PlayerAction, PlayerActionEvent,
  BettingRound, GamePhase, HandHistoryEntry, WinResult, Card, ValidAction, Pot,
  PlayerPreferences,
} from '@/types';

const DEFAULT_PREFERENCES: PlayerPreferences = {
  autoStraddle: false,
  runItPref: 'ask',
  deckColor: '2color',
  autoTopUp: false,
  autoTopUpTarget: 0,
  autoTopUpThreshold: 0,
  autoTopUpApproved: false,
};
import { createDeck, shuffleDeck, dealCards } from './deck';
import { evaluateHand, compareHands } from './handEvaluator';
import { evaluatePloHand } from './ploEvaluator';
import { calculatePots } from './potCalculator';

/** Evaluate a hand based on game variant */
function evaluateHandForVariant(holeCards: Card[], communityCards: Card[], variant: string): ReturnType<typeof evaluateHand> {
  if (variant === 'plo4' || variant === 'plo5' || variant === 'plo6') {
    return evaluatePloHand(holeCards, communityCards);
  }
  return evaluateHand([...holeCards, ...communityCards]);
}

export function createDefaultConfig(): GameConfig {
  return {
    variant: 'nlh',
    smallBlind: 1,
    bigBlind: 2,
    minBuyIn: 0,   // 0 = no minimum
    maxBuyIn: 0,   // 0 = no maximum
    turnTimer: 30,
    timeBank: 30,
    autoFoldOnTimeout: true,
    allowStraddle: false,
    ante: 0,
    bbAnte: false,
    runItTwice: false,
    maxPlayers: 9,
  };
}

export function createGameState(id: string, config: GameConfig): GameState {
  return {
    id,
    config,
    players: [],
    communityCards: [],
    deck: [],
    pots: [],
    phase: 'waiting',
    dealerIndex: -1,
    activePlayerIndex: -1,
    currentBet: 0,
    minRaise: config.bigBlind,
    lastRaiserIndex: -1,
    handNumber: 0,
    turnStartedAt: 0,
    winners: [],
    handHistory: [],
  };
}

export function addPlayer(
  state: GameState,
  id: string,
  name: string,
  seatIndex: number,
  buyIn: number,
): { state: GameState; error?: string } {
  // Variant-specific max player limits
  const variantMaxPlayers: Record<string, number> = { nlh: 9, plo4: 9, plo5: 8, plo6: 7 };
  const hardMax = variantMaxPlayers[state.config.variant] || 9;
  const effectiveMax = Math.min(state.config.maxPlayers, hardMax);

  if (seatIndex < 0 || seatIndex >= effectiveMax) {
    return { state, error: `Max ${effectiveMax} players for ${state.config.variant.toUpperCase()}` };
  }
  if (state.players.find(p => p.seatIndex === seatIndex)) {
    return { state, error: 'Seat taken' };
  }
  if (state.players.find(p => p.id === id)) {
    return { state, error: 'Already seated' };
  }
  if (buyIn <= 0) {
    return { state, error: 'Buy-in must be greater than 0' };
  }
  const minChips = state.config.minBuyIn > 0 ? state.config.minBuyIn * state.config.bigBlind : 0;
  const maxChips = state.config.maxBuyIn > 0 ? state.config.maxBuyIn * state.config.bigBlind : Infinity;
  if (minChips > 0 && buyIn < minChips) {
    return { state, error: `Minimum buy-in is ${minChips}` };
  }
  if (maxChips < Infinity && buyIn > maxChips) {
    return { state, error: `Maximum buy-in is ${maxChips}` };
  }

  const player: Player = {
    id, name, seatIndex, chips: buyIn, bet: 0, totalBet: 0,
    holeCards: [], status: 'waiting', isConnected: true,
    preferences: { ...DEFAULT_PREFERENCES },
  };

  return {
    state: { ...state, players: [...state.players, player].sort((a, b) => a.seatIndex - b.seatIndex) },
  };
}

export function removePlayer(state: GameState, playerId: string): GameState {
  return { ...state, players: state.players.filter(p => p.id !== playerId) };
}

// ============================================================
// Starting a new hand
// ============================================================

export function canStartHand(state: GameState): boolean {
  const activePlayers = state.players.filter(p => p.chips > 0 && p.status !== 'sitting-out');
  return activePlayers.length >= 2;
}

export function startNewHand(state: GameState): GameState {
  if (!canStartHand(state)) return state;

  const activePlayers = state.players.filter(p => p.chips > 0 && p.status !== 'sitting-out');

  // Advance dealer button
  const dealerSeat = findNextActiveSeat(state, state.dealerIndex, activePlayers);

  // Reset players for new hand
  const players = state.players.map(p => {
    if (p.chips > 0 && p.status !== 'sitting-out') {
      return { ...p, bet: 0, totalBet: 0, holeCards: [] as Card[], status: 'active' as const, lastAction: undefined };
    }
    return { ...p, bet: 0, totalBet: 0, holeCards: [] as Card[], status: 'waiting' as const, lastAction: undefined };
  });

  // Create and shuffle deck
  let deck = shuffleDeck(createDeck());

  // Deal hole cards (2 for NLH, 4 for PLO)
  const holeCardCounts: Record<string, number> = { nlh: 2, plo4: 4, plo5: 5, plo6: 6 };
  const numHoleCards = holeCardCounts[state.config.variant] || 2;
  const inHand = players.filter(p => p.status === 'active');
  for (const player of inHand) {
    const { dealt, remaining } = dealCards(deck, numHoleCards);
    player.holeCards = dealt;
    deck = remaining;
  }

  const handNumber = state.handNumber + 1;
  const history: HandHistoryEntry[] = [{
    handNumber, action: 'Hand started', timestamp: Date.now(),
  }];

  let newState: GameState = {
    ...state,
    players,
    deck,
    communityCards: [],
    pots: [],
    phase: 'preflop',
    dealerIndex: dealerSeat,
    currentBet: 0,
    minRaise: state.config.bigBlind,
    lastRaiserIndex: -1,
    handNumber,
    turnStartedAt: Date.now(),
    winners: [],
    handHistory: history,
  };

  // Post blinds and antes
  newState = postBlinds(newState, activePlayers);

  return newState;
}

function postBlinds(state: GameState, activePlayers: Player[]): GameState {
  const players = [...state.players.map(p => ({ ...p }))];
  const { config, dealerIndex } = state;
  const history = [...state.handHistory];
  const inHand = players.filter(p => p.status === 'active');

  // Post antes
  if (config.ante > 0) {
    for (const p of inHand) {
      const player = players.find(pl => pl.id === p.id)!;
      const anteAmount = Math.min(config.ante, player.chips);
      player.chips -= anteAmount;
      player.bet += anteAmount;
      player.totalBet += anteAmount;
      if (player.chips === 0) player.status = 'all-in';
      history.push({
        handNumber: state.handNumber, action: 'ante', playerName: player.name,
        amount: anteAmount, timestamp: Date.now(),
      });
    }
  }

  // In heads-up (2 players), dealer is small blind
  const isHeadsUp = inHand.length === 2;

  let sbSeat: number, bbSeat: number;
  if (isHeadsUp) {
    sbSeat = dealerIndex;
    bbSeat = findNextActiveSeat(state, dealerIndex, inHand);
  } else {
    sbSeat = findNextActiveSeat(state, dealerIndex, inHand);
    bbSeat = findNextActiveSeat(state, sbSeat, inHand);
  }

  // Post small blind
  const sbPlayer = players.find(p => p.seatIndex === sbSeat)!;
  const sbAmount = Math.min(config.smallBlind, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.bet += sbAmount;
  sbPlayer.totalBet += sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.status = 'all-in';
  history.push({
    handNumber: state.handNumber, action: 'small blind', playerName: sbPlayer.name,
    amount: sbAmount, timestamp: Date.now(),
  });

  // Post big blind
  const bbPlayer = players.find(p => p.seatIndex === bbSeat)!;
  const bbAmount = Math.min(config.bigBlind, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.bet += bbAmount;
  bbPlayer.totalBet += bbAmount;
  if (bbPlayer.chips === 0) bbPlayer.status = 'all-in';
  history.push({
    handNumber: state.handNumber, action: 'big blind', playerName: bbPlayer.name,
    amount: bbAmount, timestamp: Date.now(),
  });

  // First to act preflop is after BB
  const firstToAct = findNextActiveSeatForAction(
    { ...state, players },
    bbSeat,
    players.filter(p => p.status === 'active'),
  );

  return {
    ...state,
    players,
    currentBet: config.bigBlind,
    minRaise: config.bigBlind,
    activePlayerIndex: firstToAct,
    lastRaiserIndex: bbSeat, // BB is the "last raiser" preflop
    turnStartedAt: Date.now(),
    handHistory: history,
  };
}

// ============================================================
// Processing player actions
// ============================================================

export function getValidActions(state: GameState, playerId: string): ValidAction[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.status !== 'active' || player.seatIndex !== state.activePlayerIndex) {
    return [];
  }

  const actions: ValidAction[] = [];
  const toCall = state.currentBet - player.bet;

  // Fold is always available if there's a bet to call
  if (toCall > 0) {
    actions.push({ action: 'fold' });
  }

  // Check if no bet to call
  if (toCall === 0) {
    actions.push({ action: 'check' });
  }

  // Call
  if (toCall > 0 && player.chips > toCall) {
    actions.push({ action: 'call', minAmount: toCall, maxAmount: toCall });
  }

  // Raise — pot-limit for PLO, no-limit for NLH
  const minRaiseTotal = state.currentBet + state.minRaise;
  let maxRaiseChips = player.chips; // NLH default: can raise up to all chips

  if (state.config.variant === 'plo4' || state.config.variant === 'plo5' || state.config.variant === 'plo6') {
    // Pot-limit: max raise = pot + all bets + the call amount (before raising)
    const potTotal = state.pots.reduce((s, p) => s + p.amount, 0);
    const allBets = state.players.reduce((s, p) => s + p.bet, 0);
    const potAfterCall = potTotal + allBets + toCall;
    const maxRaiseSize = potAfterCall; // Can raise by up to the pot
    const maxRaiseTotal = state.currentBet + maxRaiseSize;
    maxRaiseChips = Math.min(player.chips, maxRaiseTotal - player.bet);
  }

  const maxRaiseTotalBet = player.chips + player.bet;
  if (player.chips > toCall && maxRaiseTotalBet > state.currentBet) {
    actions.push({
      action: 'raise',
      minAmount: Math.min(minRaiseTotal - player.bet, player.chips),
      maxAmount: maxRaiseChips,
    });
  }

  // All-in (always available)
  if (player.chips > 0) {
    actions.push({ action: 'all-in', minAmount: player.chips, maxAmount: player.chips });
  }

  return actions;
}

export function processAction(
  state: GameState,
  playerId: string,
  action: PlayerActionEvent,
): { state: GameState; error?: string } {
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return { state, error: 'Player not found' };

  const player = state.players[playerIdx];
  if (player.seatIndex !== state.activePlayerIndex) {
    return { state, error: 'Not your turn' };
  }
  if (player.status !== 'active') {
    return { state, error: 'Cannot act' };
  }

  const players = state.players.map(p => ({ ...p }));
  const actingPlayer = players[playerIdx];
  const history = [...state.handHistory];
  let { currentBet, minRaise, lastRaiserIndex } = state;

  const toCall = currentBet - actingPlayer.bet;

  switch (action.action) {
    case 'fold': {
      actingPlayer.status = 'folded';
      actingPlayer.lastAction = 'fold';
      history.push({
        handNumber: state.handNumber, action: 'fold', playerName: actingPlayer.name,
        timestamp: Date.now(),
      });
      break;
    }

    case 'check': {
      if (toCall > 0) return { state, error: 'Cannot check, must call or fold' };
      actingPlayer.lastAction = 'check';
      history.push({
        handNumber: state.handNumber, action: 'check', playerName: actingPlayer.name,
        timestamp: Date.now(),
      });
      break;
    }

    case 'call': {
      if (toCall === 0) return { state, error: 'Nothing to call' };
      const callAmount = Math.min(toCall, actingPlayer.chips);
      actingPlayer.chips -= callAmount;
      actingPlayer.bet += callAmount;
      actingPlayer.totalBet += callAmount;
      actingPlayer.lastAction = 'call';
      if (actingPlayer.chips === 0) actingPlayer.status = 'all-in';
      history.push({
        handNumber: state.handNumber, action: 'call', playerName: actingPlayer.name,
        amount: callAmount, timestamp: Date.now(),
      });
      break;
    }

    case 'raise': {
      const raiseAmount = action.amount!;
      if (raiseAmount > actingPlayer.chips) return { state, error: 'Not enough chips' };

      const newBetTotal = actingPlayer.bet + raiseAmount;
      const raiseSize = newBetTotal - currentBet;

      // Validate min raise (unless all-in)
      if (raiseSize < minRaise && raiseAmount < actingPlayer.chips) {
        return { state, error: `Min raise is ${minRaise}` };
      }

      actingPlayer.chips -= raiseAmount;
      actingPlayer.bet += raiseAmount;
      actingPlayer.totalBet += raiseAmount;
      actingPlayer.lastAction = 'raise';
      if (actingPlayer.chips === 0) actingPlayer.status = 'all-in';

      if (raiseSize >= minRaise) {
        minRaise = raiseSize;
      }
      currentBet = actingPlayer.bet;
      lastRaiserIndex = actingPlayer.seatIndex;

      history.push({
        handNumber: state.handNumber, action: 'raise', playerName: actingPlayer.name,
        amount: raiseAmount, timestamp: Date.now(),
      });
      break;
    }

    case 'all-in': {
      const allInAmount = actingPlayer.chips;
      const newBetTotal = actingPlayer.bet + allInAmount;

      actingPlayer.chips = 0;
      actingPlayer.bet = newBetTotal;
      actingPlayer.totalBet += allInAmount;
      actingPlayer.status = 'all-in';
      actingPlayer.lastAction = 'all-in';

      if (newBetTotal > currentBet) {
        const raiseSize = newBetTotal - currentBet;
        if (raiseSize >= minRaise) {
          minRaise = raiseSize;
          lastRaiserIndex = actingPlayer.seatIndex;
        }
        currentBet = newBetTotal;
        lastRaiserIndex = actingPlayer.seatIndex;
      }

      history.push({
        handNumber: state.handNumber, action: 'all-in', playerName: actingPlayer.name,
        amount: allInAmount, timestamp: Date.now(),
      });
      break;
    }

    default:
      return { state, error: 'Invalid action' };
  }

  let newState: GameState = {
    ...state,
    players,
    currentBet,
    minRaise,
    lastRaiserIndex,
    handHistory: history,
  };

  // Check if hand is over (only 1 non-folded player)
  const nonFolded = players.filter(p => p.status === 'active' || p.status === 'all-in');
  if (nonFolded.length === 1) {
    return { state: awardPotToLastPlayer(newState, nonFolded[0]) };
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(newState)) {
    newState = advancePhase(newState);
  } else {
    // Move to next player
    const activeInRound = players.filter(p => p.status === 'active');
    if (activeInRound.length > 0) {
      const nextSeat = findNextActiveSeatForAction(newState, actingPlayer.seatIndex, activeInRound);
      newState = { ...newState, activePlayerIndex: nextSeat, turnStartedAt: Date.now() };
    } else {
      // All remaining players are all-in or folded — run out the board
      newState = advancePhase(newState);
    }
  }

  return { state: newState };
}

function isBettingRoundComplete(state: GameState): boolean {
  const { players, currentBet, lastRaiserIndex } = state;
  const activePlayers = players.filter(p => p.status === 'active');

  // If no one is active (all folded or all-in), round is done
  if (activePlayers.length === 0) return true;

  // All active players must have matched the current bet and had a chance to act
  const allMatched = activePlayers.every(p => p.bet === currentBet);
  if (!allMatched) return false;

  // Everyone has acted (check via lastAction) or it has gone around to the last raiser
  const allActed = activePlayers.every(p => p.lastAction !== undefined);
  if (!allActed) return false;

  // Find next player after current — if it's the last raiser, round is complete
  const nextSeat = findNextActiveSeatForAction(state, state.activePlayerIndex, activePlayers);
  return nextSeat === lastRaiserIndex || allMatched;
}

function advancePhase(state: GameState): GameState {
  const players = state.players.map(p => ({
    ...p,
    bet: 0,
    lastAction: undefined,
  }));

  // Collect bets into pots
  const pots = calculatePots(state.players);

  const activePlayers = players.filter(p => p.status === 'active' || p.status === 'all-in');
  const canAct = players.filter(p => p.status === 'active');
  const history = [...state.handHistory];

  let { communityCards, deck } = state;
  const { phase } = state;

  const nextPhase = getNextPhase(phase as BettingRound);

  // Deal community cards
  switch (nextPhase) {
    case 'flop': {
      const { dealt, remaining } = dealCards(deck, 3);
      communityCards = [...communityCards, ...dealt];
      deck = remaining;
      history.push({
        handNumber: state.handNumber, action: 'flop', cards: dealt, timestamp: Date.now(),
      });
      break;
    }
    case 'turn': {
      const { dealt, remaining } = dealCards(deck, 1);
      communityCards = [...communityCards, ...dealt];
      deck = remaining;
      history.push({
        handNumber: state.handNumber, action: 'turn', cards: dealt, timestamp: Date.now(),
      });
      break;
    }
    case 'river': {
      const { dealt, remaining } = dealCards(deck, 1);
      communityCards = [...communityCards, ...dealt];
      deck = remaining;
      history.push({
        handNumber: state.handNumber, action: 'river', cards: dealt, timestamp: Date.now(),
      });
      break;
    }
    case 'showdown': {
      const newState: GameState = {
        ...state,
        players,
        communityCards,
        deck,
        pots,
        phase: 'showdown',
        activePlayerIndex: -1,
        handHistory: history,
      };
      return resolveShowdown(newState);
    }
  }

  // If only 0 or 1 players can still act, just advance to next phase (no action needed)
  // Server handles staggered dealing for all-in runouts
  if (canAct.length <= 1) {
    return {
      ...state, players, communityCards, deck, pots,
      phase: nextPhase as GamePhase, activePlayerIndex: -1,
      currentBet: 0, minRaise: state.config.bigBlind,
      lastRaiserIndex: -1, turnStartedAt: Date.now(), handHistory: history,
    };
  }

  // Set first to act (first active player after dealer)
  const firstToAct = findNextActiveSeatForAction(
    { ...state, players },
    state.dealerIndex,
    canAct,
  );

  return {
    ...state,
    players,
    communityCards,
    deck,
    pots,
    phase: nextPhase as GamePhase,
    currentBet: 0,
    minRaise: state.config.bigBlind,
    activePlayerIndex: firstToAct,
    lastRaiserIndex: -1,
    turnStartedAt: Date.now(),
    handHistory: history,
  };
}

function getNextPhase(current: BettingRound | GamePhase): string {
  switch (current) {
    case 'preflop': return 'flop';
    case 'flop': return 'turn';
    case 'turn': return 'river';
    case 'river': return 'showdown';
    default: return 'showdown';
  }
}

function resolveShowdown(state: GameState): GameState {
  const players = state.players.map(p => ({ ...p }));
  const pots = state.pots.length > 0 ? state.pots : calculatePots(state.players);
  const winners: WinResult[] = [];
  const history = [...state.handHistory];

  for (let potIdx = 0; potIdx < pots.length; potIdx++) {
    const pot = pots[potIdx];
    const eligible = pot.eligiblePlayerIds
      .map(id => players.find(p => p.id === id)!)
      .filter(p => p.status !== 'folded');

    if (eligible.length === 0) continue;

    if (eligible.length === 1) {
      const winner = eligible[0];
      winner.chips += pot.amount;
      winners.push({ playerId: winner.id, amount: pot.amount, potIndex: potIdx });
      continue;
    }

    // Evaluate hands
    const hands = eligible.map(p => ({
      player: p,
      hand: evaluateHandForVariant(p.holeCards, state.communityCards, state.config.variant),
    }));

    // Sort by hand value (best first)
    hands.sort((a, b) => compareHands(b.hand, a.hand));

    // Find all winners (ties)
    const bestValue = hands[0].hand.value;
    const potWinners = hands.filter(h => h.hand.value === bestValue);

    // Split pot among winners
    const share = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount - share * potWinners.length;

    potWinners.forEach((w, i) => {
      const amount = share + (i === 0 ? remainder : 0); // First winner gets remainder
      w.player.chips += amount;
      winners.push({
        playerId: w.player.id,
        amount,
        hand: w.hand,
        potIndex: potIdx,
      });
    });

    // Log
    for (const w of potWinners) {
      history.push({
        handNumber: state.handNumber,
        action: `wins ${share}`,
        playerName: w.player.name,
        timestamp: Date.now(),
      });
    }
  }

  return {
    ...state,
    players,
    pots,
    phase: 'showdown',
    activePlayerIndex: -1,
    winners,
    handHistory: history,
  };
}

function awardPotToLastPlayer(state: GameState, winner: Player): GameState {
  const players = state.players.map(p => ({ ...p }));
  const pots = calculatePots(state.players);
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  const w = players.find(p => p.id === winner.id)!;
  w.chips += totalPot;

  const history = [...state.handHistory, {
    handNumber: state.handNumber,
    action: `wins ${totalPot} (uncontested)`,
    playerName: w.name,
    timestamp: Date.now(),
  }];

  return {
    ...state,
    players,
    pots: [{ amount: totalPot, eligiblePlayerIds: [winner.id] }],
    phase: 'showdown',
    activePlayerIndex: -1,
    winners: [{ playerId: winner.id, amount: totalPot, potIndex: 0 }],
    handHistory: history,
  };
}

// ============================================================
// Seat-finding helpers
// ============================================================

function findNextActiveSeat(state: GameState, fromSeat: number, activePlayers: Player[]): number {
  const seats = activePlayers.map(p => p.seatIndex).sort((a, b) => a - b);
  if (seats.length === 0) return fromSeat;

  for (const seat of seats) {
    if (seat > fromSeat) return seat;
  }
  return seats[0]; // Wrap around
}

function findNextActiveSeatForAction(state: GameState, fromSeat: number, activePlayers: Player[]): number {
  // Same as findNextActiveSeat but only players with status 'active' (not all-in)
  const canAct = activePlayers.filter(p => p.status === 'active');
  if (canAct.length === 0) return -1;
  return findNextActiveSeat(state, fromSeat, canAct);
}

// ============================================================
// Public state (hides hole cards)
// ============================================================

export function getPublicState(state: GameState, forPlayerId?: string) {
  return {
    id: state.id,
    config: state.config,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      seatIndex: p.seatIndex,
      chips: p.chips,
      bet: p.bet,
      totalBet: p.totalBet,
      hasCards: p.holeCards.length > 0,
      status: p.status,
      isConnected: p.isConnected,
      lastAction: p.lastAction,
      // Only reveal hole cards to the player themselves, or at showdown for non-folded
      holeCards: p.id === forPlayerId
        ? p.holeCards
        : (state.phase === 'showdown' && p.status !== 'folded' ? p.holeCards : undefined),
      preferences: p.preferences,
    })),
    communityCards: state.communityCards,
    pots: state.pots.length > 0 ? state.pots : (
      state.players.some(p => p.bet > 0)
        ? [{ amount: state.players.reduce((s, p) => s + p.bet, 0), eligiblePlayerIds: [] }]
        : []
    ),
    phase: state.phase,
    dealerIndex: state.dealerIndex,
    activePlayerIndex: state.activePlayerIndex,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    handNumber: state.handNumber,
    turnStartedAt: state.turnStartedAt,
    winners: state.winners,
    handHistory: state.handHistory,
  };
}

/**
 * Calculate max number of times the board can be run given remaining deck and community cards needed.
 * 52 cards total - hole cards dealt - community cards already out = remaining deck.
 * Each run needs (5 - communityCards.length) cards.
 */
export function maxRunItTimes(state: GameState): number {
  const remainingDeck = state.deck.length;
  const cardsNeeded = 5 - state.communityCards.length;
  if (cardsNeeded <= 0) return 1;
  return Math.max(1, Math.floor(remainingDeck / cardsNeeded));
}

export { calculatePots };
