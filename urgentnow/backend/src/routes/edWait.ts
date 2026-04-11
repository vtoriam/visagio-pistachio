import { Router } from 'express';
import { getCachedEDData } from '../services/cache';
import { scrapeEDWaitTimes } from '../services/edScraper';
import { setCachedEDData } from '../services/cache';

export const edWaitRouter = Router();

edWaitRouter.get('/', async (_req, res) => {
  let data = await getCachedEDData();

  if (!data) {
    try {
      data = await scrapeEDWaitTimes();
      await setCachedEDData(data);
    } catch (err) {
      console.error('ED scrape failed:', err);
      return res.status(503).json({ error: 'ED data temporarily unavailable' });
    }
  }

  res.json(data);
});
