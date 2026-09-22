@echo off
rem Startare for den nattliga uppgiften "Kuggfri backup".
rem
rem Den har filen ar kallan; den installerade kopian ligger UTANFOR repot
rem (%LOCALAPPDATA%\Kuggfri\kuggfri-backup.cmd) och installeras om med
rem   node scripts/installera-backup-uppgift.cjs
rem
rem Varfor en startare: uppgiften korde tidigare "node scripts\backup.cjs" direkt i
rem arbetskatalogen. Nar en gren utan den filen var utcheckad (t.ex. under-utveckling
rem den 22 september) foll varje korning med MODULE_NOT_FOUND, och backuperna slutade
rem tyst. Startaren hamtar da skriptet ur main i stallet, sa att backupen aldrig beror
rem pa vilken gren som rakar ligga i tradet.
rem
rem Startaren skoter ocksa sin egen loggning. Uppgiften kor alltsa den har filen direkt,
rem utan "cmd /c ... >> logg", eftersom den omvagen visade sig vara skor: Task Scheduler
rem fick cmd att svara "The system cannot find the path specified." innan startaren ens
rem borjade, och felet syntes bara i loggen.
setlocal

set "REPO=%~1"
if "%REPO%"=="" set "REPO=C:\Users\Alvin\flashcardengine"
set "LOGG=%REPO%\backups\backup.log"

if not exist "%REPO%\backups" mkdir "%REPO%\backups" 2>nul
call :kor %* >> "%LOGG%" 2>&1
exit /b %errorlevel%

:kor
echo [startare] %DATE% %TIME% repo=%REPO%

set "NODE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE%" set "NODE=node"

cd /d "%REPO%"
if errorlevel 1 (
  echo [backup] MISSLYCKADES: hittar inte repot %REPO%
  exit /b 1
)

if exist "scripts\backup.cjs" (
  "%NODE%" "scripts\backup.cjs" %2 %3 %4
  exit /b %errorlevel%
)

echo [backup] scripts\backup.cjs saknas pa utcheckad gren - anvander versionen fran main
if not exist ".drift" mkdir ".drift"
git show main:scripts/backup.cjs > ".drift\backup.cjs" 2>".drift\git-fel.txt"
if errorlevel 1 (
  echo [backup] MISSLYCKADES: kunde inte hamta scripts/backup.cjs ur main
  type ".drift\git-fel.txt"
  exit /b 1
)

"%NODE%" ".drift\backup.cjs" %2 %3 %4
exit /b %errorlevel%
