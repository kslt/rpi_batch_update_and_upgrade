require("dotenv").config();
const express = require("express");
const { NodeSSH } = require("node-ssh");

const app = express();

// Bygg host-listan från .env, trimma mellanslag
const hosts = process.env.HOSTS.split(",").map(host => ({
  host: host.trim(),
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
  tryKeyboard: false,  // Avstänger keyboard-interactive
  agent: false,        // Avstänger SSH-agent / nycklar
  readyTimeout: 30000  // Längre timeout för nätverk
}));

// Lista för SSE-klienter
let clients = [];

// GET / → startsida med live-status
app.get("/", (req, res) => {
  res.send(`
    <h1>Raspberry Pi Updater</h1>
    <p>Klicka på knappen för att uppgradera alla Pis.</p>
    <form id="upgradeForm">
      <button type="submit">Uppgradera alla Pis 🚀</button>
    </form>
    <h2>Status:</h2>
    <div id="status"></div>

    <script>
      const statusEl = document.getElementById("status");
      const evtSource = new EventSource("/events");

      evtSource.onmessage = function(event) {
        const message = event.data;
        let color = "black";

        if (message.includes("✅") || message.includes("klar") || message.includes("Reboot skickad")) {
          color = "green";
        } else if (message.includes("⚠️")) {
          color = "orange";
        } else if (message.includes("❌") || message.includes("Misslyckades")) {
          color = "red";
        }

        const p = document.createElement("p");
        p.style.color = color;
        p.textContent = message;
        statusEl.appendChild(p);
        statusEl.scrollTop = statusEl.scrollHeight; // scrolla automatiskt
      };

      document.getElementById("upgradeForm").addEventListener("submit", async e => {
        e.preventDefault();
        await fetch("/upgrade", { method: "POST" });
      });
    </script>
    <style>
      #status {
        border: 1px solid #ccc;
        padding: 10px;
        height: 400px;
        overflow-y: auto;
        background: #f9f9f9;
        font-family: monospace;
      }
      button {
        padding: 10px 20px;
        font-size: 16px;
        margin-bottom: 10px;
      }
    </style>
  `);
});

// SSE endpoint
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

// Skicka meddelande till alla klienter
function sendToClients(message) {
  clients.forEach(client => client.write(`data: ${message}\n\n`));
}

// Funktion som uppgraderar en Pi med debug
async function upgradePi(config) {
  const ssh = new NodeSSH();
  try {
    sendToClients(`🔗 Ansluter till ${config.host}...`);
    await ssh.connect({
      ...config,
      debug: (msg) => sendToClients(`[DEBUG][${config.host}] ${msg}`)
    });
    sendToClients(`✅ Ansluten till ${config.host}`);

    const result = await ssh.execCommand("sudo apt update && sudo apt -y full-upgrade");
    sendToClients(`📦 Uppdatering ${config.host} klar`);
    if (result.stderr) sendToClients(`⚠️ Fel på ${config.host}: ${result.stderr}`);

    await ssh.execCommand("sudo reboot");
    sendToClients(`🔄 Reboot skickad till ${config.host}`);
  } catch (err) {
    sendToClients(`❌ Misslyckades på ${config.host}: ${err.message}`);
  } finally {
    ssh.dispose();
  }
}

// POST /upgrade → triggar uppgradering sekventiellt
app.post("/upgrade", async (req, res) => {
  res.send("<p>🚀 Uppgradering startad, kolla status nedan!</p>");

  for (const host of hosts) {
    await upgradePi(host);
  }

  sendToClients("✅ Alla uppgraderingar klara!");
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node.js Raspberry Pi Updater kör på http://localhost:${PORT}`);
});
