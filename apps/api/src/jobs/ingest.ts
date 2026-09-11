import { config } from '../config.js';
import { createDatabase } from '../db/database.js';
import { IngestionCoordinator } from '../ingestion/ingestionCoordinator.js';
import { EonetProvider } from '../providers/eonet.js';
import { FirmsProvider } from '../providers/firms.js';
import { NwsProvider } from '../providers/nws.js';
import { SwpcProvider } from '../providers/swpc.js';
import { UsgsProvider } from '../providers/usgs.js';

const db = createDatabase(config.databaseUrl, config.databaseSsl);
const coordinator = new IngestionCoordinator(db, { usgs: new UsgsProvider(config.usgsFeedUrl, config.providerUserAgent), eonet: new EonetProvider(config.eonetUrl, config.providerUserAgent), nws: new NwsProvider(config.nwsAlertsUrl, config.providerUserAgent), firms: new FirmsProvider(config.firmsBaseUrl, config.firmsMapKey, config.firmsSource, config.firmsDayRange), swpc: new SwpcProvider(config.swpcKpUrl, config.swpcAlertsUrl, config.swpcSolarWindUrl, config.providerUserAgent) }, config.firmsSource);
const loop = process.argv.includes('--loop');
try { do { await coordinator.runDue(); if (loop) await new Promise((resolve) => setTimeout(resolve, config.ingestionLoopMs)); } while (loop); }
finally { await db.destroy(); }

