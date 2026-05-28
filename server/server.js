import { createApp, ensureAdminUser } from './src/app.js';
import { initDb } from './src/db.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './src/config.js';

const PORT = Number(process.env.PORT || 3001);

async function main() {
  await initDb();
  await ensureAdminUser();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

