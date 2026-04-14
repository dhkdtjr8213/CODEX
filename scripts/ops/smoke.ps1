param(
  [switch]$WithEnv
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$tscCmd = Join-Path $repoRoot "node_modules/.bin/tsc.cmd"
$webEslintCmd = Join-Path $repoRoot "apps/web/node_modules/.bin/eslint.cmd"
$mobileEslintCmd = Join-Path $repoRoot "apps/mobile/node_modules/.bin/eslint.cmd"

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

function Run-Typecheck {
  param([string]$ProjectTsconfig)
  Write-Host "`$ $tscCmd -p $ProjectTsconfig --noEmit"
  & $tscCmd -p $ProjectTsconfig --noEmit
}

function Run-Eslint {
  param(
    [string]$EslintCmd,
    [string]$TargetDir
  )
  Write-Host "`$ $EslintCmd .    (cwd: $TargetDir)"
  Push-Location $TargetDir
  try {
    & $EslintCmd .
  }
  finally {
    Pop-Location
  }
}

if ($WithEnv) {
  Run-Step -Name "Environment validation" -Action {
    Write-Host "`$ node scripts/ops/validate-runtime-env.mjs"
    node (Join-Path $repoRoot "scripts/ops/validate-runtime-env.mjs")
  }
}
else {
  Write-Host "[skip] Environment validation disabled. Use -WithEnv to enable."
}

Run-Step -Name "Typecheck" -Action {
  Run-Typecheck -ProjectTsconfig (Join-Path $repoRoot "packages/types/tsconfig.json")
  Run-Typecheck -ProjectTsconfig (Join-Path $repoRoot "packages/config/tsconfig.json")
  Run-Typecheck -ProjectTsconfig (Join-Path $repoRoot "packages/ui/tsconfig.json")
  Run-Typecheck -ProjectTsconfig (Join-Path $repoRoot "packages/supabase/tsconfig.json")
  Run-Typecheck -ProjectTsconfig (Join-Path $repoRoot "apps/mobile/tsconfig.json")
  Run-Typecheck -ProjectTsconfig (Join-Path $repoRoot "apps/web/tsconfig.json")
}

Run-Step -Name "Lint" -Action {
  Run-Eslint -EslintCmd $mobileEslintCmd -TargetDir (Join-Path $repoRoot "apps/mobile")
  Run-Eslint -EslintCmd $webEslintCmd -TargetDir (Join-Path $repoRoot "apps/web")
}

Write-Host ""
Write-Host "Smoke test completed successfully."
