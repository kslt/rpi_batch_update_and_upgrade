// update-runner.js
const fs = require("fs");
const path = require("path");
const { NodeSSH } = require("node-ssh");
const ssh = new NodeSSH();

const HOST = "RPi-id24.edu.linkoping.se";   // ändra vid behov
const USER = "tekniker";
const PASSWORD = "Bot4nist!";

async function run() {
  try {
    console.log(`🔗 Försöker ansluta till ${HOST}...`);
    await ssh.connect({
      host: HOST,
      username: USER,
      password: PASSWORD,
      tryKeyboard: false,
      agent: false,
      readyTimeout: 30000
    });
    console.log("✅ Ansluten!");

    // Om lokal update.sh finns -> ladda upp och kör den
    const localScript = path.join(__dirname, "update.sh");
    if (fs.existsSync(localScript)) {
      const remotePath = "/tmp/update.sh";
      console.log(`⬆️  Uppladdar ${localScript} -> ${remotePath} ...`);
      await ssh.putFile(localScript, remotePath);
      // sätt körbar och kör med sudo
      console.log("⚙️  Sätter körbar och kör skriptet med sudo...");
      // Kör skriptet med sudo och skicka lösenord via stdin (printf för korrekt newline)
      const command = `printf '%s\n' '${PASSWORD}' | sudo -S bash ${remotePath}`;
      const result = await ssh.execCommand(command, {
        onStdout(chunk) { process.stdout.write(chunk.toString()); },
        onStderr(chunk) { process.stderr.write(chunk.toString()); }
      });
      if (result.stderr && result.stderr.trim() !== "") {
        console.error("\n⚠️ Stderr från skript:", result.stderr);
      }
      console.log("\n✅ Färdig med skriptkörning.");
    } else {
      // Kör standard-apt-kommando sekventiellt i en sudo-bash
      console.log("⚙️  Ingen lokal update.sh hittad — kör inline apt-kommando via sudo...");
      // Bygg ett bash-kommando som kör flera steg under sudo
      const inline = [
        "apt update",
        "DEBIAN_FRONTEND=noninteractive apt -y full-upgrade",
        "apt -y autoremove",
        "sync"
        // reboot hålls som en valfri sista åtgärd (se nedan)
      ].join(" && ");

      // Kör kommandot som sudo (skickar lösenord via printf -> sudo -S)
      const command = `printf '%s\n' '${PASSWORD}' | sudo -S bash -lc "${inline}"`;
      const result = await ssh.execCommand(command, {
        onStdout(chunk) { process.stdout.write(chunk.toString()); },
        onStderr(chunk) { process.stderr.write(chunk.toString()); }
      });

      if (result.stderr && result.stderr.trim() !== "") {
        console.error("\n⚠️ Stderr från apt-kommandon:", result.stderr);
      } else {
        console.log("\n✅ Apt-uppdateringar klara.");
      }

      // Om du vill reboot:a automatiskt (kommentera in om du vill)
      // console.log("🔄 Startar om enheten...");
      // await ssh.execCommand(`printf '%s\n' '${PASSWORD}' | sudo -S reboot`);
    }
  } catch (err) {
    console.error("❌ Misslyckades:", err);
  } finally {
    try { ssh.dispose(); } catch (e) {}
    console.log("🔚 Klart.");
  }
}

run();
