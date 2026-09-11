import { useQuery } from '@tanstack/react-query';
import { nearbySummarySchema, type NearbySummary } from '@earth-pulse/shared';

export interface NearbyLocation { latitude: number; longitude: number; label?: string }

export function useNearby(location: NearbyLocation | undefined, radiusKm: number) {
  return useQuery({
    queryKey: ['nearby', location ? Math.round(location.latitude * 100) / 100 : null, location ? Math.round(location.longitude * 100) / 100 : null, radiusKm],
    enabled: Boolean(location),
    queryFn: async (): Promise<NearbySummary> => {
      const response = await fetch(`/api/nearby?lat=${location!.latitude}&lon=${location!.longitude}&radiusKm=${radiusKm}`);
      const body: unknown = await response.json();
      if (!response.ok) throw new Error('Nearby activity is temporarily unavailable.');
      return nearbySummarySchema.parse(body);
    },
    staleTime: 60_000,
  });
}
