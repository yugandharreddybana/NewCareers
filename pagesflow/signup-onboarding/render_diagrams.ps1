# Render all .mmd diagrams in ./diagrams/ to PNG via @mermaid-js/mermaid-cli.
$ErrorActionPreference = "Stop"
$DiagramsDir = Join-Path $PSScriptRoot "diagrams"
$files = Get-ChildItem -Path $DiagramsDir -Filter "*.mmd"
if ($files.Count -eq 0) {
    Write-Error "No .mmd files found in $DiagramsDir"
}
foreach ($f in $files) {
    $out = Join-Path $DiagramsDir ($f.BaseName + ".png")
    Write-Host "Rendering $($f.Name) -> $($f.BaseName).png"
    npx --yes @mermaid-js/mermaid-cli -i $f.FullName -o $out -b transparent -w 1400
}
Write-Host "Done. Rendered $($files.Count) diagrams."
