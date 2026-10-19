"""Draws the page background: warm off-white with a soft yellow glow (bottom-right) and a faint one (top-right)."""
import sys
import numpy as np
from PIL import Image

W, H = 2560, 1440
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
base = np.array([246, 244, 239], np.float32)            # warm off-white
glow = np.array([248, 226, 140], np.float32)            # soft yellow


def blob(cx, cy, rx, ry, strength):
    d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    return strength * np.exp(-d)


a = np.clip(blob(W * 0.95, H * 1.05, W * 0.55, H * 0.60, 0.85) + blob(W * 0.80, -H * 0.05, W * 0.35, H * 0.35, 0.25)
            + blob(W * 0.05, H * 1.1, W * 0.30, H * 0.30, 0.20), 0, 1)[..., None]
img = base * (1 - a) + glow * a
Image.fromarray(img.astype(np.uint8)).save(sys.argv[1], optimize=True)
print("saved", sys.argv[1])
