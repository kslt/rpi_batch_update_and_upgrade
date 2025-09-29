const { NodeSSH } = require("node-ssh");
const ssh = new NodeSSH();

ssh.connect({
  host: "RPi-id24.edu.linkoping.se",
  username: "tekniker",
  password: "Bot4nist!",
  tryKeyboard: false,
  agent: false,
  readyTimeout: 20000
}).then(() => {
  console.log("✅ Ansluten!");
  return ssh.execCommand("echo 'Hello from Pi!'");
}).then(result => {
  console.log(result.stdout);
  ssh.dispose();
}).catch(err => {
  console.error("❌ Misslyckades:", err);
});
