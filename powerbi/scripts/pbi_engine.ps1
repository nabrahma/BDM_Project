# Talks to the Analysis Services engine that Power BI Desktop runs locally.
#   -Refresh            full refresh of the open model (TMSL), prints any errors
#   -Query "<DAX>"      runs a DAX query and prints the rows as CSV
#   -QueryFile <path>   same, reading the DAX from a file (EVALUATE blocks separated by a line '-- next')
# Run with Windows PowerShell 5.1 (powershell.exe): the ADOMD client shipped with Desktop targets .NET Framework.
param([switch]$Refresh, [string[]]$Tables, [string]$Query, [string]$QueryFile, [int]$TimeoutSec = 1800)

$pkg = (Get-AppxPackage *PowerBIDesktop*).InstallLocation
Add-Type -Path (Join-Path $pkg "bin\Microsoft.PowerBI.AdomdClient.dll")

$srv = Get-Process msmdsrv -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $srv) { throw "Power BI Desktop engine (msmdsrv) is not running" }
$port = (Get-NetTCPConnection -OwningProcess $srv.Id -State Listen | Where-Object { $_.LocalAddress -in @('127.0.0.1', '::1', '0.0.0.0', '::') } | Select-Object -First 1).LocalPort
$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection("Data Source=localhost:$port")
$conn.Open()
$db = $conn.Database
if (-not $db) {
    $cmd0 = $conn.CreateCommand(); $cmd0.CommandText = 'SELECT [CATALOG_NAME] FROM $SYSTEM.DBSCHEMA_CATALOGS'
    $r0 = $cmd0.ExecuteReader(); $r0.Read() | Out-Null; $db = $r0.GetString(0); $r0.Close()
    $conn.ChangeDatabase($db)
}
Write-Host "connected: localhost:$port db=$db"

function Run-Dax([string]$dax) {
    $cmd = $conn.CreateCommand(); $cmd.CommandTimeout = $TimeoutSec; $cmd.CommandText = $dax
    $rd = $cmd.ExecuteReader()
    do {
        $names = @(); for ($i = 0; $i -lt $rd.FieldCount; $i++) { $names += $rd.GetName($i) }
        ($names -join ',')
        while ($rd.Read()) {
            $vals = @(); for ($i = 0; $i -lt $rd.FieldCount; $i++) { $v = $rd.GetValue($i); if ($v -is [double]) { $v = [math]::Round($v, 4) }; $vals += "$v" }
            ($vals -join ',')
        }
        '---'
    } while ($rd.NextResult())
    $rd.Close()
}

if ($Refresh) {
    if ($Tables) {
        $objs = ($Tables | ForEach-Object { '{"database":"' + $db + '","table":"' + $_ + '"}' }) -join ','
    } else { $objs = '{"database":"' + $db + '"}' }
    $tmsl = '{"refresh":{"type":"full","objects":[' + $objs + ']}}'
    $cmd = $conn.CreateCommand(); $cmd.CommandTimeout = $TimeoutSec; $cmd.CommandText = $tmsl
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try { $cmd.ExecuteNonQuery() | Out-Null; Write-Host ("refresh OK in {0:n0}s" -f $sw.Elapsed.TotalSeconds) }
    catch { Write-Host ("refresh FAILED after {0:n0}s" -f $sw.Elapsed.TotalSeconds); Write-Host $_.Exception.Message }
}
if ($Query) { Run-Dax $Query }
if ($QueryFile) {
    $text = Get-Content -Raw -Encoding UTF8 $QueryFile
    foreach ($block in ($text -split "(?m)^-- next\s*$")) {
        if ($block.Trim()) { try { Run-Dax $block } catch { "QUERY ERROR: " + $_.Exception.Message; '---' } }
    }
}
$conn.Close()
