"""Statische PDF-Schriften: tabellarische Ziffern einfrieren, auf Latein zuschneiden.

Aufruf vom Repo-Stamm: py -3 scripts/fonts/build.py
Braucht fonttools und opentype-feature-freezer (lokal, nicht im App-Bundle).
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NODE = ROOT / "frontend" / "node_modules" / "@expo-google-fonts"
OUT = ROOT / "frontend" / "src" / "pdf" / "fonts"

SOURCES = {
    "PlusJakartaSans-SemiBold.ttf": NODE / "plus-jakarta-sans" / "600SemiBold" / "PlusJakartaSans_600SemiBold.ttf",
    "Inter-Regular.ttf": NODE / "inter" / "400Regular" / "Inter_400Regular.ttf",
    "Inter-Medium.ttf": NODE / "inter" / "500Medium" / "Inter_500Medium.ttf",
    "Inter-SemiBold.ttf": NODE / "inter" / "600SemiBold" / "Inter_600SemiBold.ttf",
}

UNICODES = ",".join(
    [
        "U+0020-007E",
        "U+00A0-00FF",
        "U+0100-017F",
        "U+2010-2015",
        "U+2018-201F",
        "U+2022",
        "U+2026",
        "U+20AC",
        "U+25B2",
        "U+2713",
    ]
)

FREEZE = {"Inter-Regular.ttf", "Inter-Medium.ttf", "Inter-SemiBold.ttf"}


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES.items():
        if not src.is_file():
            raise SystemExit(f"Quelle fehlt: {src}")
        current = src
        with tempfile.TemporaryDirectory() as tmp:
            frozen = Path(tmp) / "frozen.ttf"
            if name in FREEZE:
                run(
                    [
                        sys.executable,
                        "-m",
                        "opentype_feature_freezer.cli",
                        "-f",
                        "tnum",
                        str(current),
                        str(frozen),
                    ]
                )
                current = frozen
            dest = OUT / name
            run(
                [
                    sys.executable,
                    "-m",
                    "fontTools.subset",
                    str(current),
                    f"--output-file={dest}",
                    f"--unicodes={UNICODES}",
                    "--layout-features=kern,tnum",
                    "--no-hinting",
                    "--desubroutinize",
                    "--glyph-names",
                    "--symbol-cmap",
                    "--legacy-cmap",
                    "--notdef-glyph",
                    "--notdef-outline",
                    "--recommended-glyphs",
                    "--name-IDs=*",
                ]
            )
        size = dest.stat().st_size
        print(f"{name}: {size} Bytes")
        if size > 60 * 1024:
            print(f"Hinweis: {name} ist größer als 60 kB", file=sys.stderr)


if __name__ == "__main__":
    main()
