@echo off
echo ========================================
echo    CotizaPro - Servidor Local
echo ========================================
echo.
echo Abriendo CotizaPro en tu navegador...
echo.
echo Opciones de servidor:
echo.

REM Try Python first
python -c "import http.server; import webbrowser; print('Starting server on http://localhost:8080'); webbrowser.open('http://localhost:8080'); http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=8080)" 2>nul

REM If Python fails, try node
if errorlevel 1 (
    echo Python no encontrado, intentando con Node.js...
    npx serve . -p 8080 -o
)

pause
