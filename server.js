const path = require("path");
const express = require("express");
const cheerio = require("cheerio");

require("dotenv").config();

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 10;
const WA_ED_URL =
  process.env.WA_ED_URL ||
  "https://www.health.wa.gov.au/reports-and-publications/emergency-department-activity/data?report=ed_activity_now";
const WA_ED_CACHE_SECONDS = Number(process.env.WA_ED_CACHE_SECONDS) || 120;

const PUBLIC_DIR = path.join(__dirname, ".");
const waEdCache = {
  data: null,
  fetchedAtMs: 0,
};

app.use(express.static(PUBLIC_DIR));

app.get("/config.js", (_req, res) => {
  const config = {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    landbotConfigUrl:
      process.env.LANDBOT_CONFIG_URL ||
      "https://storage.googleapis.com/landbot.online/v3/H-3391916-JDQ4GD09C7LAMNIV/index.json",
  };

  res.type("application/javascript");
  res.send(`window.APP_CONFIG = ${JSON.stringify(config)};`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSnapshotText($) {
  const pageText = normalizeText($("body").text());
  const match = pageText.match(
    /Preview of Emergency Department \(ED\) figures at\s*(.+?)\s*(?:Armadale Hospital|Please note)/i,
  );
  return match ? normalizeText(match[1]) : null;
}

function parseHospitalRows($) {
  const hospitals = [];

  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("th, td")
      .map((__, cell) => normalizeText($(cell).text()))
      .get()
      .filter(Boolean);

    if (cells.length < 4) return;

    const hospital = cells[0];
    if (!/[a-z]/i.test(hospital)) return;

    const numericValues = cells
      .slice(1)
      .map((value) => Number.parseInt(value.replace(/[^0-9-]/g, ""), 10))
      .filter((value) => Number.isFinite(value));

    if (numericValues.length === 0) return;

    const waitMins = numericValues[0];
    hospitals.push({
      hospital,
      waitMins,
      raw: cells,
    });
  });

  return hospitals;
}

async function fetchWaEdLiveData() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(WA_ED_URL, {
      signal: controller.signal,
      headers: {
        "user-agent": "MediWatch/1.0 (+https://localhost)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`WA Health request failed (${response.status})`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const hospitals = parseHospitalRows($);

    if (hospitals.length === 0) {
      throw new Error("No ED rows found in WA Health response");
    }

    const payload = {
      source: "WA Department of Health",
      sourceUrl: WA_ED_URL,
      snapshot: extractSnapshotText($),
      fetchedAt: new Date().toISOString(),
      count: hospitals.length,
      hospitals,
    };

    waEdCache.data = payload;
    waEdCache.fetchedAtMs = Date.now();

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/api/wa-ed-live", async (_req, res) => {
  const ageSeconds = (Date.now() - waEdCache.fetchedAtMs) / 1000;
  const isCacheFresh = waEdCache.data && ageSeconds < WA_ED_CACHE_SECONDS;

  if (isCacheFresh) {
    res.json({
      ...waEdCache.data,
      cache: "hit",
      cacheAgeSeconds: Math.floor(ageSeconds),
    });
    return;
  }

  try {
    const data = await fetchWaEdLiveData();
    res.json({
      ...data,
      cache: "miss",
      cacheAgeSeconds: 0,
    });
  } catch (error) {
    if (waEdCache.data) {
      res.status(200).json({
        ...waEdCache.data,
        cache: "stale",
        warning: `Live fetch failed: ${error.message}`,
        cacheAgeSeconds: Math.floor(
          (Date.now() - waEdCache.fetchedAtMs) / 1000,
        ),
      });
      return;
    }

    res.status(502).json({
      error: "Unable to fetch WA ED live data",
      detail: error.message,
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    console.log(`MediWatch running at http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attempt < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use, retrying on port ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
}

startServer(DEFAULT_PORT);
