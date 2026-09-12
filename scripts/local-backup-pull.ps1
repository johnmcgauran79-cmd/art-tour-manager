<#
Pull the newest ART Admin backups (database, uploaded files, source code) from
the private Supabase storage bucket onto a local or external drive.

Usage (PowerShell):
  $env:SUPABASE_SERVICE_ROLE_KEY = "...service role key..."
  .\scripts\local-backup-pull.ps1 -Destination "D:\ART-Backups" -KeepDays 90

Creates <Destination>\<date>\ containing the rejoined archives.
#>
param(
  [Parameter(Mandatory = $true)][string]$Destination,
  [int]$KeepDays = 0
)

$ErrorActionPreference = "Stop"
$ProjectUrl = "https://upqvgtuxfzsrwjahklij.supabase.co"
$Bucket = "database-backups"
$Key = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $Key) {
  throw "Set SUPABASE_SERVICE_ROLE_KEY first (Supabase > Project Settings > API)."
}

function Get-Names([string]$Prefix) {
  $body = @{ prefix = $Prefix; limit = 1000 } | ConvertTo-Json
  $resp = Invoke-RestMethod -Method Post -Uri "$ProjectUrl/storage/v1/object/list/$Bucket" `
    -Headers @{ Authorization = "Bearer $Key" } -ContentType "application/json" -Body $body
  return @($resp | ForEach-Object { $_.name } | Sort-Object)
}

foreach ($kind in @("database", "storage", "code")) {
  $folders = Get-Names "$kind/"
  if ($folders.Count -eq 0) { Write-Host "No $kind backup found yet - skipping."; continue }
  $latest = $folders[-1]
  Write-Host "== $kind backup $latest"

  $out = Join-Path $Destination $latest
  New-Item -ItemType Directory -Force -Path $out | Out-Null

  $parts = Get-Names "$kind/$latest/"
  if ($parts.Count -eq 0) { Write-Host "  (folder is empty)"; continue }

  $tmp = Join-Path $env:TEMP ("art-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $base = $null
  foreach ($p in $parts) {
    Write-Host "  downloading $p"
    Invoke-WebRequest -Uri "$ProjectUrl/storage/v1/object/$Bucket/$kind/$latest/$p" `
      -Headers @{ Authorization = "Bearer $Key" } -OutFile (Join-Path $tmp $p)
    $base = ($p -replace '\.part-\d+$', '')
  }

  $target = Join-Path $out $base
  $chunks = Get-ChildItem $tmp | Sort-Object Name
  if ($chunks.Count -gt 1 -or $chunks[0].Name -ne $base) {
    if (Test-Path $target) { Remove-Item $target }
    $stream = [System.IO.File]::Create($target)
    foreach ($c in $chunks) {
      $bytes = [System.IO.File]::ReadAllBytes($c.FullName)
      $stream.Write($bytes, 0, $bytes.Length)
    }
    $stream.Close()
  } else {
    Move-Item $chunks[0].FullName $target -Force
  }
  Remove-Item $tmp -Recurse -Force

  $mb = [math]::Round((Get-Item $target).Length / 1MB, 1)
  Write-Host "  saved $target ($mb MB)"

  if ($base -like "*.bundle") {
    if (Get-Command git -ErrorAction SilentlyContinue) {
      git bundle verify $target | Out-Null
      if ($LASTEXITCODE -eq 0) { Write-Host "  code bundle verified OK" }
      else { Write-Warning "  code bundle failed verification" }
    }
  }
}

if ($KeepDays -gt 0) {
  Write-Host "Removing local backup folders older than $KeepDays days..."
  Get-ChildItem $Destination -Directory |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Recurse -Force
}

Write-Host "Done. Local copies are in $Destination"
