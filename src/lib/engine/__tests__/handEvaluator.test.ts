import { evaluateHand, compareHands } from '../handEvaluator';
import { Card } from '../../../types';
import { parseCard } from '../deck';

function cards(s: string): Card[] {
  return s.split(' ').map(parseCard);
}

describe('Hand Evaluator', () => {
  describe('5-card evaluation', () => {
    test('Royal Flush', () => {
      const result = evaluateHand(cards('Ah Kh Qh Jh Th 2c 3d'));
      expect(result.name).toBe('Royal Flush');
      expect(result.rank).toBe(9);
    });

    test('Straight Flush', () => {
      const result = evaluateHand(cards('9h 8h 7h 6h 5h 2c 3d'));
      expect(result.name).toBe('Straight Flush');
      expect(result.rank).toBe(8);
    });

    test('Straight Flush — wheel (A-2-3-4-5)', () => {
      const result = evaluateHand(cards('Ah 2h 3h 4h 5h Kc Qd'));
      expect(result.name).toBe('Straight Flush');
      expect(result.rank).toBe(8);
    });

    test('Four of a Kind', () => {
      const result = evaluateHand(cards('Ah Ac Ad As Kh 2c 3d'));
      expect(result.name).toBe('Four of a Kind');
      expect(result.rank).toBe(7);
    });

    test('Full House', () => {
      const result = evaluateHand(cards('Ah Ac Ad Kh Kc 2c 3d'));
      expect(result.name).toBe('Full House');
      expect(result.rank).toBe(6);
    });

    test('Flush', () => {
      const result = evaluateHand(cards('Ah 9h 7h 4h 2h Kc 3d'));
      expect(result.name).toBe('Flush');
      expect(result.rank).toBe(5);
    });

    test('Straight', () => {
      const result = evaluateHand(cards('9h 8c 7d 6h 5s 2c 3d'));
      expect(result.name).toBe('Straight');
      expect(result.rank).toBe(4);
    });

    test('Straight — wheel (A-2-3-4-5)', () => {
      const result = evaluateHand(cards('Ah 2c 3d 4h 5s 9c Td'));
      expect(result.name).toBe('Straight');
      expect(result.rank).toBe(4);
    });

    test('Straight — broadway (T-J-Q-K-A)', () => {
      const result = evaluateHand(cards('Ah Kc Qd Jh Ts 2c 3d'));
      // Should be Straight, not Royal Flush (different suits)
      expect(result.name).toBe('Straight');
      expect(result.rank).toBe(4);
    });

    test('Three of a Kind', () => {
      const result = evaluateHand(cards('Ah Ac Ad 9h 7c 2c 3d'));
      expect(result.name).toBe('Three of a Kind');
      expect(result.rank).toBe(3);
    });

    test('Two Pair', () => {
      const result = evaluateHand(cards('Ah Ac Kh Kc 9h 2c 3d'));
      expect(result.name).toBe('Two Pair');
      expect(result.rank).toBe(2);
    });

    test('One Pair', () => {
      const result = evaluateHand(cards('Ah Ac 9h 7c 5h 2c 3d'));
      expect(result.name).toBe('One Pair');
      expect(result.rank).toBe(1);
    });

    test('High Card', () => {
      const result = evaluateHand(cards('Ah Kc 9h 7d 5s 2c 3d'));
      expect(result.name).toBe('High Card');
      expect(result.rank).toBe(0);
    });
  });

  describe('hand comparison', () => {
    test('Royal Flush beats Straight Flush', () => {
      const royal = evaluateHand(cards('Ah Kh Qh Jh Th 2c 3d'));
      const sf = evaluateHand(cards('9h 8h 7h 6h 5h 2c 3d'));
      expect(compareHands(royal, sf)).toBeGreaterThan(0);
    });

    test('Flush beats Straight', () => {
      const flush = evaluateHand(cards('Ah 9h 7h 4h 2h Kc 3d'));
      const straight = evaluateHand(cards('9h 8c 7d 6h 5s 2c 3d'));
      expect(compareHands(flush, straight)).toBeGreaterThan(0);
    });

    test('Higher pair beats lower pair', () => {
      const pairA = evaluateHand(cards('Ah Ac 9h 7c 5d 2c 3d'));
      const pairK = evaluateHand(cards('Kh Kc 9h 7d 5s 2c 3d'));
      expect(compareHands(pairA, pairK)).toBeGreaterThan(0);
    });

    test('Same pair, higher kicker wins', () => {
      const pairAK = evaluateHand(cards('Ah Ac Kh 7c 5d 2c 3d'));
      const pairAQ = evaluateHand(cards('Ad As Qh 7d 5s 2c 3d'));
      expect(compareHands(pairAK, pairAQ)).toBeGreaterThan(0);
    });

    test('Identical hands split (equal value)', () => {
      const hand1 = evaluateHand(cards('Ah Ac Kh Qc Jd 2c 3d'));
      const hand2 = evaluateHand(cards('Ad As Kd Qs Js 4c 5d'));
      expect(compareHands(hand1, hand2)).toBe(0);
    });

    test('Full House: higher trips wins', () => {
      const fhA = evaluateHand(cards('Ah Ac Ad Kh Kc 2c 3d'));
      const fhK = evaluateHand(cards('Kh Kc Kd Ah As 2c 3d'));
      expect(compareHands(fhA, fhK)).toBeGreaterThan(0);
    });

    test('Two pair: higher top pair wins', () => {
      const tpAK = evaluateHand(cards('Ah Ac Kh Kc 9d 2c 3d'));
      const tpAQ = evaluateHand(cards('Ad As Qh Qd 9s 2c 3d'));
      expect(compareHands(tpAK, tpAQ)).toBeGreaterThan(0);
    });

    test('Flush: higher cards win', () => {
      const fA = evaluateHand(cards('Ah Kh 9h 7h 4h 2c 3d'));
      const fK = evaluateHand(cards('Kh Qh 9h 7h 4h 2c 3d'));
      expect(compareHands(fA, fK)).toBeGreaterThan(0);
    });
  });

  describe('7-card best hand selection', () => {
    test('Selects best 5 from 7 cards', () => {
      // Board has flush draw, hole cards make it
      const result = evaluateHand(cards('Ah Kh 5h 3h 9c Jh 2d'));
      expect(result.name).toBe('Flush');
    });

    test('Full house from trips on board + pocket pair', () => {
      const result = evaluateHand(cards('9h 9c 9d Ah Ac Kc 2d'));
      expect(result.name).toBe('Full House');
    });

    test('Picks straight over lower two pair', () => {
      const result = evaluateHand(cards('9h 8c 7d 6h 5s 9c 8d'));
      expect(result.name).toBe('Straight');
    });
  });
});
