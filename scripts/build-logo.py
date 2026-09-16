"""Bygger logotypfiler och appikoner från Alvins original (brand/logotyp-kuggfri.png,
vit/grön på svart). Kör: python scripts/build-logo.py

Skapar i public/:
  logo-dark.png       hela logotypen, vit text/kugghjul + grön bock, transparent (mörkt tema)
  logo-light.png      samma men text och kugghjul i mörk färg (ljust tema)
  logo-mark-dark.png  bara märket (kugghjul + bock), transparent, vitt
  logo-mark-light.png bara märket, mörkt
  logo-text-dark/light.png  bara ordmärket "Kuggfri" (sidhuvudet sätter ihop märke + ord med större ord)
  icon-192/512, icon-maskable-512, apple-touch-icon: märket på svart platta
"""
from PIL import Image, ImageDraw
import numpy as np

SRC = "brand/logotyp-kuggfri.png"
DARK_INK = (28, 28, 26)      # --fg i ljust tema (nästan svart)
PLATE = (0, 0, 0)            # ikonplatta, som originalet
T = 120.0                    # max-kanal >= T räknas som helt täckande


def load_rgba() -> Image.Image:
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    maxc = a.max(axis=2)
    alpha = np.clip(maxc / T, 0, 1)
    # Ta bort svart inblandning i kantpixlar (un-premultiply mot svart).
    safe = np.where(alpha > 0, alpha, 1)[..., None]
    rgb = np.clip(a / safe, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def bbox(alpha: np.ndarray, thresh: int = 8):
    ys, xs = np.where(alpha > thresh)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def split_mark_and_text(im: Image.Image):
    a = np.asarray(im)[..., 3]
    x0, y0, x1, y1 = bbox(a)
    cols = (a[y0:y1] > 8).any(axis=0)
    # Första tomma kolumnspannet efter märket (gapet mellan kugghjul och text).
    in_gap, gap_start = False, None
    for x in range(x0 + 1, x1):
        if not cols[x - 0] and not in_gap:
            in_gap, gap_start = True, x
        elif cols[x] and in_gap:
            if x - gap_start > 40:  # riktigt gap, inte kant mellan kuggar
                return (x0, y0, gap_start, y1), (x, y0, x1, y1)
            in_gap = False
    raise SystemExit("hittade inget gap mellan märke och text")


def recolor_light(im: Image.Image) -> Image.Image:
    """Vitt → mörkt bläck, utom bocken inne i den gröna cirkeln."""
    arr = np.asarray(im).astype(np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.where(maxc > 0, (maxc - minc) / np.maximum(maxc, 1), 0)
    whiteish = (sat < 0.25) & (a > 0)
    green = (sat >= 0.25) & (g > r) & (g > b) & (a > 0)
    # Cirkelns centrum och radie ur den gröna ytan (area-baserad radie är okänslig för strökantpixlar).
    ys, xs = np.where(green)
    if len(xs) == 0:  # ingen grön yta (t.ex. bara ordmärket): färga om allt vitt
        cx, cy, rad = -1.0, -1.0, 0.0
    else:
        cx, cy = xs.mean(), ys.mean()
        rad = np.sqrt(green.sum() / np.pi)
    yy, xx = np.mgrid[0 : arr.shape[0], 0 : arr.shape[1]]
    inside_circle = (xx - cx) ** 2 + (yy - cy) ** 2 <= (rad * 1.0) ** 2
    target = whiteish & ~inside_circle
    out = arr.copy()
    for i, v in enumerate(DARK_INK):
        out[..., i] = np.where(target, v, out[..., i])
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def fit_height(im: Image.Image, h: int) -> Image.Image:
    w = round(im.width * h / im.height)
    return im.resize((w, h), Image.LANCZOS)


def icon(mark: Image.Image, size: int, maskable: bool, flat: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = 0 if maskable else int(size * 0.22)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=PLATE + (255,))
    scale = 0.6 if maskable else 0.72
    m = mark.copy()
    m.thumbnail((int(size * scale), int(size * scale)), Image.LANCZOS)
    img.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    if flat:
        return img.convert("RGB")
    return img


def main() -> None:
    im = load_rgba()
    (mx0, my0, mx1, my1), (tx0, ty0, tx1, ty1) = split_mark_and_text(im)
    a = np.asarray(im)[..., 3]
    x0, y0, x1, y1 = bbox(a)
    pad = int((y1 - y0) * 0.04)
    full = im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    mark = im.crop((mx0 - pad, my0 - pad, mx1 + pad, my1 + pad))
    # Kvadratisk ram runt märket
    side = max(mark.width, mark.height)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    mark = sq

    # Ordmärkets egen höjd (split ger bara kolumnerna).
    _, ty0, _, ty1 = bbox(a[:, tx0:tx1])
    tpad = int((ty1 - ty0) * 0.06)
    text = im.crop((tx0 - tpad, ty0 - tpad, tx1 + tpad, ty1 + tpad))
    fit_height(text, 200).save("public/logo-text-dark.png", optimize=True)
    fit_height(recolor_light(text), 200).save("public/logo-text-light.png", optimize=True)
    fit_height(full, 200).save("public/logo-dark.png", optimize=True)
    fit_height(recolor_light(full), 200).save("public/logo-light.png", optimize=True)
    mark.resize((512, 512), Image.LANCZOS).save("public/logo-mark-dark.png", optimize=True)
    recolor_light(mark).resize((512, 512), Image.LANCZOS).save("public/logo-mark-light.png", optimize=True)

    icon(mark, 192, False, False).save("public/icon-192.png", optimize=True)
    icon(mark, 512, False, False).save("public/icon-512.png", optimize=True)
    icon(mark, 512, True, False).save("public/icon-maskable-512.png", optimize=True)
    icon(mark, 180, True, True).save("public/apple-touch-icon.png", optimize=True)
    # favicon.ico i app/ (Next serverar den som /favicon.ico)
    ico = icon(mark, 64, True, False)
    ico.save("app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print("logo:", full.size, "mark:", mark.size, "text-bbox:", (tx0, ty0, tx1, ty1))


if __name__ == "__main__":
    main()
