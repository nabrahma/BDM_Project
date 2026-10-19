# Lists the visible top-level windows that belong to Power BI Desktop (to spot error dialogs).
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class EW { public delegate bool P(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(P p, IntPtr l);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 public static List<string> List(uint target){ var r=new List<string>(); EnumWindows((h,l)=>{ uint pid; GetWindowThreadProcessId(h,out pid); if(pid==target && IsWindowVisible(h)){ var sb=new StringBuilder(256); GetWindowText(h,sb,256); r.Add(h+" | "+sb);} return true;}, IntPtr.Zero); return r; } }
"@
Get-Process PBIDesktop -ErrorAction SilentlyContinue | ForEach-Object { [EW]::List([uint32]$_.Id) }
