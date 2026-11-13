// Achievements. `value(save)` returns current progress, `goal` the target. Rewards are paid once.
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Ride', desc: 'Clear any level', goal: 1, coins: 30, value: (s) => s.wins() },
  { id: 'ten', name: 'City Driver', desc: 'Clear 10 levels', goal: 10, coins: 60, value: (s) => s.cleared() },
  { id: 'fifty', name: 'Terminal Boss', desc: 'Clear 50 levels', goal: 50, coins: 200, value: (s) => s.cleared() },
  { id: 'stars', name: 'Star Collector', desc: 'Earn 30 stars', goal: 30, coins: 100, value: (s) => s.totalStars() },
  { id: 'perfect', name: 'Perfectionist', desc: 'Get 3 stars on 10 levels', goal: 10, coins: 150, value: (s) => s.perfect() },
  { id: 'rainbow', name: 'Rainbow Terminal', desc: 'Clear levels using all 10 colours', goal: 10, coins: 120, value: (s) => s.data.colors.length },
];
