import { observationsResponseSchema, type ObservationsResponse } from '@earth-pulse/shared';
import { useEffect, useState } from 'react';
export function useObservations() { const [data, setData] = useState<ObservationsResponse>(); useEffect(() => { const controller = new AbortController(); void fetch('/api/observations?type=wildfire-detection&zoom=1', { signal: controller.signal }).then(async (response) => { if (!response.ok) return; setData(observationsResponseSchema.parse(await response.json())); }).catch(() => undefined); return () => controller.abort(); }, []); return data; }
