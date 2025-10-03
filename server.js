require('dotenv').config();
const express = require('express');
const { Client } = require('ssh2');

const app = express();
const port = 3000;

app.use(express.static('public'));

const hosts = process.env.RASPI_HOSTS.split(',').map(h => {
  const [host, port] = h.split(':');
  return { host, port: port ? parseInt(port) : 22 }; // default 22
});
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

const updatePi = ({ host, port }) => {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      sendMessage({ host, status: 'connected', message: 'SSH ready' });

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
      port,
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

app.get('/command-stream', (req, res) => {
  const cmd = req.query.cmd;
  if (!cmd) {
    res.status(400).send('Missing cmd parameter');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendMessage = (msg) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  const runCommandOnPi = ({ host, port }) => {
  return new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => {
      sendMessage({ host, status: 'connected', message: 'SSH ready' });

      conn.exec(cmd, (err, stream) => {
        if (err) {
          sendMessage({ host, status: 'error', message: err.message });
          resolve();
          return;
        }

        stream.on('close', () => {
          conn.end();
          sendMessage({ host, status: 'done', message: 'Kommando klart' });
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
      port,
      username: user,
      password
    });
  });
};

  // Kör parallellt
  Promise.all(hosts.map(runCommandOnPi)).then(() => {
    sendMessage({ status: 'finished', message: `Alla Pis har kört: ${cmd}` });
    res.end();
  });
});

// Aktivera automatiska säkerhetsuppdateringar
app.get('/enable-unattended', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendMessage = (msg) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  // Kommandon för unattended-upgrades
  const unattendedCmd = `
    sudo apt-get update &&
    sudo apt-get install -y unattended-upgrades apt-listchanges &&
    sudo dpkg-reconfigure -f noninteractive unattended-upgrades
  `;

  const runCommandOnPi = ({ host, port }) => {
    return new Promise((resolve) => {
      const conn = new Client();
      conn.on('ready', () => {
        sendMessage({ host, status: 'connected', message: 'SSH ready' });

        conn.exec(unattendedCmd, (err, stream) => {
          if (err) {
            sendMessage({ host, status: 'error', message: err.message });
            resolve();
            return;
          }

          stream.on('close', () => {
            conn.end();
            sendMessage({ host, status: 'done', message: 'Unattended upgrades aktiverat' });
            resolve();
          }).on('data', (data) => {
            sendMessage({ host, status: 'running', message: data.toString() });
          }).stderr.on('data', (data) => {
            sendMessage({ host, status: 'error', message: data.toString() });
          });
        });
      }).on('error', (err) => {
        sendMessage({ host, status: 'error', message: err.message });
        resolve();
      }).connect({
        host,
        port,
        username: user,
        password
      });
    });
  };

  Promise.all(hosts.map(runCommandOnPi)).then(() => {
    sendMessage({ status: 'finished', message: 'Alla Pis har fått unattended-upgrades aktiverat' });
    res.end();
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
