const path = require("path");
const express = require("express");

require("dotenv").config();

const app = express();
const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 10;

const PUBLIC_DIR = path.join(__dirname, ".");

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

app.get("*", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    console.log(`MediFind running at http://localhost:${port}`);
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
