#!/usr/bin/env bash
# Sync skill prompts from yugandharreddybana/career-ops-plugin (main) into backend classpath bundle.
set -euo pipefail

REF="${1:-main}"
OWNER="${GITHUB_FORK_OWNER:-yugandharreddybana}"
REPO="${GITHUB_FORK_REPO:-career-ops-plugin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/backend/src/main/resources/career-ops-skills"
BASE="https://raw.githubusercontent.com/${OWNER}/${REPO}/${REF}"

mkdir -p "$DEST/references"

echo "Syncing ${OWNER}/${REPO}@${REF} -> ${DEST}"

skills=$(curl -fsSL "https://api.github.com/repos/${OWNER}/${REPO}/contents/skills?ref=${REF}" | jq -r '.[] | select(.type=="dir") | .name')
for skill in $skills; do
  mkdir -p "${DEST}/${skill}"
  echo "  skills/${skill}/SKILL.md"
  curl -fsSL "${BASE}/skills/${skill}/SKILL.md" -o "${DEST}/${skill}/SKILL.md"
done

refs=$(curl -fsSL "https://api.github.com/repos/${OWNER}/${REPO}/contents/references?ref=${REF}" | jq -r '.[] | select(.type=="file") | .name')
for ref in $refs; do
  echo "  references/${ref}"
  curl -fsSL "${BASE}/references/${ref}" -o "${DEST}/references/${ref}"
done

EVAL="${DEST}/evaluate/SKILL.md"
if [[ -f "$EVAL" ]] && ! grep -q "EvaluationReportV2" "$EVAL"; then
  cat >> "$EVAL" <<'EOF'

---

## SaaS output contract (EvaluationReportV2)

Return ONLY valid JSON matching this schema (no markdown wrapper). Include all 10 dimension keys and six `sections` blocks (A–F narrative).

```json
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
```
EOF
  echo "  appended EvaluationReportV2 block to evaluate/SKILL.md"
fi

echo "Done."
