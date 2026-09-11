import { config } from '../config.js';
import { createDatabase } from './database.js';
import { up as initialMigration } from './migrations/001_initial.js';

const db = createDatabase(config.databaseUrl, config.databaseSsl);
try {
  await initialMigration(db);
  process.stdout.write('Earth Pulse database migration completed.\n');
} finally {
  await db.destroy();
}

