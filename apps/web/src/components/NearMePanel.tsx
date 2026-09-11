import type { NearbySummary } from '@earth-pulse/shared';
import { LocateFixed, MapPin, Navigation, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button';

const radiusOptions = [{ label: '25 mi', km: 40.234 }, { label: '50 mi', km: 80.467 }, { label: '100 mi', km: 160.934 }, { label: '250 mi', km: 402.336 }, { label: '500 mi', km: 804.672 }];

interface Props {
  summary?: NearbySummary | undefined;
  loading?: boolean | undefined;
  error?: string | undefined;
  activeRadiusKm: number;
  onRadiusChange: (value: number) => void;
  onUseMyLocation: () => void;
  locating: boolean;
}

export function NearMePanel({ summary, loading, error, activeRadiusKm, onRadiusChange, onUseMyLocation, locating }: Props) {
  const air = summary?.environment?.airQuality;
  return <section className="nearby-module" aria-label="Near Me environmental activity">
    <div className="module-heading"><div><p className="eyebrow">NEAR ME</p><h3>{summary?.location.label ?? 'Local activity'}</h3></div><MapPin /></div>
    {!summary && <div className="nearby-empty"><p>Choose a place or use your device location to see nearby environmental activity.</p><Button onClick={onUseMyLocation} disabled={locating}><LocateFixed /> {locating ? 'Locating…' : 'Use My Location'}</Button>{error && <small className="nearby-error">{error}</small>}</div>}
    {summary && <><div className={`local-pulse ${summary.pulse.band}`}><Navigation /><div><span>LOCAL PULSE</span><strong>{summary.pulse.score} · {summary.pulse.band}</strong><small>{summary.pulse.disclaimer}</small></div></div>
      <div className="radius-picker" aria-label="Near Me radius">{radiusOptions.map((item) => <button key={item.km} className={Math.abs(item.km - activeRadiusKm) < 0.1 ? 'active' : ''} type="button" onClick={() => onRadiusChange(item.km)}>{item.label}</button>)}</div>
      {loading && <p className="nearby-loading">Updating local conditions…</p>}
      <div className="nearby-stats"><div><Wind /><span>AIR QUALITY</span><strong>{air?.aqi ?? '—'} {air?.category ?? ''}</strong><small>{air?.pm25 != null ? `PM2.5 ${air.pm25} µg/m³` : 'Provider estimate'}</small></div><div><span>WEATHER ALERTS</span><strong>{summary.counts.weatherAlerts}</strong><small>within selected radius</small></div><div><span>EARTHQUAKES</span><strong>{summary.counts.earthquakes}</strong><small>within selected radius</small></div><div><span>FIRE DETECTIONS</span><strong>{summary.counts.fireDetections}</strong><small>within selected radius</small></div></div>
      {summary.environment?.attribution && <p className="attribution">{summary.environment.attribution}</p>}
    </>}
  </section>;
}
