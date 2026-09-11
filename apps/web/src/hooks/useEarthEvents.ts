import { eventsResponseSchema, type EventsResponse } from '@earth-pulse/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useEarthEvents() {
  const [data, setData] = useState<EventsResponse>();
  const [error, setError] = useState<string>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  const load = useCallback(async (force = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ view: 'map', limit: '2000' });
      if (force) params.set('refresh', 'true');
      const response = await fetch(`/api/events?${params.toString()}`, { signal: controller.signal });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error('Live earthquake data is temporarily unavailable.');
      setData(eventsResponseSchema.parse(body));
      setError(undefined);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Live earthquake data is temporarily unavailable.');
    } finally {
      if (!controller.signal.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 120_000);
    return () => { window.clearInterval(interval); controllerRef.current?.abort(); };
  }, [load]);

  return { data, error, isLoading: !data && isRefreshing, isRefreshing, refresh: () => load(true) };
}
