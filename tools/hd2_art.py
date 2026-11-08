"""HD-2D 樣本：把 GPT 的三張素材表處理成遊戲用圖。

用法：python3 tools/hd2_art.py <原圖資料夾>
需要：hd2_tex.png（6 材質）、hd2_kid.png（9 姿勢）、hd2_deco.png（12 裝飾）
輸出：prototype/hd2/art/*.png|jpg 與 manifest.js
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "prototype", "hd2", "art")
sys.path.insert(0, os.path.join(ROOT, "tools"))
from cut_art import key_magenta
from hd2d_art import despill


def boxes_of(rgba, n_expect, dil=8):
    solid = rgba[..., 3] > 128
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=dil))
    H, W = solid.shape
    bx = [(sl[0].start, sl[0].stop, sl[1].start, sl[1].stop) for i, sl in enumerate(ndimage.find_objects(lab))
          if (lab[sl] == i + 1).sum() > H * W * 0.002]
    bx.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in bx:
        if cur and (b[0] + b[1]) / 2 > max(c[1] for c in cur):
            rows.append(cur); cur = []
        cur.append(b)
    rows.append(cur)
    out = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
    if len(out) != n_expect:
        sys.exit(f"找到 {len(out)} 個物件，需要 {n_expect} 個")
    return out


def save_sprite(c, name, man):
    ys, xs = np.where(c[..., 3] > 8)
    c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(c).quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(os.path.join(OUT, name + ".png"), optimize=True)
    man[name] = {"w": int(c.shape[1]), "h": int(c.shape[0])}
    print(f"  {name}: {c.shape[1]}×{c.shape[0]}")


def make_tileable(img):
    """邊緣改用位移半格的版本、中間保留原圖，接縫消失。"""
    a = np.asarray(img).astype(np.float32)
    H, W = a.shape[:2]
    r = np.roll(np.roll(a, H // 2, 0), W // 2, 1)
    u = np.sin(np.pi * (np.arange(W) + 0.5) / W)[None, :]
    v = np.sin(np.pi * (np.arange(H) + 0.5) / H)[:, None]
    w = np.clip((u * v) ** 0.6 * 1.6, 0, 1)[..., None]
    return Image.fromarray(np.clip(a * w + r * (1 - w), 0, 255).astype(np.uint8))


if __name__ == "__main__":
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    man = {}
    # 材質：裁掉邊 4%（避免洋紅縫），縮成 512，做成可無縫拼貼
    rgba = key_magenta(Image.open(os.path.join(src, "hd2_tex.png")))
    for (y0, y1, x0, x1), nm in zip(boxes_of(rgba, 6, dil=2), ["grass", "dirt", "wall", "cobble", "wood", "metal"]):
        c = rgba[y0:y1, x0:x1, :3]
        m = int(min(c.shape[:2]) * 0.04)
        c = c[m:-m, m:-m]
        im = make_tileable(Image.fromarray(c).resize((512, 512), Image.LANCZOS))
        im.save(os.path.join(OUT, "tex_" + nm + ".jpg"), quality=88, optimize=True)
        man["tex_" + nm] = {"w": 512, "h": 512, "jpg": True}
        print("  tex_" + nm)
    rgba = despill(key_magenta(Image.open(os.path.join(src, "hd2_kid.png"))))
    names = ["kid_down_idle", "kid_down_a", "kid_down_b", "kid_up_idle", "kid_up_a", "kid_up_b", "kid_side_idle", "kid_side_a", "kid_side_b"]
    for (y0, y1, x0, x1), nm in zip(boxes_of(rgba, 9), names):
        save_sprite(rgba[y0:y1, x0:x1].copy(), nm, man)
    rgba = despill(key_magenta(Image.open(os.path.join(src, "hd2_deco.png"))))
    names = ["fern", "bush", "grass", "flowers", "tree", "vines", "rock", "fence", "lantern", "barrel", "crates", "tablet"]
    for (y0, y1, x0, x1), nm in zip(boxes_of(rgba, 12), names):
        save_sprite(rgba[y0:y1, x0:x1].copy(), "deco_" + nm, man)
    with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("// 由 tools/hd2_art.py 產生\nwindow.HD2_ART = " + json.dumps(man, ensure_ascii=False) + ";\n")
    print("ok")
