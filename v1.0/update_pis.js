const { NodeSSH } = require("node-ssh");
const sshList = [
  { host: "RPi-id22.edu.linkoping.se" },
  { host: "RPi-id23.edu.linkoping.se" },
  { host: "RPi-id24.edu.linkoping.se" },
];
const USER = "tekniker";
const PASSWORD = "Bot4nist!";

async function runBatch() {
  for (const { host } of sshList) {
    const ssh = new NodeSSH();
    try {
      console.log(`🔗 Ansluter till ${host}...`);
      await ssh.connect({ host, username: USER, password: PASSWORD, readyTimeout: 30000 });
      console.log(`✅ Ansluten till ${host}`);

      // Kör uppdateringsskript
      const remoteScript = "/tmp/update.sh";
      await ssh.putFile("update.sh", remoteScript);
      await ssh.execCommand(`printf '%s\n' '${PASSWORD}' | sudo -S bash ${remoteScript}`, {
        onStdout(chunk) { process.stdout.write(chunk.toString()); },
        onStderr(chunk) { process.stderr.write(chunk.toString()); }
      });
      console.log(`✅ Klart på ${host}`);
    } catch (err) {
      console.error(`❌ Misslyckades på ${host}:`, err);
    } finally {
      ssh.dispose();
    }
  }
  console.log("🔚 Alla enheter klara!");
}

runBatch();
