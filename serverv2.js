require('dotenv').config();
const express = require('express');
const { Client } = require('ssh2');

const app = express();
const port = 3000;

app.use(express.static('public'));

const hosts = process.env.RASPI_HOSTS.split(',');
const user = process.env.RASPI_USER;
const password = process.env.RASPI_PASS;

// SSE endpoint
app.get('/update-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendMessage = (msg) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  const updatePi = (host) => {
    return new Promise((resolve) => {
      const conn = new Client();
      conn.on('ready', () => {
        sendMessage({ host, status: 'connected', message: 'SSH ready' });

        // Non-interactive apt-get upgrade
        const cmd = 'sudo DEBIAN_FRONTEND=noninteractive apt-get update && ' +
                    'sudo DEBIAN_FRONTEND=noninteractive apt-get -y -o Dpkg::Options::="--force-confold" upgrade';

        conn.exec(cmd, (err, stream) => {
          if (err) {
            sendMessage({ host, status: 'error', message: err.message });
            resolve();
            return;
          }

          stream.on('close', () => {
            conn.end();
            sendMessage({ host, status: 'done', message: 'Uppdatering klar' });
            resolve();
          }).on('data', (data) => {
            sendMessage({ host, status: 'updating', message: data.toString() });
          }).stderr.on('data', (data) => {
            sendMessage({ host, status: 'updating', message: data.toString() });
          });
        });
      }).on('error', (err) => {
        sendMessage({ host, status: 'error', message: err.message });
        resolve();
      }).connect({
        host,
        port: 22,
        username: user,
        password
      });
    });
  };

  // Kör alla Pis parallellt
  Promise.all(hosts.map(updatePi)).then(() => {
    sendMessage({ status: 'finished', message: 'Alla Raspberry Pis uppdaterade' });
    res.end();
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
