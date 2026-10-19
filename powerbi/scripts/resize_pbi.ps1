# Resizes the Power BI window WITHOUT activating it or changing z-order (so it stays behind the user's windows).
param([int]$W = 2600, [int]$H = 1700, [int]$X = 0, [int]$Y = 0)
Add-Type @"
using System; using System.Runtime.InteropServices;
public class WP { [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
                  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); }
"@
$p = Get-Process PBIDesktop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
[WP]::ShowWindow($p.MainWindowHandle, 4) | Out-Null   # SW_SHOWNOACTIVATE (un-maximise without focus)
# SWP_NOZORDER (0x4) | SWP_NOACTIVATE (0x10)
[WP]::SetWindowPos($p.MainWindowHandle, [IntPtr]::Zero, $X, $Y, $W, $H, 0x14) | Out-Null
"resized to ${W}x${H}"
