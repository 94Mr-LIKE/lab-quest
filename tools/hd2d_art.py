"""高品質 2D 樣本：把 GPT 的分層素材處理成遊戲用圖，並產生地面高度圖。

用法：python3 tools/hd2d_art.py <原圖資料夾>
需要的原圖：hd_L0_sky.png hd_L1_village.png hd_L2_ruins.png hd_L3_ground.png hd_L4_fore.png hd_kid.png hd_props.png
輸出：prototype/hd2d/art/*.png|jpg 與 manifest.js
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "prototype", "hd2d", "art")
sys.path.insert(0, os.path.join(ROOT, "tools"))
from cut_art import key_magenta  # 同一套洋紅去背


def despill(rgba, fade_bottom=0.0):
    """去掉洋紅殘邊：所有偏洋紅的顏色拉回、邊緣收 1 像素；可選擇底部漸隱。"""
    rgb = rgba[..., :3].astype(np.float32); a = rgba[..., 3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    k = np.clip(np.minimum(r, b) - g - 8, 0, None)
    a = a * np.clip(1 - (k - 40) / 90, 0, 1)            # 很洋紅的半透明邊：直接變透明
    rgb[..., 0] = r - k; rgb[..., 2] = b - k
    a = ndimage.grey_erosion(a, size=(3, 3))
    if fade_bottom:
        H = a.shape[0]; n = int(H * fade_bottom)
        a[H - n:] *= np.linspace(1, 0, n)[:, None]
    return np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)


def save_rgba(arr, name):
    Image.fromarray(arr).quantize(colors=256, method=Image.Quantize.FASTOCTREE,
                                  dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(OUT, name + ".png"), optimize=True)


def layer(src, name, man, fade=0.0):
    """整張保留原尺寸（位置不變），只把洋紅變透明。"""
    rgba = despill(key_magenta(Image.open(src)), fade)
    rgba[..., 3] = np.where(rgba[..., 3] < 12, 0, rgba[..., 3])
    save_rgba(rgba, name)
    man[name] = {"w": rgba.shape[1], "h": rgba.shape[0]}
    return rgba


def sheet(src, names, man):
    rgba = despill(key_magenta(Image.open(src)))
    solid = rgba[..., 3] > 128
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=8))
    H, W = solid.shape
    boxes = [(sl[0].start, sl[0].stop, sl[1].start, sl[1].stop) for i, sl in enumerate(ndimage.find_objects(lab))
             if (lab[sl] == i + 1).sum() > H * W * 0.003]
    boxes.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[1]) / 2 > max(c[1] for c in cur):
            rows.append(cur); cur = []
        cur.append(b)
    rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
    if len(ordered) != len(names):
        sys.exit(f"{os.path.basename(src)}：找到 {len(ordered)} 個物件，需要 {len(names)} 個")
    for (y0, y1, x0, x1), nm in zip(ordered, names):
        c = rgba[y0:y1, x0:x1].copy()
        ys, xs = np.where(c[..., 3] > 8)
        c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        # 腳底（最下面不透明的列）位置，給角色對齊地面用
        save_rgba(c, nm)
        man[nm] = {"w": int(c.shape[1]), "h": int(c.shape[0])}
        print(f"  {nm}: {c.shape[1]}×{c.shape[0]}")


def heightmap(rgba, step=4):
    """每 step 個像素一欄，找地面最上緣（忽略細草：取欄內不透明比例＞60% 的第一列）。"""
    a = rgba[..., 3] > 128
    H, W = a.shape
    hs = []
    for x in range(0, W, step):
        col = a[:, x:x + step].mean(axis=1) > 0.6
        # 往下連續 12 列都是實心才算地面
        run = np.convolve(col.astype(int), np.ones(12, int), "valid") == 12
        idx = np.argmax(run) if run.any() else H
        hs.append(int(idx))
    hs = ndimage.median_filter(np.array(hs), size=7)
    return [int(v) for v in hs]


if __name__ == "__main__":
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    man = {}
    sky = Image.open(os.path.join(src, "hd_L0_sky.png")).convert("RGB")
    sky.save(os.path.join(OUT, "L0_sky.jpg"), quality=86, optimize=True)
    man["L0_sky"] = {"w": sky.width, "h": sky.height, "jpg": True}
    for f, n, fd in [("hd_L1_village", "L1_village", 0.08), ("hd_L2_ruins", "L2_ruins", 0.10), ("hd_L4_fore", "L4_fore", 0.0)]:
        layer(os.path.join(src, f + ".png"), n, man, fd)
    g = layer(os.path.join(src, "hd_L3_ground.png"), "L3_ground", man)
    man["L3_ground"]["height"] = heightmap(g)
    man["L3_ground"]["step"] = 4
    sheet(os.path.join(src, "hd_kid.png"), ["kid_idle", "kid_walk1", "kid_walk2", "kid_walk3", "kid_push", "kid_pull", "kid_crouch", "kid_look"], man)
    sheet(os.path.join(src, "hd_props.png"), ["wheel", "plank", "panel", "crate"], man)
    with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("// 由 tools/hd2d_art.py 產生\nwindow.HD_ART = " + json.dumps(man, ensure_ascii=False) + ";\n")
    print("ok")
