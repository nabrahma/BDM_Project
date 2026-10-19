# Selects each report page tab via UI Automation (no mouse, no focus change) and captures the Power BI window.
param([string]$PageList, [string]$OutDir = "build\pages", [int]$WaitSec = 8)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
New-Item -ItemType Directory -Force $OutDir | Out-Null
$p = Get-Process PBIDesktop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
$root = [System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
$tabCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem)
foreach ($name in ($PageList -split ";")) {
    $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond)
    $tab = $null; foreach ($t in $tabs) { if ($t.Current.Name -eq $name -or $t.Current.Name -eq "Hidden $name") { $tab = $t; break } }
    if (-not $tab) { "tab not found: $name"; continue }
    $pat = $null
    if ($tab.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pat)) { $pat.Select() }
    elseif ($tab.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) { $pat.Invoke() }
    Start-Sleep -Seconds $WaitSec
    $file = Join-Path $OutDir (($name -replace '[^A-Za-z0-9]+', '_') + ".png")
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "screenshot.ps1") -Out $file | Out-Null
    "captured $name -> $file"
}
