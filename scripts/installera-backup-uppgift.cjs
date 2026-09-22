/* eslint-disable @typescript-eslint/no-require-imports */
// Installerar (eller uppdaterar) den nattliga uppgiften "Kuggfri backup" i Windows
// Schemaläggaren så att den inte beror på vilken git-gren som ligger utcheckad.
//
//   node scripts/installera-backup-uppgift.cjs           installerar/uppdaterar
//   node scripts/installera-backup-uppgift.cjs --visa    visar vad som är satt just nu
//
// Startaren kopieras till %LOCALAPPDATA%\Kuggfri\ – alltså utanför repot, eftersom en
// startare inne i repot har exakt samma problem som den ska lösa. Källan är
// scripts/uppgift/kuggfri-backup.cmd; kör kommandot igen efter en ändring i den.
//
// Bakgrund och återställning: docs/BACKUP.md.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const KÄLLA = path.join(ROOT, "scripts", "uppgift", "kuggfri-backup.cmd");
// Utanför repot, men också utanför AppData: skript i %LOCALAPPDATA% startar inte från
// Task Scheduler på den här maskinen (körningen dör innan startaren hinner skriva en rad),
// medan samma fil i hemkatalogen fungerar.
const MÅLMAPP = path.join(process.env.USERPROFILE || "C:\\Users\\Alvin", "Kuggfri-drift");
const MÅL = path.join(MÅLMAPP, "kuggfri-backup.cmd");
const LOGG = path.join(ROOT, "backups", "backup.log");
const UPPGIFT = "Kuggfri backup";
const TID = "03:30";

/** Kör PowerShell utan profil. Skriptet skickas som ett enda argument, så inga extra citattecken. */
function powershell(skript) {
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", skript], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

if (process.argv.includes("--visa")) {
  console.log(
    powershell(
      `$t = Get-ScheduledTask -TaskName '${UPPGIFT}' -ErrorAction SilentlyContinue; ` +
        `if ($t) { $t.Actions | Format-List Execute, Arguments, WorkingDirectory; ` +
        `Get-ScheduledTaskInfo -TaskName '${UPPGIFT}' | Format-List LastRunTime, LastTaskResult, NextRunTime } ` +
        `else { "Uppgiften finns inte." }`,
    ),
  );
  process.exit(0);
}

if (!fs.existsSync(KÄLLA)) throw new Error(`Startaren saknas: ${KÄLLA}`);
if ([ROOT, MÅL, LOGG].some((p) => p.includes("'"))) {
  throw new Error("Sökvägarna får inte innehålla apostrof; PowerShell-anropet citerar med apostrofer.");
}
fs.mkdirSync(MÅLMAPP, { recursive: true });
fs.mkdirSync(path.dirname(LOGG), { recursive: true });
fs.copyFileSync(KÄLLA, MÅL);
console.log(`startare installerad: ${MÅL}`);

// Formen är utprovad mot Task Scheduler, inte gissad. Två varianter som fungerar från ett
// vanligt skal misslyckas här: `cmd /c "" …" … >> logg 2>&1"` (det yttre citatparet) svarar
// "The system cannot find the path specified." innan startaren börjar, och en .cmd-fil som
// uppgiftens egen Execute startar över huvud taget inte (resultat 1, ingen rad i loggen).
// `cmd /c call "startare" "repo"` fungerar, och startaren sköter sin egen loggning.
const argument = `/c call "${MÅL}" "${ROOT}"`;

// Ta bort en befintlig uppgift först. `Register-ScheduledTask -Force` svarar "Access is
// denied" när uppgiften redan finns, utan att kräva administratör för att skapa en ny.
try {
  powershell(`Unregister-ScheduledTask -TaskName '${UPPGIFT}' -Confirm:$false -ErrorAction Stop`);
  console.log("tog bort den tidigare uppgiften");
} catch {
  // Fanns inte – också ett giltigt utgångsläge.
}

// Två utlösare, som den ursprungliga uppgiften: natten 03:30 och vid inloggning, så att
// en dag inte tappas för att datorn var avstängd. StartWhenAvailable kör dessutom ikapp
// en missad nattkörning så snart maskinen är igång igen.
powershell(
  `$a = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '${argument}' -WorkingDirectory '${ROOT}'; ` +
    `$natt = New-ScheduledTaskTrigger -Daily -At ${TID}; ` +
    // -User krävs: utan den gäller utlösaren alla användare, och då nekas registreringen
    // för den som inte kör som administratör.
    `$logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\\$env:USERNAME"; ` +
    `$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30); ` +
    `Register-ScheduledTask -TaskName '${UPPGIFT}' -Action $a -Trigger $natt,$logon -Settings $s -Description 'Nattlig backup av Kuggfris produktionsdatabas. Källa: scripts/uppgift/kuggfri-backup.cmd' -Force | Out-Null`,
);

console.log(`uppgiften "${UPPGIFT}" uppdaterad: varje dag ${TID}`);
console.log(`loggen: ${LOGG}`);
console.log("kontrollera med: node scripts/installera-backup-uppgift.cjs --visa");
