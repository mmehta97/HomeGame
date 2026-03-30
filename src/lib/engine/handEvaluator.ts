import { Card, HandResult, HandRankName, Rank } from '@/types';
import { rankValue } from './deck';

// Hand rank constants (higher = better)
const HAND_RANKS: { rank: number; name: HandRankName }[] = [
  { rank: 0, name: 'High Card' },
  { rank: 1, name: 'One Pair' },
  { rank: 2, name: 'Two Pair' },
  { rank: 3, name: 'Three of a Kind' },
  { rank: 4, name: 'Straight' },
  { rank: 5, name: 'Flush' },
  { rank: 6, name: 'Full House' },
  { rank: 7, name: 'Four of a Kind' },
  { rank: 8, name: 'Straight Flush' },
  { rank: 9, name: 'Royal Flush' },
];

const RANK_NAMES: Record<Rank, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five',
  '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
  'T': 'Ten', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace',
};

/**
 * Evaluate the best 5-card hand from any number of cards (typically 7).
 * Returns a HandResult with a numeric value for comparison.
 */
export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards, got ${cards.length}`);
  }

  const combos = getCombinations(cards, 5);
  let bestResult: HandResult | null = null;

  for (const combo of combos) {
    const result = evaluate5Cards(combo);
    if (!bestResult || result.value > bestResult.value) {
      bestResult = result;
    }
  }

  return bestResult!;
}

/**
 * Evaluate exactly 5 cards.
 */
function evaluate5Cards(cards: Card[]): HandResult {
  const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
  const values = sorted.map(c => rankValue(c.rank));

  const isFlush = sorted.every(c => c.suit === sorted[0].suit);
  const isStraight = checkStraight(values);
  const isWheel = checkWheel(values);

  // Count rank occurrences
  const rankCounts = new Map<number, number>();
  for (const v of values) {
    rankCounts.set(v, (rankCounts.get(v) || 0) + 1);
  }
  const counts = Array.from(rankCounts.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  // Straight flush / Royal flush
  if (isFlush && (isStraight || isWheel)) {
    const highCard = isStraight ? values[0] : 5; // Wheel: 5-high
    if (isStraight && values[0] === 14) {
      return makeResult(9, 'Royal Flush', [14, 13, 12, 11, 10], sorted, 'Royal Flush');
    }
    const straightValues = isWheel ? [5, 4, 3, 2, 1] : values;
    return makeResult(8, 'Straight Flush', [highCard], sorted,
      `Straight Flush, ${RANK_NAMES[sorted[isWheel ? 4 : 0].rank]}-high`);
  }

  // Four of a kind
  if (counts[0][1] === 4) {
    const quadRank = counts[0][0];
    const kicker = counts[1][0];
    return makeResult(7, 'Four of a Kind', [quadRank, kicker], sorted,
      `Four of a Kind, ${rankToName(quadRank)}s`);
  }

  // Full house
  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return makeResult(6, 'Full House', [counts[0][0], counts[1][0]], sorted,
      `Full House, ${rankToName(counts[0][0])}s full of ${rankToName(counts[1][0])}s`);
  }

  // Flush
  if (isFlush) {
    return makeResult(5, 'Flush', values, sorted,
      `Flush, ${RANK_NAMES[sorted[0].rank]}-high`);
  }

  // Straight
  if (isStraight || isWheel) {
    const highCard = isWheel ? 5 : values[0];
    return makeResult(4, 'Straight', [highCard], sorted,
      `Straight, ${rankToName(highCard)}-high`);
  }

  // Three of a kind
  if (counts[0][1] === 3) {
    const tripRank = counts[0][0];
    const kickers = counts.filter(c => c[1] === 1).map(c => c[0]);
    return makeResult(3, 'Three of a Kind', [tripRank, ...kickers], sorted,
      `Three of a Kind, ${rankToName(tripRank)}s`);
  }

  // Two pair
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const highPair = Math.max(counts[0][0], counts[1][0]);
    const lowPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2][0];
    return makeResult(2, 'Two Pair', [highPair, lowPair, kicker], sorted,
      `Two Pair, ${rankToName(highPair)}s and ${rankToName(lowPair)}s`);
  }

  // One pair
  if (counts[0][1] === 2) {
    const pairRank = counts[0][0];
    const kickers = counts.filter(c => c[1] === 1).map(c => c[0]);
    return makeResult(1, 'One Pair', [pairRank, ...kickers], sorted,
      `Pair of ${rankToName(pairRank)}s`);
  }

  // High card
  return makeResult(0, 'High Card', values, sorted,
    `${RANK_NAMES[sorted[0].rank]}-high`);
}

function checkStraight(sortedValues: number[]): boolean {
  for (let i = 0; i < sortedValues.length - 1; i++) {
    if (sortedValues[i] - sortedValues[i + 1] !== 1) return false;
  }
  return true;
}

function checkWheel(sortedValues: number[]): boolean {
  // A-2-3-4-5 (Ace plays low)
  return sortedValues[0] === 14 &&
    sortedValues[1] === 5 &&
    sortedValues[2] === 4 &&
    sortedValues[3] === 3 &&
    sortedValues[4] === 2;
}

function makeResult(
  rank: number,
  name: HandRankName,
  tiebreakers: number[],
  cards: Card[],
  description: string,
): HandResult {
  // Encode value: rank in high bits, then exactly 5 tiebreaker slots (padded with 0).
  // This ensures hands with different numbers of tiebreakers compare correctly.
  const tb = [...tiebreakers];
  while (tb.length < 5) tb.push(0);
  let value = rank;
  for (let i = 0; i < 5; i++) {
    value = value * 15 + tb[i];
  }
  return { rank, name, value, cards, description };
}

function rankToName(value: number): string {
  const rank = Object.entries(
    { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }
  ).find(([, v]) => v === value);
  return rank ? RANK_NAMES[rank[0] as Rank] : String(value);
}

/**
 * Compare two hand results. Returns:
 *  > 0 if a wins
 *  < 0 if b wins
 *  0 if tie (split pot)
 */
export function compareHands(a: HandResult, b: HandResult): number {
  return a.value - b.value;
}

/** Generate all C(n,k) combinations */
function getCombinations<T>(arr: T[], k: number): T[][] {
  const results: T[][] = [];
  function combo(start: number, current: T[]) {
    if (current.length === k) {
      results.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combo(i + 1, current);
      current.pop();
    }
  }
  combo(0, []);
  return results;
}
