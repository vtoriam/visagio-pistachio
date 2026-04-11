/**
 * Scrapes the WA Health ED Activity Now page.
 * URL: https://www.health.wa.gov.au/reports-and-publications/emergency-department-activity/data?report=ed_activity_now
 *
 * The page embeds a JSON payload in a <script id="__NEXT_DATA__"> tag (Next.js SSR).
 * We parse that rather than scraping HTML tables, which is more stable.
 *
 * Fallback: if the JSON structure changes, we scrape the visible table.
 */

import * as cheerio from 'cheerio';

const ED_URL =
  'https://www.health.wa.gov.au/reports-and-publications/emergency-department-activity/data?report=ed_activity_now';

export interface EDHospitalData {
  hospitalName: string;
  /** Median wait in minutes to be seen by a doctor */
  waitMinutes: number;
  patientsWaiting: number;
  patientsInDept: number;
  lastUpdated: string;
}

export async function scrapeEDWaitTimes(): Promise<EDHospitalData[]> {
  const res = await fetch(ED_URL, {
    headers: {
      'User-Agent': 'UrgentNow/1.0 (health information aggregator; contact@urgentnow.com.au)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    throw new Error(`WA Health fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Strategy 1: parse embedded Next.js JSON
  const nextDataEl = $('#__NEXT_DATA__');
  if (nextDataEl.length) {
    try {
      const json = JSON.parse(nextDataEl.text());
      const rows = json?.props?.pageProps?.edData ?? json?.props?.pageProps?.data;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(normaliseRow);
      }
    } catch {
      // fall through to HTML scraping
    }
  }

  // Strategy 2: scrape visible table
  const results: EDHospitalData[] = [];
  $('table tbody tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;
    const name = $(cells[0]).text().trim();
    const waiting = parseInt($(cells[1]).text().trim(), 10);
    const inDept = parseInt($(cells[2]).text().trim(), 10);
    const waitText = $(cells[3]).text().trim(); // e.g. "1h 20m" or "80"

    if (!name) return;
    results.push({
      hospitalName: name,
      waitMinutes: parseWaitText(waitText),
      patientsWaiting: isNaN(waiting) ? 0 : waiting,
      patientsInDept: isNaN(inDept) ? 0 : inDept,
      lastUpdated: new Date().toISOString(),
    });
  });

  return results;
}

// Normalise a row from the Next.js JSON payload (field names vary by WA Health version)
function normaliseRow(row: Record<string, unknown>): EDHospitalData {
  return {
    hospitalName:
      String(row.hospitalName ?? row.hospital ?? row.name ?? ''),
    waitMinutes:
      Number(row.waitMinutes ?? row.medianWait ?? row.wait ?? 0),
    patientsWaiting:
      Number(row.patientsWaiting ?? row.waiting ?? 0),
    patientsInDept:
      Number(row.patientsInDept ?? row.inDepartment ?? row.total ?? 0),
    lastUpdated:
      String(row.lastUpdated ?? row.updatedAt ?? new Date().toISOString()),
  };
}

function parseWaitText(text: string): number {
  // handles "1h 20m", "80 min", "80", "1:20"
  const hourMin = text.match(/(\d+)\s*h\s*(\d+)\s*m/i);
  if (hourMin) return parseInt(hourMin[1], 10) * 60 + parseInt(hourMin[2], 10);
  const hourOnly = text.match(/^(\d+)\s*h$/i);
  if (hourOnly) return parseInt(hourOnly[1], 10) * 60;
  const mins = text.match(/(\d+)/);
  return mins ? parseInt(mins[1], 10) : 0;
}
