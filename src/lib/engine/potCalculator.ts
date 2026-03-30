import { Player, Pot } from '@/types';

/**
 * Calculate main pot and side pots based on player bets.
 *
 * Algorithm: Sort all-in players by their totalBet. For each level,
 * create a pot with contributions from all players who bet at least that level.
 */
export function calculatePots(players: Player[]): Pot[] {
  // Only consider players who have put money in
  const bettors = players.filter(p => p.totalBet > 0);
  if (bettors.length === 0) return [];

  // Get unique bet levels from all-in players and max bet
  const allInAmounts = bettors
    .filter(p => p.status === 'all-in')
    .map(p => p.totalBet);

  const betLevels = [...new Set(allInAmounts)].sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of betLevels) {
    const potAmount = bettors.reduce((sum, p) => {
      const contribution = Math.min(p.totalBet, level) - Math.min(p.totalBet, previousLevel);
      return sum + contribution;
    }, 0);

    if (potAmount > 0) {
      const eligible = bettors
        .filter(p => p.totalBet >= level && p.status !== 'folded')
        .map(p => p.id);

      pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    }
    previousLevel = level;
  }

  // Remaining pot above the highest all-in level
  const maxAllIn = betLevels.length > 0 ? betLevels[betLevels.length - 1] : 0;
  const remainingAmount = bettors.reduce((sum, p) => {
    return sum + Math.max(0, p.totalBet - maxAllIn);
  }, 0);

  if (remainingAmount > 0) {
    const eligible = bettors
      .filter(p => p.totalBet > maxAllIn && p.status !== 'folded')
      .map(p => p.id);

    pots.push({ amount: remainingAmount, eligiblePlayerIds: eligible });
  }

  // If no all-in players, just one main pot
  if (betLevels.length === 0) {
    const total = bettors.reduce((sum, p) => sum + p.totalBet, 0);
    const eligible = bettors
      .filter(p => p.status !== 'folded')
      .map(p => p.id);
    return [{ amount: total, eligiblePlayerIds: eligible }];
  }

  return pots;
}

/**
 * Simplified pot calculation: just sum all current bets into existing pots.
 * Used during a hand to show current pot total.
 */
export function getCurrentPotTotal(pots: Pot[], players: Player[]): number {
  const potTotal = pots.reduce((sum, p) => sum + p.amount, 0);
  const currentBets = players.reduce((sum, p) => sum + p.bet, 0);
  return potTotal + currentBets;
}
