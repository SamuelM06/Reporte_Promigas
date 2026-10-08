@echo off
REM ============================================================================
REM Lanzador del portal Gestion Diaria Promigas 2026.
REM ----------------------------------------------------------------------------
REM No abre ventana: normalmente lo invoca `npm run servidor:oculto` con la
REM consola oculta, o se puede doble clic (eso si abre una ventana de cmd).
REM
REM Puerto configurable:
REM     set PORT=8080 && iniciar-servidor.cmd
REM
REM El build y el arranque los hace scripts/lanzar-servidor.mjs, que ademas
REM detiene la instancia anterior, espera a que responda y verifica las rutas.
REM Todo el log (incluido el build) queda en:
REM     %TEMP%\reporte-promigas\lanzador.log
REM ============================================================================
setlocal
cd /d "%~dp0"
if not exist "%TEMP%\reporte-promigas" mkdir "%TEMP%\reporte-promigas"
call npm run servidor >> "%TEMP%\reporte-promigas\lanzador.log" 2>&1
endlocal