# Sync skill prompts from yugandharreddybana/career-ops-plugin (main) into backend classpath bundle.
# Usage: .\scripts\sync-career-ops-plugin.ps1 [-Ref main] [-Owner yugandharreddybana]

param(
    [string]$Ref = "main",
    [string]$Owner = "yugandharreddybana",
    [string]$Repo = "career-ops-plugin"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$DestRoot = Join-Path $Root "backend\src\main\resources\career-ops-skills"
$BaseUrl = "https://raw.githubusercontent.com/$Owner/$Repo/$Ref"

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Download-File([string]$RemotePath, [string]$LocalPath) {
    $url = "$BaseUrl/$RemotePath"
    Ensure-Dir (Split-Path -Parent $LocalPath)
    Write-Host "  $RemotePath"
    Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $LocalPath
}

Write-Host "Syncing $Owner/$Repo@$Ref -> $DestRoot"

$apiSkills = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/contents/skills?ref=$Ref"
foreach ($entry in $apiSkills) {
    if ($entry.type -ne "dir") { continue }
    $skill = $entry.name
    Download-File "skills/$skill/SKILL.md" (Join-Path $DestRoot "$skill\SKILL.md")
}

Ensure-Dir (Join-Path $DestRoot "references")
$apiRefs = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/contents/references?ref=$Ref"
foreach ($entry in $apiRefs) {
    if ($entry.type -ne "file") { continue }
    Download-File "references/$($entry.name)" (Join-Path $DestRoot "references\$($entry.name)")
}

# SaaS-only skills not in upstream fork (keep if missing from API list)
$saasOnly = @(
    "salary-negotiation", "culture-fit", "linkedin-optimize", "cover-letter", "skills-gap-plan", "prep-interview"
)
foreach ($skill in $saasOnly) {
    $local = Join-Path $DestRoot "$skill\SKILL.md"
    if (-not (Test-Path $local)) {
        Write-Host "  (skip missing SaaS skill: $skill)"
    }
}

# Append EvaluationReportV2 JSON schema to evaluate SKILL if not already present
$evaluatePath = Join-Path $DestRoot "evaluate\SKILL.md"
if (Test-Path $evaluatePath) {
    $content = Get-Content $evaluatePath -Raw
    if ($content -notmatch "EvaluationReportV2") {
        $append = @"

---

## SaaS output contract (EvaluationReportV2)

Return ONLY valid JSON matching this schema (no markdown wrapper). Include all 10 dimension keys and six `sections` blocks (A–F narrative).

``````json
{
  "schemaVersion": 2,
  "archetype": "string",
  "applyScore": 4.2,
  "overallScore": 84,
  "matchPercent": 88,
  "verdict": "Worth applying",
  "humanSummary": "string",
  "matchedSkills": [],
  "unmatchedSkills": [],
  "sponsorshipMatch": true,
  "salaryMatch": true,
  "cvImprovementTips": [],
  "dimensions": [
    { "key": "role_fit", "label": "Role fit", "score": 4.5, "weight": 0.1, "reason": "max 280 chars" }
  ],
  "sections": {
    "executiveSummary": "A",
    "backgroundMatch": "B",
    "positioningStrategy": "C",
    "compensationAndMarket": "D",
    "tailoringPlan": "E",
    "interviewPrep": "F"
  },
  "storyBankCandidates": [],
  "evaluationStatus": "complete",
  "source": "skill_evaluate"
}
``````
"@
        Add-Content -Path $evaluatePath -Value $append -Encoding utf8
        Write-Host "  appended EvaluationReportV2 block to evaluate/SKILL.md"
    }
}

Write-Host "Done. Update skill.prompt.github.commit-sha if pinning a specific commit."
