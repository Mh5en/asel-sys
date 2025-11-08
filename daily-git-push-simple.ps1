# Daily GitHub Push Script
# This script runs daily to push changes to GitHub

param(
    [string]$GitHubRepo = ""
)

# Get project path
$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Daily GitHub Push" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git repository exists
if (-not (Test-Path ".git")) {
    Write-Host "Error: Not a git repository!" -ForegroundColor Red
    exit 1
}

# Check if remote exists
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "Warning: No remote repository" -ForegroundColor Yellow
    if ($GitHubRepo -eq "") {
        Write-Host "Please add remote repository" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "Adding remote repository: $GitHubRepo" -ForegroundColor Yellow
        git remote add origin $GitHubRepo
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to add remote repository!" -ForegroundColor Red
            exit 1
        }
    }
}

# Create or update daily log file
$logFile = "daily-commits-log.md"
$today = Get-Date -Format "yyyy-MM-dd"
$startDate = (Get-Date).AddDays(-30)
$dayNumber = [math]::Floor((New-TimeSpan -Start $startDate -End (Get-Date)).TotalDays) + 1

# Read file if exists
$logContent = @"
# Daily GitHub Push Log

This file is updated daily as part of daily GitHub updates.

"@

if (Test-Path $logFile) {
    $logContent = Get-Content $logFile -Raw -Encoding UTF8
}

# Add new entry
$newEntry = @"

## Day $today

- **Date**: $today
- **Time**: $(Get-Date -Format "HH:mm:ss")
- **Day Number**: $dayNumber of 30

Project updated successfully today! ✅

"@

# Check if entry for today exists
if ($logContent -notmatch "## Day $today") {
    $logContent += $newEntry
    Set-Content -Path $logFile -Value $logContent -Encoding UTF8
    Write-Host "Updated daily log file" -ForegroundColor Green
} else {
    Write-Host "Log already updated today" -ForegroundColor Yellow
    # Update time only
    $logContent = $logContent -replace "(\*\*Time\*\*: )\d{2}:\d{2}:\d{2}", "`$1$(Get-Date -Format 'HH:mm:ss')"
    Set-Content -Path $logFile -Value $logContent -Encoding UTF8
}

# Check for changes
git add .
$status = git status --porcelain

if ($status) {
    Write-Host ""
    Write-Host "Changes detected:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor Gray
    Write-Host ""
    
    # Create commit
    $commitMessage = "Daily update - $today (Day $dayNumber of 30)"
    Write-Host "Creating commit..." -ForegroundColor Yellow
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit created successfully" -ForegroundColor Green
        
        # Push to GitHub
        Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
        git push origin main 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Pushed to GitHub successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Statistics:" -ForegroundColor Cyan
            Write-Host "   - Date: $today" -ForegroundColor White
            Write-Host "   - Day: $dayNumber of 30" -ForegroundColor White
            Write-Host "   - Commit: $commitMessage" -ForegroundColor White
        } else {
            Write-Host "Failed to push to GitHub!" -ForegroundColor Red
            Write-Host "Check internet connection or GitHub permissions" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Failed to create commit!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "No changes to push" -ForegroundColor Yellow
    Write-Host "   (Maybe already pushed today)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

