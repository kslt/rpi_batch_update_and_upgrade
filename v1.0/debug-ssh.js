require("dotenv").config();
const { NodeSSH } = require("node-ssh");

const hosts = process.env.HOSTS.split(",").map(h => h.trim());
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

hosts.forEach(async (host) => {
  const ssh = new NodeSSH();

  console.log(`\n🔹 Testar anslutning till ${host}...`);

  try {
    await ssh.connect({
      host,
      username,
      password,
      tryKeyboard: false, // stänger av keyboard-interactive
      agent: false,       // stänger av SSH-agent / nycklar
      readyTimeout: 30000, // längre timeout
      debug: (msg) => console.log(`[DEBUG] ${msg}`) // loggar alla steg
    });

    console.log(`✅ Ansluten till ${host}!`);
    const result = await ssh.execCommand("echo 'Hello från Pi!'");
    console.log(`[OUTPUT] ${host}: ${result.stdout}`);
  } catch (err) {
    console.error(`❌ Misslyckades på ${host}:`, err.message);
  } finally {
    ssh.dispose();
  }
});
