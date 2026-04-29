@echo off
set ADB=C:\Users\rjmar\AppData\Local\Android\Sdk\platform-tools\adb.exe

echo === Building client ===
cd /d C:\Users\rjmar\queuedj\apps\box-client
call npm run build
if errorlevel 1 goto :error
cd /d C:\Users\rjmar\queuedj

echo.
echo === Creating device directories ===
"%ADB%" shell "mkdir -p /sdcard/box/src/games /sdcard/box/src/seed /sdcard/box-client-dist/assets"

echo.
echo === Pushing server source ===
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\index.ts"          /sdcard/box/src/index.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\db.ts"             /sdcard/box/src/db.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\types.ts"          /sdcard/box/src/types.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\rooms.ts"          /sdcard/box/src/rooms.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed-trivia.ts"    /sdcard/box/src/seed-trivia.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed-wyr.ts"       /sdcard/box/src/seed-wyr.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\sqlite.d.ts"       /sdcard/box/src/sqlite.d.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\combine-all.ts"    /sdcard/box/src/combine-all.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\package.json"          /sdcard/box/package.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\tsconfig.json"         /sdcard/box/tsconfig.json
"%ADB%" push "C:\Users\rjmar\queuedj\tsconfig.base.json"             /sdcard/box/tsconfig.base.json

echo.
echo === Pushing all 9 game modules ===
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\trivia.ts"       /sdcard/box/src/games/trivia.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\wyr.ts"          /sdcard/box/src/games/wyr.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\guesstimate.ts"  /sdcard/box/src/games/guesstimate.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\buzzer.ts"       /sdcard/box/src/games/buzzer.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\rankit.ts"       /sdcard/box/src/games/rankit.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\connections.ts"  /sdcard/box/src/games/connections.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\geoguesser.ts"   /sdcard/box/src/games/geoguesser.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\thedraft.ts"     /sdcard/box/src/games/thedraft.ts
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\games\draw.ts"         /sdcard/box/src/games/draw.ts

echo.
echo === Pushing seed JSONs ===
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\questions-full.json"        /sdcard/box/src/seed/questions-full.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\wyr-prompts.json"           /sdcard/box/src/seed/wyr-prompts.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\draw-words.json"            /sdcard/box/src/seed/draw-words.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\guesstimate-questions.json" /sdcard/box/src/seed/guesstimate-questions.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\rankit-challenges.json"     /sdcard/box/src/seed/rankit-challenges.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\connections-puzzles.json"   /sdcard/box/src/seed/connections-puzzles.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\geoguesser-questions.json"  /sdcard/box/src/seed/geoguesser-questions.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\thedraft-scenarios.json"    /sdcard/box/src/seed/thedraft-scenarios.json
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box\src\seed\buzzer-questions.json"      /sdcard/box/src/seed/buzzer-questions.json

echo.
echo === Pushing client dist ===
"%ADB%" push "C:\Users\rjmar\queuedj\apps\box-client\dist\." /sdcard/box-client-dist/

echo.
echo === Pushing deploy script ===
"%ADB%" push "C:\Users\rjmar\queuedj\deploy-phase3.sh" /sdcard/deploy-phase3.sh

echo.
echo === PUSH COMPLETE ===
echo.
echo Now in Termux on the tablet:
echo   bash /sdcard/deploy-phase3.sh
echo.
goto :end

:error
echo BUILD FAILED — fix errors, then run again.
exit /b 1

:end
