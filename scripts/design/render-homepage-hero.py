#!/usr/bin/env python3
"""Deterministically render the homepage hero illustration for automation pipelines."""
from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WIDTH = 1440
HEIGHT = 960
PALETTE = {
    "navy_top": (9, 23, 48),
    "navy_bottom": (36, 12, 64),
    "overlay_start": (15, 44, 84),
    "overlay_end": (55, 16, 95),
    "panel": (22, 33, 66, 220),
    "cyan": (94, 234, 212),
    "magenta": (244, 114, 182),
    "amber": (252, 211, 77),
    "indigo": (129, 140, 248),
}


def lerp_color(color_a: tuple[int, ...], color_b: tuple[int, ...], t: float) -> tuple[int, ...]:
    """Interpolate between two RGB colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(color_a, color_b))


def paint_background() -> Image.Image:
    base = Image.new("RGB", (WIDTH, HEIGHT))
    pixels = base.load()
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        color = lerp_color(PALETTE["navy_top"], PALETTE["navy_bottom"], t)
        for x in range(WIDTH):
            pixels[x, y] = color

    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    overlay_pixels = overlay.load()
    for x in range(WIDTH):
        t = x / (WIDTH - 1)
        color = lerp_color(PALETTE["overlay_start"], PALETTE["overlay_end"], t)
        alpha = int(90 * (1 - abs(0.5 - t) * 2))
        for y in range(HEIGHT):
            overlay_pixels[x, y] = (*color, alpha)
    return Image.alpha_composite(base.convert("RGBA"), overlay)


def add_highlights(canvas: Image.Image) -> Image.Image:
    highlight = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(highlight)
    center = (int(WIDTH * 0.62), int(HEIGHT * 0.38))
    max_radius = int(WIDTH * 0.75)
    for radius in range(max_radius, 0, -12):
        alpha = int(255 * (1 - radius / max_radius) ** 2)
        bbox = [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius]
        draw.ellipse(bbox, fill=alpha)
    soft = highlight.filter(ImageFilter.GaussianBlur(180))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (110, 170, 255, 0))
    layer.putalpha(soft)
    return Image.alpha_composite(canvas, layer)


def add_grid(canvas: Image.Image) -> Image.Image:
    grid = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(grid)
    line_color = (255, 255, 255, 28)
    for x in range(0, WIDTH, 120):
        draw.line([(x, 0), (x, HEIGHT)], fill=line_color, width=1)
    for y in range(0, HEIGHT, 120):
        draw.line([(0, y), (WIDTH, y)], fill=line_color, width=1)
    grid = grid.filter(ImageFilter.GaussianBlur(1.2))
    return Image.alpha_composite(canvas, grid)


def add_panels(canvas: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    main_panel = [WIDTH * 0.2, HEIGHT * 0.18, WIDTH * 0.68, HEIGHT * 0.74]
    draw.rounded_rectangle(main_panel, radius=48, fill=PALETTE["panel"], outline=(146, 161, 255, 140), width=4)

    light_radius = 14
    for idx, color in enumerate([PALETTE["cyan"], PALETTE["magenta"], PALETTE["amber"]]):
        cx = main_panel[0] + 48 + idx * 46
        cy = main_panel[1] + 46
        draw.ellipse([cx - light_radius, cy - light_radius, cx + light_radius, cy + light_radius], fill=(*color, 220))

    nav_x = main_panel[0] + 48
    nav_top = main_panel[1] + 96
    for i in range(6):
        block_height = 48
        y0 = nav_top + i * (block_height + 18)
        y1 = y0 + block_height
        alpha = int(160 - i * 14)
        color = (*PALETTE["indigo"], alpha)
        draw.rounded_rectangle([nav_x, y0, nav_x + 220, y1], radius=14, fill=color)

    chart_left = nav_x + 260
    chart_top = main_panel[1] + 110
    chart_right = main_panel[2] - 64
    chart_bottom = main_panel[3] - 90
    bar_width = 42
    accents = [PALETTE["cyan"], PALETTE["magenta"], PALETTE["amber"], PALETTE["indigo"]]
    for row in range(3):
        baseline = chart_top + row * 160
        for col in range(7):
            value = math.sin((row + col / 2) * 0.7) * 0.3 + 0.6
            height_value = value * 120
            x0 = chart_left + col * (bar_width + 22)
            x1 = x0 + bar_width
            y0 = baseline - height_value
            y1 = baseline
            color = accents[(row + col) % len(accents)]
            draw.rounded_rectangle([x0, y0, x1, y1], radius=12, fill=(*color, 220))

    sparkline_points = []
    for idx in range(10):
        x = chart_left + idx * ((chart_right - chart_left) / 9)
        y = chart_bottom - 120 - math.cos(idx * 0.6) * 70
        sparkline_points.append((x, y))
    draw.line(sparkline_points, fill=(*PALETTE["cyan"], 200), width=6, joint="curve")
    for x, y in sparkline_points:
        draw.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(15, 255, 204, 230))

    float_cards = [
        (WIDTH * 0.74, HEIGHT * 0.24, WIDTH * 0.92, HEIGHT * 0.42, PALETTE["cyan"]),
        (WIDTH * 0.74, HEIGHT * 0.46, WIDTH * 0.94, HEIGHT * 0.62, PALETTE["magenta"]),
        (WIDTH * 0.70, HEIGHT * 0.66, WIDTH * 0.92, HEIGHT * 0.82, PALETTE["amber"]),
    ]
    for x0, y0, x1, y1, color in float_cards:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=36, fill=(18, 28, 58, 200), outline=(*color, 180), width=4)
        cx = x0 + 64
        cy = (y0 + y1) / 2
        draw.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=(*color, 210))
        draw.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(15, 18, 40, 255))
        draw.line([(cx + 48, cy - 18), (x1 - 36, cy - 18)], fill=(*color, 160), width=10)
        draw.line([(cx + 48, cy + 18), (x1 - 48, cy + 18)], fill=(220, 225, 255, 140), width=8)

    return Image.alpha_composite(canvas, layer)


def add_particles(canvas: Image.Image) -> Image.Image:
    particle_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(particle_layer)
    random.seed(42)
    options = [
        (*PALETTE["cyan"], 0),
        (*PALETTE["magenta"], 0),
        (180, 200, 255, 0),
    ]
    for _ in range(140):
        x = random.randint(0, WIDTH)
        y = random.randint(0, HEIGHT)
        r = random.randint(2, 5)
        alpha = random.randint(90, 160)
        base_color = random.choice(options)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=base_color[:3] + (alpha,))
    particle_layer = particle_layer.filter(ImageFilter.GaussianBlur(0.6))
    return Image.alpha_composite(canvas, particle_layer)


def add_vignette(canvas: Image.Image) -> Image.Image:
    vignette = Image.new("L", (WIDTH, HEIGHT), 0)
    ImageDraw.Draw(vignette).rectangle([0, 0, WIDTH, HEIGHT], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(180))
    layer = Image.new("RGBA", (WIDTH, HEIGHT), (5, 10, 30, 0))
    layer.putalpha(vignette)
    focus = Image.new("L", (WIDTH, HEIGHT), 0)
    ImageDraw.Draw(focus).ellipse([WIDTH * 0.2 - 160, HEIGHT * 0.18 - 120, WIDTH * 0.68 + 160, HEIGHT * 0.74 + 180], fill=220)
    focus = focus.filter(ImageFilter.GaussianBlur(120))
    focus_layer = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 0))
    focus_layer.putalpha(focus)
    result = Image.alpha_composite(canvas, layer)
    return Image.alpha_composite(result, focus_layer)


def render(destination: Path) -> None:
    canvas = paint_background()
    canvas = add_highlights(canvas)
    canvas = add_grid(canvas)
    canvas = add_panels(canvas)
    canvas = add_particles(canvas)
    canvas = add_vignette(canvas)
    final = canvas.convert("RGB")
    destination.parent.mkdir(parents=True, exist_ok=True)
    final.save(destination, optimize=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render the homepage hero illustration deterministically.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/assets/homepage/hero-base.png"),
        help="Path where the PNG should be written.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    render(args.output)
    print(f"[hero-render] wrote {args.output.relative_to(Path.cwd()) if args.output.is_absolute() else args.output}")


if __name__ == "__main__":
    main()
