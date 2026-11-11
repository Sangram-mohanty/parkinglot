import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { archiveExpiredTickets } from './retention.js';

await mongoose.connect(config.mongoUri);
const server = app.listen(config.port, () => {
  console.log(`Parking lot API listening on http://localhost:${config.port}`);
});

let archiveInProgress = false;
async function runRetentionJob() {
  if (archiveInProgress) return;
  archiveInProgress = true;
  try {
    const count = await archiveExpiredTickets();
    if (count) console.log(`Archived ${count} closed tickets past the 30-day operational retention period.`);
  } catch (error) {
    console.error('Ticket archive job failed:', error);
  } finally {
    archiveInProgress = false;
  }
}

const retentionTimer = setInterval(() => {
  void runRetentionJob();
}, 60 * 60 * 1000);
retentionTimer.unref();
void runRetentionJob();

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  clearInterval(retentionTimer);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
