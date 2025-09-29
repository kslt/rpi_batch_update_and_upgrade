// server.js
require("dotenv").config();
const express = require("express");
const { NodeSSH } = require("node-ssh");

const app = express();
const ssh = new NodeSSH();

// Bygg host-listan från .env
const hosts = process.env.HOSTS.split(",").map(name => ({
  host: name.trim(),
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
}));

// GET / → enkel startsida
app.get("/", (req, res) => {
  res.send(`
    <h1>Raspberry Pi Updater</h1>
    <p>Skicka en <strong>POST</strong> till <code>/upgrade</code> för att uppgradera alla Pis.</p>
    <form action="/upgrade" method="post">
      <button type="submit">Uppgradera alla Pis 🚀</button>
    </form>
  `);
});

// Funktion som uppgraderar en Pi
async function upgradePi(config) {
  const session = new NodeSSH();
  try {
    await session.connect(config);
    console.log(`✅ Ansluten till ${config.host}`);

    const result = await session.execCommand("sudo apt update && sudo apt -y full-upgrade");
    console.log(`📦 Uppdatering ${config.host}:`, result.stdout);
    if (result.stderr) console.error(`⚠️ Fel ${config.host}:`, result.stderr);

    await session.execCommand("sudo reboot");
    console.log(`🔄 Reboot skickad till ${config.host}`);
  } catch (err) {
    console.error(`❌ Misslyckades på ${config.host}:`, err);
  } finally {
    session.dispose();
  }
}

// POST /upgrade → triggar uppgradering
app.post("/upgrade", async (req, res) => {
  res.send("<p>🚀 Uppgradering startad, kolla loggar i konsolen...</p>");
  for (const host of hosts) {
    upgradePi(host);
  }
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node.js Raspberry Pi Updater kör på http://localhost:${PORT}`);
});
