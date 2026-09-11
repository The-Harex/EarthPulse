import { useQuery } from '@tanstack/react-query';
import { spaceWeatherSummarySchema, type SpaceWeatherSummary } from '@earth-pulse/shared';

export function useSpaceWeather() {
  return useQuery({
    queryKey: ['space-weather'],
    queryFn: async (): Promise<SpaceWeatherSummary> => {
      const response = await fetch('/api/space-weather');
      const body: unknown = await response.json();
      if (!response.ok) throw new Error('Space weather is temporarily unavailable.');
      return spaceWeatherSummarySchema.parse(body);
    },
    staleTime: 5 * 60_000,
  });
}
