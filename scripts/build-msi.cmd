@echo off
cd /d "%~dp0.."
node scripts\generate-ico.js
pushd client
call npm run build
popd
set CSC_IDENTITY_AUTO_DISCOVERY=false
set CSC_LINK=
set WIN_CSC_LINK=
call node_modules\.bin\electron-builder.cmd --config electron/build.config.js --win msi
