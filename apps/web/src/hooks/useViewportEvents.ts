import { useQuery } from '@tanstack/react-query';
import { eventsResponseSchema, type EventsResponse } from '@earth-pulse/shared';

export type ViewportBounds = [number, number, number, number];

export function useViewportEvents(bounds: ViewportBounds | undefined) {
  const key = bounds?.map((value) => Math.round(value * 10) / 10);
  return useQuery({
    queryKey: ['events', 'viewport', key], enabled: Boolean(bounds), staleTime: 30_000,
    queryFn: async (): Promise<EventsResponse> => {
      const response = await fetch(`/api/events?bbox=${bounds!.join(',')}&view=map&limit=2000`);
      const body: unknown = await response.json();
      if (!response.ok) throw new Error('Map activity is temporarily unavailable.');
      return eventsResponseSchema.parse(body);
    },
  });
}
