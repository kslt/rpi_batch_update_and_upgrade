require("dotenv").config();
const express = require("express");
const { NodeSSH } = require("node-ssh");
const fs = require("fs");
const path = require("path");

const app = express();

// Lista över Pis från .env
const hosts = process.env.HOSTS.split(",").map(host => ({
  host: host.trim(),
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
  tryKeyboard: false,
  agent: false,
  readyTimeout: 20000
}));

let clients = [];

// Startsida
app.get("/", (req, res) => {
  res.send(`
    <h1>Raspberry Pi Updater</h1>
    <button id="upgradeBtn">Uppgradera alla Pis 🚀</button>
    <div id="status" style="border:1px solid #ccc;padding:10px;height:400px;overflow-y:auto;font-family:monospace;"></div>
    <script>
      const statusEl = document.getElementById("status");
      const evtSource = new EventSource("/events");
      evtSource.onmessage = (e) => {
        const p = document.createElement("p");
        p.textContent = e.data;
        statusEl.appendChild(p);
        statusEl.scrollTop = statusEl.scrollHeight;
      };
      document.getElementById("upgradeBtn").addEventListener("click", async () => {
        await fetch("/upgrade", { method: "POST" });
      });
    </script>
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
function sendToClients(msg) {
  clients.forEach(c => c.write(`data: ${msg}\n\n`));
}

// Uppdatera en Pi
async function upgradePi(config) {
  const ssh = new NodeSSH();
  try {
    sendToClients(`🔗 Ansluter till ${config.host}...`);
    await ssh.connect(config);
    sendToClients(`✅ Ansluten till ${config.host}`);

    const localScript = path.join(__dirname, "update.sh");
    if (fs.existsSync(localScript)) {
      const remotePath = "/tmp/update.sh";
      sendToClients(`⬆️  Uppladdar script till ${config.host}`);
      await ssh.putFile(localScript, remotePath);
      sendToClients(`⚙️  Kör scriptet på ${config.host}...`);
      await ssh.execCommand(`chmod +x ${remotePath} && printf '%s\n' '${config.password}' | sudo -S bash ${remotePath}`, {
        onStdout: chunk => sendToClients(chunk.toString()),
        onStderr: chunk => sendToClients(`⚠️ ${chunk.toString()}`)
      });
      sendToClients(`✅ Script körd på ${config.host}`);
    } else {
      sendToClients(`⚙️  Kör inline apt-kommando på ${config.host}...`);
      const inline = [
        "apt update",
        "DEBIAN_FRONTEND=noninteractive apt -y full-upgrade",
        "apt -y autoremove",
        "sync"
      ].join(" && ");
      await ssh.execCommand(`printf '%s\n' '${config.password}' | sudo -S bash -lc "${inline}"`, {
        onStdout: chunk => sendToClients(chunk.toString()),
        onStderr: chunk => sendToClients(`⚠️ ${chunk.toString()}`)
      });
      sendToClients(`✅ Apt-uppdatering klar på ${config.host}`);
    }
  } catch (err) {
    sendToClients(`❌ Misslyckades på ${config.host}: ${err.message}`);
  } finally {
    ssh.dispose();
  }
}

// POST /upgrade → triggar uppgradering
app.post("/upgrade", (req, res) => {
  res.send("<p>🚀 Uppgradering startad, kolla status!</p>");
  hosts.forEach(host => upgradePi(host));
});

// Starta servern
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server kör på http://localhost:${PORT}`);
});
