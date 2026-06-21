param(
  [string]$CardsDir = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
$mapPath = Join-Path $CardsDir 'task-import-map.json'
$utf8 = [System.Text.Encoding]::UTF8
$map = [System.IO.File]::ReadAllText($mapPath, $utf8) | ConvertFrom-Json
$requiredHeadings = @('## 1. Objective','## 2. Scope','Required Deliverables','## 3. Required Work','## 4. Acceptance Criteria','## 5. Validation','## 6. Required Evidence','## 7. Completion Writeback','## 8. Non-Completion Rule','## Claude Closeout Review')
$issues = @()
$seen = @{}
foreach ($card in $map.cards) {
  $path = Join-Path $CardsDir $card.file
  if (-not (Test-Path -LiteralPath $path)) { $issues += "$($card.id): missing file $($card.file)"; continue }
  if ($seen.ContainsKey($card.id)) { $issues += "duplicate id $($card.id)" }
  $seen[$card.id] = $true
  foreach ($dep in $card.depends_on) {
    if (-not ($map.cards.id -contains $dep)) { $issues += "$($card.id): unknown dependency $dep" }
  }
  $text = [System.IO.File]::ReadAllText($path, $utf8)
  if ($text -match '[\x00-\x08\x0B\x0C\x0E-\x1F]') { $issues += "$($card.file): contains invalid control characters" }
  if ($text.Contains('`r`n')) { $issues += "$($card.file): contains literal backtick-r/backtick-n sequence" }
  foreach ($heading in $requiredHeadings) { if (-not ([string]$text).Contains($heading)) { $issues += "$($card.file): missing $heading" } }
  foreach ($phrase in @('Primary deliverables','Closeout deliverables','Artifact existence validation','changed files:', 'created artifacts:', 'validation commands:', 'validation results, including exit code:', 'skipped validations and reason:', 'protected files unchanged:', 'remaining blockers:', 'completion status:', 'validate_closure.py', 'accepted_blocking', 'rejected_false_positive', 'required artifact path missing')) {
    if (-not ([string]$text).Contains($phrase)) { $issues += "$($card.file): missing completion field $phrase" }
  }
  if (-not ([string]$text).Contains("execution-cards/$([IO.Path]::GetFileNameWithoutExtension($card.file)).claude-review/closure.json")) {
    $issues += "$($card.file): missing same-stem Claude closure artifact path"
  }
}
# Topological linear check: each card can only depend on prior ids in map order.
$prior = @{}
foreach ($card in $map.cards) {
  foreach ($dep in $card.depends_on) { if (-not $prior.ContainsKey($dep)) { $issues += "$($card.id): dependency $dep appears after or missing from prior order" } }
  $prior[$card.id] = $true
}
# Coverage references.
$allText = ((Get-ChildItem -LiteralPath $CardsDir -Filter 'EXEC-*.md') | ForEach-Object { [System.IO.File]::ReadAllText($_.FullName, $utf8) }) -join "`n"
foreach ($needle in @('tool-schemas.json','docs/design/threat-model.md','docs/design/test-matrix.md','docs/design/official-evidence.md','docs/design/task-card.md')) {
  if ($allText -notlike "*$needle*") { $issues += "missing global design reference $needle" }
}
$indexPath = Join-Path $CardsDir 'index.md'
$indexText = [System.IO.File]::ReadAllText($indexPath, $utf8)
if ($indexText -like '*`n|*') { $issues += "index.md: contains literal backtick-n in table" }
if ($indexText -notlike '*ExecutionPolicy Bypass*') { $issues += "index.md: missing supported PowerShell validation invocation" }
if ($indexText -notlike '*execution-validation-report.md*') { $issues += "index.md: missing final validation report requirement" }
$exec000 = [System.IO.File]::ReadAllText((Join-Path $CardsDir 'EXEC-000-design-baseline-coverage-gate.md'), $utf8)
if ($exec000 -notlike '*EXEC-010*') { $issues += "EXEC-000: coverage map does not include EXEC-010" }
$schemaPath = Join-Path (Split-Path -Parent $CardsDir) 'tool-schemas.json'
$schemaText = [System.IO.File]::ReadAllText($schemaPath, $utf8)
$schema = $schemaText | ConvertFrom-Json
foreach ($field in @('content_origin','instruction_trust','isError','error_code','message','audit_id','retryable','next_cursor','tool_error')) {
  if (-not $schemaText.Contains($field)) { $issues += "tool-schemas.json: missing safety/schema field $field" }
}
foreach ($tool in $schema.tools) {
  foreach ($field in @('content_origin','instruction_trust','isError','error_code','message','audit_id','retryable','next_cursor')) {
    if (@($tool.outputSchema.required) -notcontains $field) { $issues += "tool-schemas.json: $($tool.name) output required missing $field" }
  }
}
$exec004 = [System.IO.File]::ReadAllText((Join-Path $CardsDir 'EXEC-004-auth-policy-grant-store.md'), $utf8)
foreach ($field in @('explicit consent','consent_id','consent_actor','consent_at','re-consent')) {
  if (-not $exec004.Contains($field)) { $issues += "EXEC-004: missing explicit authorization field $field" }
}
$exec006 = [System.IO.File]::ReadAllText((Join-Path $CardsDir 'EXEC-006-repo-binding-snapshot-manifest.md'), $utf8)
if ($exec006.Contains('稳定 `snapshot_id`')) { $issues += "EXEC-006: snapshot_id stability contradicts immutable refresh semantics" }
if (-not ($exec006.Contains('snapshot refresh') -and $exec006.Contains('snapshot_id'))) { $issues += "EXEC-006: missing new snapshot_id on refresh requirement" }
$exec008 = [System.IO.File]::ReadAllText((Join-Path $CardsDir 'EXEC-008-read-only-tools.md'), $utf8)
if (-not $exec008.Contains('schema diff')) { $issues += "EXEC-008: missing schema diff validation requirement" }
$exec009Path = Join-Path $CardsDir 'EXEC-009-audit-evidence-log-privacy.md'
$exec009 = [System.IO.File]::ReadAllText($exec009Path, $utf8)
foreach ($field in @('retention_until','evidence_storage_path','tamper_check','retention_policy','redaction_profile')) {
  if (-not $exec009.Contains($field)) { $issues += "EXEC-009: missing evidence integrity field $field" }
}
foreach ($field in @('purge','retention_until','remaining blockers')) {
  if (-not $exec009.Contains($field)) { $issues += "EXEC-009: missing retention cleanup field $field" }
}
$exec010 = [System.IO.File]::ReadAllText((Join-Path $CardsDir 'EXEC-010-e2e-validation-chatgpt-connector.md'), $utf8)
foreach ($field in @('explicit consent','schema diff','re-consent','without consent')) {
  if (-not $exec010.Contains($field)) { $issues += "EXEC-010: missing e2e authorization/schema evidence field $field" }
}
foreach ($receipt in Get-ChildItem -LiteralPath $CardsDir -Filter '*.receipt.json' -ErrorAction SilentlyContinue) {
  $receiptText = [System.IO.File]::ReadAllText($receipt.FullName, $utf8)
  if ($receiptText -match '8-card|8 card|8-card decomposition') { $issues += "$($receipt.Name): stale 8-card receipt remains in active execution-cards directory" }
}
if ($issues.Count -gt 0) { Write-Output 'FAIL execution card validation'; $issues | ForEach-Object { Write-Output "- $_" }; exit 1 }
Write-Output 'PASS execution card validation'
Write-Output "cards=$($map.cards.Count)"
exit 0
