# Exports the open model's tables to CSV (one file per "-- name:" block of export_processed.dax).
#   powershell -File scripts/export_processed.ps1 -OutDir ..\data\processed
# Needs Power BI Desktop open on IPL_Auction_Value.pbip. Run with Windows PowerShell 5.1 (powershell.exe).
param([string]$OutDir = (Join-Path $PSScriptRoot "..\..\data\processed"), [string]$DaxFile = (Join-Path $PSScriptRoot "export_processed.dax"))
$ErrorActionPreference = "Stop"

$pkg = (Get-AppxPackage *PowerBIDesktop*).InstallLocation
Add-Type -Path (Join-Path $pkg "bin\Microsoft.PowerBI.AdomdClient.dll")
$srv = Get-Process msmdsrv -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $srv) { throw "Power BI Desktop engine (msmdsrv) is not running" }
$port = (Get-NetTCPConnection -OwningProcess $srv.Id -State Listen | Where-Object { $_.LocalAddress -in @('127.0.0.1', '::1', '0.0.0.0', '::') } | Select-Object -First 1).LocalPort
$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection("Data Source=localhost:$port")
$conn.Open()
$cmd0 = $conn.CreateCommand(); $cmd0.CommandText = 'SELECT [CATALOG_NAME] FROM $SYSTEM.DBSCHEMA_CATALOGS'
$r0 = $cmd0.ExecuteReader(); $r0.Read() | Out-Null; $db = $r0.GetString(0); $r0.Close(); $conn.ChangeDatabase($db)

New-Item -ItemType Directory -Force $OutDir | Out-Null
$inv = [Globalization.CultureInfo]::InvariantCulture
function Fmt($v) {
    if ($v -is [DBNull] -or $null -eq $v) { return '' }
    if ($v -is [double] -or $v -is [decimal]) { return ([math]::Round([double]$v, 4)).ToString($inv) }
    if ($v -is [datetime]) { return $v.ToString('yyyy-MM-dd', $inv) }
    $s = [Convert]::ToString($v, $inv)
    if ($s -match '[",\r\n]') { $s = '"' + $s.Replace('"', '""') + '"' }
    return $s
}

$text = Get-Content -Raw -Encoding UTF8 $DaxFile
foreach ($m in [regex]::Matches($text, '(?ms)^-- name: (\w+)\s*$(.*?)(?=^-- name: |\z)')) {
    $name = $m.Groups[1].Value
    $cmd = $conn.CreateCommand(); $cmd.CommandTimeout = 600; $cmd.CommandText = $m.Groups[2].Value
    $rd = $cmd.ExecuteReader()
    $lines = New-Object System.Collections.Generic.List[string]
    $cols = @(); for ($i = 0; $i -lt $rd.FieldCount; $i++) { $cols += ($rd.GetName($i) -replace '^.*\[(.*)\]$', '$1') }
    $lines.Add(($cols -join ','))
    while ($rd.Read()) {
        $vals = @(); for ($i = 0; $i -lt $rd.FieldCount; $i++) { $vals += (Fmt $rd.GetValue($i)) }
        $lines.Add(($vals -join ','))
    }
    $rd.Close()
    [IO.File]::WriteAllLines((Join-Path $OutDir "$name.csv"), $lines, (New-Object Text.UTF8Encoding($false)))
    "{0,-16} {1,6} rows" -f $name, ($lines.Count - 1)
}
$conn.Close()
