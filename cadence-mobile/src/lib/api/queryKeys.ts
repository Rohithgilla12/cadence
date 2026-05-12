export const queryKeys = {
  me: ['me'] as const,
  habits: ['habits'] as const,
  checkIn: (date: string) => ['check-in', date] as const,
};
