import { buildPersistedApp } from './persistedApp.js';
import { config } from './config.js';
import { createDatabase } from './db/database.js';
import { up as initialMigration } from './db/migrations/001_initial.js';
import { startProductionIngestion } from './ingestion/productionIngestion.js';

try {
  const migrationDatabase = createDatabase(config.databaseUrl, config.databaseSsl);
  try {
    await initialMigration(migrationDatabase);
  } finally {
    await migrationDatabase.destroy();
  }
  const app = buildPersistedApp();
  const stopIngestion = startProductionIngestion();
  app.addHook('onClose', stopIngestion);
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  console.error(error);
  process.exit(1);
}
