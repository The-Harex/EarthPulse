import type { GeocodeResult, ProviderStatuses } from '@earth-pulse/shared';
import { RefreshCw, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { relativeTime } from '@/lib/format';
import { SearchControl } from './SearchControl';

interface Props { fetchedAt: string | undefined; live: boolean; providers?: ProviderStatuses | undefined; refreshing: boolean; onRefresh: () => void; onPlaceSelect: (result: GeocodeResult) => void }

export function Header({ fetchedAt, live, providers, refreshing, onRefresh, onPlaceSelect }: Props) {
  const total = providers ? Object.values(providers).length : 0;
  const online = providers ? Object.values(providers).filter((provider) => provider.configured && provider.healthy).length : 0;
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Satellite /></span><div><strong>EARTH PULSE</strong><span>PLANETARY MONITORING</span></div></div>
      <SearchControl onSelect={onPlaceSelect} />
      <div className="status-tools">
        <div className={`live-status ${live ? '' : 'degraded'}`}><span className="live-dot" /> {live ? 'LIVE' : fetchedAt ? 'STALE' : 'CONNECTING'}</div>
        {total > 0 && <div className="updated-status" title={online === total ? 'All event feeds are online.' : 'One or more event feeds are unavailable.'}><span>SOURCES</span><strong>{online}/{total} online</strong></div>}
        <div className="updated-status"><span>UPDATED</span><strong>{fetchedAt ? relativeTime(fetchedAt) : '—'}</strong></div>
        <Tooltip><TooltipTrigger render={<Button variant="outline" size="icon-lg" aria-label="Refresh natural event data" onClick={onRefresh} disabled={refreshing} />}><RefreshCw className={refreshing ? 'spin' : ''} /></TooltipTrigger><TooltipContent>Refresh natural event data</TooltipContent></Tooltip>
      </div>
    </header>
  );
}
