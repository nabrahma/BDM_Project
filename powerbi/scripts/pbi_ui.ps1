# Minimal UI Automation helper for Power BI Desktop (used for Save As .pbix and Export to PDF).
#   -List [-Depth n]            print the named UI elements of the Power BI window
#   -Invoke "<name>"            invoke (click) the first element with that exact name
param([switch]$List, [int]$Depth = 6, [string]$Invoke, [string]$Filter = "", [string]$Near, [string]$NearTarget = "Close")
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$p = Get-Process PBIDesktop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
$root = [System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
function Walk($el, $d) {
    if ($d -gt $Depth) { return }
    $kids = $el.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($k in $kids) {
        $n = $k.Current.Name; $t = $k.Current.ControlType.ProgrammaticName
        if ($n -and ($Filter -eq "" -or $n -match $Filter)) { ("  " * $d) + "$t | $n" }
        Walk $k ($d + 1)
    }
}
if ($List) { Walk $root 0 }
if ($Invoke) {
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Invoke)
    $el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if (-not $el) { "not found: $Invoke"; exit 1 }
    $pat = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) { $pat.Invoke(); "invoked: $Invoke" }
    elseif ($el.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pat)) { $pat.Select(); "selected: $Invoke" }
    else { "no invoke pattern: $Invoke"; exit 1 }
}
# -Near "<anchor>" -Invoke "<name>": invoke the element named <name> inside the same parent as <anchor>
if ($Near) {
    $ac = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Near)
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $anchors = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $ac)
    foreach ($a in $anchors) {
        $parent = $walker.GetParent($a)
        $nc = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $NearTarget)
        $t = $parent.FindFirst([System.Windows.Automation.TreeScope]::Children, $nc)
        if ($t) { $pat = $null; if ($t.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) { $pat.Invoke(); "invoked $NearTarget next to $Near" } }
    }
}
