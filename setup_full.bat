@echo off
setlocal

REM Ajouter Node.js au PATH
set PATH=C:\Program Files\nodejs;%PATH%

echo === VERIFICATION NODE.JS ===
node --version
if errorlevel 1 goto error
call npm --version
if errorlevel 1 goto error

echo === BACKEND ===
cd /d "d:\SCHAMGAR\media_box_backend_corrige\backend"
if errorlevel 1 goto error

echo Creation venv...
py -3.12 -m venv --upgrade .venv
if errorlevel 1 goto error

echo Installation dependances Python...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto error

echo Copie .env...
if not exist .env copy .env.example .env
if errorlevel 1 goto error

echo Migrations Django...
.venv\Scripts\python.exe manage.py migrate
if errorlevel 1 goto error

echo === FRONTEND ===
cd /d "d:\SCHAMGAR\media_box_backend_corrige\frontend"
if errorlevel 1 goto error

echo Installation dependances Node...
call npm ci
if errorlevel 1 goto error

echo Copie .env...
if not exist .env copy .env.example .env
if errorlevel 1 goto error

echo.
echo === INSTALLATION TERMINEE ===
echo.
echo Pour lancer le backend : cd backend ^&^& .venv\Scripts\activate ^&^& python manage.py runserver
echo Pour lancer le front : cd frontend ^&^& npm run dev
pause
exit /b 0

:error
set "setup_error=%errorlevel%"
echo.
echo ERREUR : l'installation a echoue (code %setup_error%).
pause
exit /b %setup_error%