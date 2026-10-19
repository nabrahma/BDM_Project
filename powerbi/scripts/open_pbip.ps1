# Restarts Power BI Desktop (Store version) on the given .pbip file.
param([Parameter(Mandatory)][string]$Path)
Get-Process PBIDesktop -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
$exe = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\PBIDesktopStore.exe"
Start-Process -FilePath $exe -ArgumentList ('"' + $Path + '"')
"opening $Path"
