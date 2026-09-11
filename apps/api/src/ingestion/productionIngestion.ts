import { config } from '../config.js';
import { createDatabase } from '../db/database.js';
import { EonetProvider } from '../providers/eonet.js';
import { FirmsProvider } from '../providers/firms.js';
import { NwsProvider } from '../providers/nws.js';
import { SwpcProvider } from '../providers/swpc.js';
import { UsgsProvider } from '../providers/usgs.js';
import { IngestionCoordinator } from './ingestionCoordinator.js';

export function startProductionIngestion() {
  if (!config.inProcessIngestion) return async () => undefined;

  const db = createDatabase(config.databaseUrl, config.databaseSsl);
  const coordinator = new IngestionCoordinator(db, {
    usgs: new UsgsProvider(config.usgsFeedUrl, config.providerUserAgent),
    eonet: new EonetProvider(config.eonetUrl, config.providerUserAgent),
    nws: new NwsProvider(config.nwsAlertsUrl, config.providerUserAgent),
    firms: new FirmsProvider(config.firmsBaseUrl, config.firmsMapKey, config.firmsSource, config.firmsDayRange),
    swpc: new SwpcProvider(config.swpcKpUrl, config.swpcAlertsUrl, config.swpcSolarWindUrl, config.providerUserAgent),
  }, config.firmsSource);

  const run = () => void coordinator.runDue().catch((error) => console.error('Earth Pulse ingestion failed.', error));
  run();
  const timer = setInterval(run, config.ingestionLoopMs);
  timer.unref();
  return async () => { clearInterval(timer); await db.destroy(); };
}
