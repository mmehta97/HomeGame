import { calculatePots } from '../potCalculator';
import { Player } from '../../../types';

function makePlayer(id: string, totalBet: number, status: 'active' | 'all-in' | 'folded', chips = 100): Player {
  return {
    id, name: id, seatIndex: 0, chips, bet: 0, totalBet,
    holeCards: [], status, isConnected: true,
  };
}

describe('Pot Calculator', () => {
  test('Simple main pot — all players same bet', () => {
    const players = [
      makePlayer('A', 100, 'active'),
      makePlayer('B', 100, 'active'),
      makePlayer('C', 100, 'active'),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds).toEqual(['A', 'B', 'C']);
  });

  test('One player folded — not eligible for pot', () => {
    const players = [
      makePlayer('A', 100, 'active'),
      makePlayer('B', 100, 'active'),
      makePlayer('C', 50, 'folded'),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(250);
    expect(pots[0].eligiblePlayerIds).toEqual(['A', 'B']);
  });

  test('Side pot — one player all-in for less', () => {
    const players = [
      makePlayer('A', 50, 'all-in', 0),   // All-in for 50
      makePlayer('B', 100, 'active', 100), // Bet 100
      makePlayer('C', 100, 'active', 100), // Bet 100
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(2);

    // Main pot: 50 * 3 = 150 (all eligible)
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligiblePlayerIds).toContain('A');
    expect(pots[0].eligiblePlayerIds).toContain('B');
    expect(pots[0].eligiblePlayerIds).toContain('C');

    // Side pot: 50 * 2 = 100 (only B and C)
    expect(pots[1].amount).toBe(100);
    expect(pots[1].eligiblePlayerIds).not.toContain('A');
    expect(pots[1].eligiblePlayerIds).toContain('B');
    expect(pots[1].eligiblePlayerIds).toContain('C');
  });

  test('Multiple side pots — three different all-in amounts', () => {
    const players = [
      makePlayer('A', 30, 'all-in', 0),
      makePlayer('B', 60, 'all-in', 0),
      makePlayer('C', 100, 'active', 100),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(3);

    // Main pot: 30 * 3 = 90
    expect(pots[0].amount).toBe(90);
    expect(pots[0].eligiblePlayerIds).toHaveLength(3);

    // Side pot 1: 30 * 2 = 60 (B and C)
    expect(pots[1].amount).toBe(60);
    expect(pots[1].eligiblePlayerIds).toContain('B');
    expect(pots[1].eligiblePlayerIds).toContain('C');
    expect(pots[1].eligiblePlayerIds).not.toContain('A');

    // Side pot 2: 40 * 1 = 40 (only C)
    expect(pots[2].amount).toBe(40);
    expect(pots[2].eligiblePlayerIds).toEqual(['C']);
  });

  test('All-in player with fold — folded not eligible', () => {
    const players = [
      makePlayer('A', 50, 'all-in', 0),
      makePlayer('B', 100, 'active', 100),
      makePlayer('C', 80, 'folded'),
    ];
    const pots = calculatePots(players);

    // Main pot: 50+50+50 (C contributed 50 toward A's level) but C folded
    // Actually: A's level = 50. Each contributes min(totalBet, 50)
    // Pot 1: 50 + 50 + 50 = 150, eligible: A, B (C folded)
    expect(pots[0].amount).toBe(150);
    expect(pots[0].eligiblePlayerIds).toContain('A');
    expect(pots[0].eligiblePlayerIds).toContain('B');
    expect(pots[0].eligiblePlayerIds).not.toContain('C');

    // Side pot: B's remaining 50 + C's remaining 30 = 80, eligible: B only (C folded)
    expect(pots[1].amount).toBe(80);
    expect(pots[1].eligiblePlayerIds).toEqual(['B']);
  });

  test('No bets — empty pots', () => {
    const players = [
      makePlayer('A', 0, 'active'),
      makePlayer('B', 0, 'active'),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(0);
  });

  test('Heads up — simple pot', () => {
    const players = [
      makePlayer('A', 200, 'all-in', 0),
      makePlayer('B', 200, 'active', 300),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(400);
  });

  test('All players all-in at different levels', () => {
    const players = [
      makePlayer('A', 10, 'all-in', 0),
      makePlayer('B', 20, 'all-in', 0),
      makePlayer('C', 30, 'all-in', 0),
      makePlayer('D', 40, 'all-in', 0),
    ];
    const pots = calculatePots(players);
    expect(pots).toHaveLength(4);

    expect(pots[0].amount).toBe(40);  // 10 * 4
    expect(pots[1].amount).toBe(30);  // 10 * 3
    expect(pots[2].amount).toBe(20);  // 10 * 2
    expect(pots[3].amount).toBe(10);  // 10 * 1
  });
});
