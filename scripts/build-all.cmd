@echo off
cd /d "%~dp0.."
echo Generating icon...
node scripts\generate-ico.js
echo Building React client...
pushd client
call npm run build
popd
echo Building all Windows targets (zip + exe + msi)...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set CSC_LINK=
set WIN_CSC_LINK=
call node_modules\.bin\electron-builder.cmd --config electron/build.config.js --win
echo.
echo Done. Check dist-electron\ for output files.
