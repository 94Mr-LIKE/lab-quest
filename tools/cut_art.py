"""把 GPT 畫的洋紅底素材表去背、切成一張張透明 PNG，並更新 art/manifest.js。

用法：
  python3 tools/cut_art.py 原圖.png 名稱1,名稱2,...        # 洋紅底素材表：依「由上到下、由左到右」順序命名
  python3 tools/cut_art.py 原圖.png bg_river --bg          # 背景圖：不去背，縮成寬 1600
輸出：prototype/village/art/<名稱>.png，並把尺寸寫進 prototype/village/art/manifest.js
"""
import json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "prototype", "village", "art")
MAN = os.path.join(OUT, "manifest.js")


def load_manifest():
    if not os.path.exists(MAN):
        return {}
    txt = open(MAN, encoding="utf-8").read()
    m = re.search(r"=\s*(\{.*\})\s*;", txt, re.S)
    return json.loads(m.group(1)) if m else {}


def save_manifest(man):
    os.makedirs(OUT, exist_ok=True)
    with open(MAN, "w", encoding="utf-8") as f:
        f.write("// 由 tools/cut_art.py 自動產生：可用的美術素材與原始像素尺寸\n")
        f.write("window.VILLAGE_ART = " + json.dumps(man, ensure_ascii=False, indent=1, sort_keys=True) + ";\n")


def key_magenta(img):
    im = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mag = np.minimum(r, b) - g                       # 越接近純洋紅越大
    alpha = np.clip((190 - mag) / 110, 0, 1)
    k = np.clip(mag - 25, 0, None) * (alpha < 1)     # 邊緣去洋紅色偏
    rgb = im.copy()
    rgb[..., 0] = np.clip(r - k * 0.9, 0, 255)
    rgb[..., 2] = np.clip(b - k * 0.9, 0, 255)
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def cut_sheet(path, names):
    rgba = key_magenta(Image.open(path))
    solid = rgba[..., 3] > 128
    merged = ndimage.binary_dilation(solid, iterations=6)   # 把同一個物件分開的小塊黏起來
    lab, n = ndimage.label(merged)
    objs = ndimage.find_objects(lab)
    H, W = solid.shape
    boxes = []
    for i, sl in enumerate(objs):
        area = (lab[sl] == i + 1).sum()
        if area < H * W * 0.002:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        boxes.append((y0, y1, x0, x1))
    # 先依列分組（垂直中心相近的算同一列），再由左到右
    boxes.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[1]) / 2 > max(c[1] for c in cur):
            rows.append(cur); cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    ordered = [b for row in rows for b in sorted(row, key=lambda b: b[2])]
    if len(ordered) != len(names):
        sys.exit(f"找到 {len(ordered)} 個物件，但給了 {len(names)} 個名稱：請檢查原圖（物件要分開、背景要純洋紅）")
    man = load_manifest()
    os.makedirs(OUT, exist_ok=True)
    for (y0, y1, x0, x1), name in zip(ordered, names):
        crop = rgba[y0:y1, x0:x1].copy()
        a = crop[..., 3] > 8                      # 去掉膨脹帶進來的空白
        ys, xs = np.where(a)
        crop = crop[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        # 256 色量化：畫面幾乎看不出差別，檔案小約 80%（手機載入快）
        Image.fromarray(crop).quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(OUT, name + ".png"), optimize=True)
        man[name] = {"w": int(crop.shape[1]), "h": int(crop.shape[0])}
        print(f"  {name}: {crop.shape[1]}×{crop.shape[0]}")
    save_manifest(man)


def copy_bg(path, name):
    img = Image.open(path).convert("RGB")
    if img.width > 1600:
        img = img.resize((1600, round(img.height * 1600 / img.width)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, name + ".jpg"), quality=85, optimize=True)
    man = load_manifest(); man[name] = {"w": img.width, "h": img.height, "jpg": True}; save_manifest(man)
    print(f"  {name}: {img.width}×{img.height}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    src, names = sys.argv[1], [s.strip() for s in sys.argv[2].split(",") if s.strip()]
    if "--bg" in sys.argv:
        copy_bg(src, names[0])
    else:
        cut_sheet(src, names)
