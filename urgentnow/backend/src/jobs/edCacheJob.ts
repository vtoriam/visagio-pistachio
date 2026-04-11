import cron from 'node-cron';
import { scrapeEDWaitTimes } from '../services/edScraper';
import { setCachedEDData } from '../services/cache';

export function startEDCacheJob() {
  const run = async () => {
    try {
      const data = await scrapeEDWaitTimes();
      await setCachedEDData(data);
      console.log(`[ED Job] Updated ${data.length} hospitals at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[ED Job] Scrape failed:', err);
    }
  };

  // Run immediately on startup, then every 2 minutes
  run();
  cron.schedule('*/2 * * * *', run);
  console.log('[ED Job] Started — polling every 2 min');
}
