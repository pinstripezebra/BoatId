# BoatId Complete Startup Script
# This script sets up environment and runs both backend and frontend

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

Write-Host "Starting BoatId Development Environment" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Get current directory for absolute paths
$projectRoot = "C:\Users\seelc\OneDrive\Desktop\Lucas Desktop Items\Projects\BoatId"

# Setup environment variables
Write-Host "Setting up environment..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = $env:PATH + ";$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\tools"

if (-not $FrontendOnly) {
    Write-Host ""
    Write-Host "Starting Backend..." -ForegroundColor Green
    Write-Host "Navigate to backend/src and run:"
    Write-Host "  uvicorn main:app --reload" -ForegroundColor Yellow
    Write-Host "  python get_admin_token.py" -ForegroundColor Yellow
    Write-Host ""
    
    if (-not $BackendOnly) {
        # Start backend in new window with absolute paths
        $backendCommand = "cd '$projectRoot\backend\src'; & '$projectRoot\.venv\Scripts\Activate.ps1'; uvicorn main:app --reload"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand
        Start-Sleep -Seconds 2
    }
}

if (-not $BackendOnly) {
    Write-Host "Starting Frontend Environment..." -ForegroundColor Green
    
    # Check if emulator is running
    $devices = & adb devices 2>&1
    if (-not ($devices -match "emulator-.*device")) {
        Write-Host "Starting Android emulator..." -ForegroundColor Yellow
        Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList "-avd", "Medium_Phone_API_36.1"
        
        Write-Host "Waiting for emulator to boot..." -ForegroundColor Yellow
        $timeout = 60
        $elapsed = 0
        
        do {
            Start-Sleep -Seconds 5
            $elapsed += 5
            $devices = & adb devices 2>&1
            Write-Host "." -NoNewline
            
            if ($devices -match "emulator-.*device") {
                break
            }
            
            if ($elapsed -ge $timeout) {
                Write-Host ""
                Write-Host "Emulator is still starting. This may take a few more minutes..." -ForegroundColor Yellow
                break
            }
        } while ($true)
        
        Write-Host ""
        Write-Host "Emulator started!" -ForegroundColor Green
    } else {
        Write-Host "Emulator already running!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Ready to run React Native app!" -ForegroundColor Green
    Write-Host "Commands to run in frontend directory:" -ForegroundColor Yellow
    Write-Host "  cd frontend" -ForegroundColor Cyan
    Write-Host "  npx react-native run-android" -ForegroundColor Cyan
    Write-Host ""
    
    # Ask if user wants to run the React Native app automatically
    $runApp = Read-Host "Run React Native app now? (y/n)"
    if ($runApp -eq "y" -or $runApp -eq "Y") {
        Set-Location "$projectRoot\frontend"
        Write-Host "Building and running BoatId app..." -ForegroundColor Green
        npx react-native run-android
    }
}

Write-Host ""
Write-Host "BoatId Development Environment Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend URL: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "Login: admin_username / Admin_Password1!" -ForegroundColor Cyan