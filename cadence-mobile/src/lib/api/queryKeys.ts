export const queryKeys = {
  me: ['me'] as const,
  habits: ['habits'] as const,
  checkIn: (date: string) => ['check-in', date] as const,
  insightToday: ['insight-today'] as const,
  insights: ['insights'] as const,
  circles: ['circles'] as const,
  circle: (id: string) => ['circle', id] as const,
  circlePacts: (id: string) => ['circle-pacts', id] as const,
  circleFeed: (id: string) => ['circle-feed', id] as const,
  reflectRhythm: (windowDays: number) => ['reflect-rhythm', windowDays] as const,
};
