"""Genererar appikoner (PNG) till public/ från ett enkelt vektormotiv: två staplade kort på
Kuggfris gröna kontrastfärg. Körs med `python scripts/build-icons.py` (kräver Pillow).
Ikonerna används av manifestet (lägg till på hemskärmen) och som apple-touch-icon."""
from PIL import Image, ImageDraw

ACCENT = (31, 122, 77)      # --accent, #1f7a4d
CARD = (255, 255, 255)
CARD_BACK = (215, 236, 224)  # ljus grön, det bakre kortet


def draw_icon(size: int, maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Maskable: hela ytan färgad (systemet klipper själv). Vanlig: rundad platta.
    radius = 0 if maskable else int(size * 0.22)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=ACCENT)

    # Säker zon för maskable är de inre 80 %: håll motivet inom 62 % av bredden.
    scale = 0.62 if maskable else 0.68
    w = size * scale
    h = w * 0.68
    cx, cy = size / 2, size / 2
    r = int(w * 0.09)
    off = w * 0.09

    # Bakre kort, förskjutet upp/höger
    x0, y0 = cx - w / 2 + off, cy - h / 2 - off
    d.rounded_rectangle((x0, y0, x0 + w, y0 + h), radius=r, fill=CARD_BACK)
    # Främre kort
    x1, y1 = cx - w / 2, cy - h / 2 + off * 0.4
    d.rounded_rectangle((x1, y1, x1 + w, y1 + h), radius=r, fill=CARD)
    # Två "textrader" på främre kortet
    line_h = max(2, int(h * 0.09))
    pad = w * 0.14
    d.rounded_rectangle((x1 + pad, y1 + h * 0.34, x1 + w - pad, y1 + h * 0.34 + line_h), radius=line_h // 2, fill=ACCENT)
    d.rounded_rectangle((x1 + pad, y1 + h * 0.56, x1 + w * 0.62, y1 + h * 0.56 + line_h), radius=line_h // 2, fill=ACCENT)
    return img


def save(size: int, name: str, maskable: bool = False, supersample: int = 4) -> None:
    big = draw_icon(size * supersample, maskable)
    small = big.resize((size, size), Image.LANCZOS)
    if name == "apple-touch-icon.png":
        # iOS rundar själv och stöder inte transparens: fyll bakgrunden.
        flat = Image.new("RGB", (size, size), ACCENT)
        flat.paste(small, mask=small.split()[3])
        flat.save(f"public/{name}", optimize=True)
    else:
        small.save(f"public/{name}", optimize=True)
    print("skrev", name)


if __name__ == "__main__":
    save(192, "icon-192.png")
    save(512, "icon-512.png")
    save(512, "icon-maskable-512.png", maskable=True)
    save(180, "apple-touch-icon.png")
