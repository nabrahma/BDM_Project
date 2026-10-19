# Debug helper: executes a TMSL file (built by scripts/debug_m.py) against the OPEN Desktop model,
# then prints EVALUATE zzDebug. The temporary table lives only in the running session.
param([Parameter(Mandatory)][string]$TmslFile, [switch]$NoQuery)
$pkg = (Get-AppxPackage *PowerBIDesktop*).InstallLocation
Add-Type -Path (Join-Path $pkg "bin\Microsoft.PowerBI.AdomdClient.dll")
$srv = Get-Process msmdsrv | Select-Object -First 1
$port = (Get-NetTCPConnection -OwningProcess $srv.Id -State Listen | Select-Object -First 1).LocalPort
$conn = New-Object Microsoft.AnalysisServices.AdomdClient.AdomdConnection("Data Source=localhost:$port"); $conn.Open()
$cmd0 = $conn.CreateCommand(); $cmd0.CommandText = 'SELECT [CATALOG_NAME] FROM $SYSTEM.DBSCHEMA_CATALOGS'
$r0 = $cmd0.ExecuteReader(); $r0.Read() | Out-Null; $db = $r0.GetString(0); $r0.Close(); $conn.ChangeDatabase($db)
function Exec($t) { $c = $conn.CreateCommand(); $c.CommandTimeout = 1800; $c.CommandText = $t; $c.ExecuteNonQuery() | Out-Null }
$cmds = (Get-Content -Raw -Encoding UTF8 $TmslFile).Replace('__DB__', $db) -split "(?m)^-----\s*$"
foreach ($t in $cmds) { if ($t.Trim()) { try { Exec $t } catch { if ($t -notmatch '"delete"') { "ERROR: " + $_.Exception.Message; exit 1 } } } }
if (-not $NoQuery) {
    $c = $conn.CreateCommand(); $c.CommandText = "EVALUATE zzDebug"; $rd = $c.ExecuteReader()
    while ($rd.Read()) { "$($rd.GetValue(0)) => $($rd.GetValue(1))" }
}
$conn.Close()
