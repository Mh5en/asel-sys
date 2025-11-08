# Daily Gradual Push Script
# This script pushes files gradually over 30 days
# Each day adds a new batch of files as if working on the project

param(
    [string]$GitHubRepo = ""
)

# Get project path
$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Daily Gradual Push - Day by Day" -ForegroundColor Cyan
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
    }
}

# Read progress file
$progressFile = ".daily-push-progress.txt"
$dayNumber = 1
$filesPushed = 0
$totalFiles = 0
$lastPushDate = ""

if (Test-Path $progressFile) {
    $progressContent = Get-Content $progressFile -Raw
    if ($progressContent -match "DayNumber:\s*(\d+)") {
        $dayNumber = [int]$matches[1] + 1
    }
    if ($progressContent -match "FilesPushed:\s*(\d+)") {
        $filesPushed = [int]$matches[1]
    }
    if ($progressContent -match "TotalFiles:\s*(\d+)") {
        $totalFiles = [int]$matches[1]
    }
    if ($progressContent -match "LastPushDate:\s*([^\r\n]+)") {
        $lastPushDate = $matches[1].Trim()
    }
}

# Check if already pushed today
$today = Get-Date -Format "yyyy-MM-dd"
if ($lastPushDate -eq $today) {
    Write-Host "Already pushed today ($today). Skipping..." -ForegroundColor Yellow
    exit 0
}

# Check if 30 days completed
if ($dayNumber -gt 30) {
    Write-Host "30 days completed! All files have been pushed." -ForegroundColor Green
    exit 0
}

# Read distribution plan
$planFile = ".file-distribution-plan.txt"
if (-not (Test-Path $planFile)) {
    Write-Host "Error: Distribution plan not found!" -ForegroundColor Red
    Write-Host "Please run setup-gradual-push.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Get files for today
$planContent = Get-Content $planFile -Raw
$dayPattern = "## Day $dayNumber\s+Files: (\d+)\s+([\s\S]*?)(?=## Day|\Z)"
if ($planContent -match $dayPattern) {
    $filesCount = [int]$matches[1]
    $filesList = $matches[2].Trim() -split "`n" | Where-Object { $_ -ne "" }
    
    Write-Host "Day $dayNumber of 30" -ForegroundColor Cyan
    Write-Host "Files to add today: $filesCount" -ForegroundColor Yellow
    Write-Host ""
    
    # Add files for today
    $filesAdded = 0
    foreach ($file in $filesList) {
        if (Test-Path $file) {
            git add $file
            $filesAdded++
            Write-Host "  + $file" -ForegroundColor Gray
        } else {
            Write-Host "  ! File not found: $file" -ForegroundColor Yellow
        }
    }
    
    if ($filesAdded -eq 0) {
        Write-Host "No files to add today. All files may have been pushed already." -ForegroundColor Yellow
        exit 0
    }
    
    # Create commit message
    $commitMessage = "Day $dayNumber: Add project files ($filesAdded files)"
    
    # Create commit
    Write-Host ""
    Write-Host "Creating commit..." -ForegroundColor Yellow
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit created successfully" -ForegroundColor Green
        
        # Push to GitHub
        Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
        git push origin main 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Pushed to GitHub successfully!" -ForegroundColor Green
            
            # Update progress
            $filesPushed += $filesAdded
            $time = Get-Date -Format "HH:mm:ss"
            $progressContent = @"
LastPushDate: $today
LastPushTime: $time
DayNumber: $dayNumber
TotalDays: 30
FilesPushed: $filesPushed
TotalFiles: $totalFiles
"@
            Set-Content -Path $progressFile -Value $progressContent -Encoding UTF8
            
            Write-Host ""
            Write-Host "Statistics:" -ForegroundColor Cyan
            Write-Host "   - Date: $today" -ForegroundColor White
            Write-Host "   - Day: $dayNumber of 30" -ForegroundColor White
            Write-Host "   - Files added: $filesAdded" -ForegroundColor White
            Write-Host "   - Total files pushed: $filesPushed of $totalFiles" -ForegroundColor White
            Write-Host "   - Progress: $([math]::Round(($dayNumber/30)*100, 1))%" -ForegroundColor White
        } else {
            Write-Host "Failed to push to GitHub!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Failed to create commit!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: Could not find files for Day $dayNumber" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

