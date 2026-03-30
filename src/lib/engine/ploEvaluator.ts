import { Card, HandResult } from '@/types';
import { evaluateHand } from './handEvaluator';

/**
 * PLO hand evaluation: must use exactly 2 hole cards + exactly 3 community cards.
 * We try all C(4,2) * C(5,3) = 6 * 10 = 60 combinations and return the best.
 */
export function evaluatePloHand(holeCards: Card[], communityCards: Card[]): HandResult {
  if (holeCards.length < 4 || communityCards.length < 3) {
    throw new Error(`PLO needs at least 4 hole cards and 3 community cards, got ${holeCards.length} and ${communityCards.length}`);
  }

  const holeCombos = combinations(holeCards, 2);
  const boardCombos = combinations(communityCards, 3);

  let best: HandResult | null = null;

  for (const hole2 of holeCombos) {
    for (const board3 of boardCombos) {
      const fiveCards = [...hole2, ...board3];
      const result = evaluateHand(fiveCards);
      if (!best || result.value > best.value) {
        best = result;
      }
    }
  }

  return best!;
}

function combinations<T>(arr: T[], k: number): T[][] {
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
