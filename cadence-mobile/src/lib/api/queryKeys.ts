export const queryKeys = {
  me: ['me'] as const,
  habits: ['habits'] as const,
  checkIn: (date: string) => ['check-in', date] as const,
  insightToday: ['insight-today'] as const,
  insights: ['insights'] as const,
};
