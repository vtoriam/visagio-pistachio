import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { facilitiesRouter } from './routes/facilities';
import { edWaitRouter } from './routes/edWait';
import { driveTimeRouter } from './routes/driveTime';
import { alertsRouter } from './routes/alerts';
import { startAlertJob } from './jobs/alertJob';
import { startEDCacheJob } from './jobs/edCacheJob';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());

// Routes
app.use('/api/facilities', facilitiesRouter);
app.use('/api/ed-wait-times', edWaitRouter);
app.use('/api/drive-time', driveTimeRouter);
app.use('/api/alerts', alertsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`UrgentNow backend running on :${PORT}`);
  // Start background jobs
  startEDCacheJob();   // poll WA Health feed every 2 min
  startAlertJob();     // check thresholds every 2 min
});
