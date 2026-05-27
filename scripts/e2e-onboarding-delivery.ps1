# Track A onboarding delivery E2E (middleware :4000 → Java :8100)
# Usage: powershell -File scripts/e2e-onboarding-delivery.ps1
$ErrorActionPreference = "Stop"
$Base = "http://localhost:4000/api/v1"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$Email = "e2e_$ts@careerops.test"
$Password = "E2eTest!$ts"
$Username = "e2e$ts"
$Name = "E2E Tester"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$headers = @{
  "X-Requested-With" = "XMLHttpRequest"
  "Accept"           = "application/json"
}

Write-Step "Warm CSRF cookie"
Invoke-WebRequest -Uri "$Base/jobs/limits" -WebSession $session -Headers $headers -UseBasicParsing | Out-Null

Write-Step "Sign up $Email"
$signupBody = @{
  name     = $Name
  username = $Username
  email    = $Email
  password = $Password
} | ConvertTo-Json
$signup = Invoke-RestMethod -Uri "$Base/auth/signup" -Method POST -WebSession $session `
  -Headers $headers -ContentType "application/json" -Body $signupBody
$token = $signup.token
$headers["Authorization"] = "Bearer $token"
Write-Host "User id: $($signup.user.id)"

Write-Step "PUT profile (onboarded)"
$profileBody = @{
  name                = $Name
  targetRoles         = @("Full Stack Developer", "Software Engineer")
  techStack           = @("React", "Java", "TypeScript")
  sectors             = @("Full-time")
  location            = "Dublin, Ireland"
  salaryMin           = 60000
  salaryMax           = 120000
  salaryCurrency      = "EUR"
  availability        = "2 weeks notice"
  experienceLevel     = "senior"
  sponsorshipRequired = $false
  openToRemote        = $true
  remotePolicy        = "Hybrid"
  onboarded           = $true
  workExperience      = @(
    @{
      jobTitle    = "Software Engineer"
      companyName = "Acme Corp"
      startDate   = "2020-01"
      endDate     = ""
      current     = $true
      description = "Built APIs with Spring Boot and React."
    }
  )
  education = @(
    @{
      schoolName     = "Trinity College Dublin"
      degree         = "bachelors"
      fieldOfStudy   = "Computer Science"
      graduationYear = "2018"
    }
  )
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Uri "$Base/profile" -Method PUT -WebSession $session `
  -Headers $headers -ContentType "application/json" -Body $profileBody | Out-Null

Write-Step "Upload CV"
$cvPath = Join-Path $PSScriptRoot "sample-cv.pdf"
if (-not (Test-Path $cvPath)) {
  python (Join-Path $PSScriptRoot "make_sample_cv.py")
}
$uri = [Uri]$Base
$cookieHeader = ($session.Cookies.GetCookies($uri) | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
$curlOut = curl.exe -s -w "`n%{http_code}" -X POST "$Base/profile/cv" `
  -H "Authorization: Bearer $token" `
  -H "X-Requested-With: XMLHttpRequest" `
  -H "Cookie: $cookieHeader" `
  -F "file=@$cvPath;type=application/pdf"
$lines = $curlOut -split "`n"
$code = $lines[-1]
$body = ($lines[0..($lines.Length - 2)] -join "`n").Trim()
if ($code -notmatch '^2') {
  throw "CV upload failed HTTP $code : $body"
}
Write-Host "CV upload OK: $body"

Write-Step "Start onboarding delivery"
$start = Invoke-RestMethod -Uri "$Base/onboarding/delivery/start" -Method POST -WebSession $session -Headers $headers
Write-Host "Start: stage=$($start.stage) message=$($start.message)"

Write-Step "Poll delivery status (max 8 min)"
$deadline = (Get-Date).AddMinutes(8)
$last = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  $st = Invoke-RestMethod -Uri "$Base/onboarding/delivery/status" -WebSession $session -Headers $headers
  $last = $st
  $line = "stage=$($st.stage) evaluated=$($st.evaluatedCount)/$($st.minRequired) discovered=$($st.jobsDiscovered) readyPartial=$($st.readyPartial)"
  Write-Host $line
  if ($st.readyPartial -or $st.ready) {
    Write-Host "`nSUCCESS: Dashboard gate passed." -ForegroundColor Green
    $last | ConvertTo-Json -Depth 4
    exit 0
  }
  if ($st.stage -eq "failed") {
    Write-Host "`nFAILED: $($st.error)" -ForegroundColor Red
    $last | ConvertTo-Json -Depth 4
    exit 1
  }
}

Write-Host "`nTIMEOUT - last status:" -ForegroundColor Yellow
$last | ConvertTo-Json -Depth 4
exit 2
