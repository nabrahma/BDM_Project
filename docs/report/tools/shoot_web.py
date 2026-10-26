"""Screenshot pages of the running web app in real time via Edge's DevTools protocol (charts finish animating).

Usage:  .venv/Scripts/python -I docs/report/tools/shoot_web.py <base_url> <out_dir> name:/path [name:/path ...]
"""
import base64, json, os, subprocess, sys, time, urllib.request
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
base, out = sys.argv[1], sys.argv[2]
pages = [a.split(":", 1) for a in sys.argv[3:]]
profile = os.path.abspath(".tools/edge-cdp-profile")
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9333",
                         f"--user-data-dir={profile}", "--window-size=1440,1000", "about:blank"])
try:
    for _ in range(50):
        try:
            tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9333/json")); break
        except Exception:
            time.sleep(0.3)
    ws = websocket.create_connection(next(t for t in tabs if t["type"] == "page")["webSocketDebuggerUrl"], timeout=60)
    n = [0]
    def call(method, **params):
        n[0] += 1; ws.send(json.dumps({"id": n[0], "method": method, "params": params}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == n[0]: return m.get("result", {})
    call("Emulation.setDeviceMetricsOverride", width=int(os.environ.get("SHOT_WIDTH", "1440")), height=1000, deviceScaleFactor=1, mobile=False)
    for name, path in pages:
        call("Page.navigate", url=base + path)
        time.sleep(float(os.environ.get("SHOT_WAIT", "7")))  # data fetch + chart animations
        h = call("Runtime.evaluate", expression="document.documentElement.scrollHeight", returnByValue=True)["result"]["value"]
        call("Emulation.setDeviceMetricsOverride", width=int(os.environ.get("SHOT_WIDTH", "1440")), height=min(int(h), 2400), deviceScaleFactor=1, mobile=False)
        time.sleep(1.5)
        img = call("Page.captureScreenshot", format="png")["data"]
        open(os.path.join(out, f"{name}.png"), "wb").write(base64.b64decode(img))
        call("Emulation.setDeviceMetricsOverride", width=int(os.environ.get("SHOT_WIDTH", "1440")), height=1000, deviceScaleFactor=1, mobile=False)
        print("saved", name, h)
finally:
    proc.terminate()
