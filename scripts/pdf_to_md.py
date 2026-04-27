#!/usr/bin/env python3
"""
Convierte un PDF a Markdown estructurado usando pymupdf4llm.
Detecta headings por tamaño de fuente y conserva listas, tablas, etc.

Uso: pdf_to_md.py <ruta_pdf>
Stdout: markdown
"""
import re
import sys

PICTURE_PLACEHOLDER = re.compile(
    r'^[\s*_]*==>\s*picture\s*\[[^\]]*\]\s*intentionally omitted\s*<==[\s*_]*$\n?',
    re.MULTILINE,
)

def clean(md: str) -> str:
    md = PICTURE_PLACEHOLDER.sub('', md)
    md = re.sub(r'\n{3,}', '\n\n', md)
    return md

def main():
    if len(sys.argv) < 2:
        print("Uso: pdf_to_md.py <ruta_pdf>", file=sys.stderr)
        sys.exit(2)

    try:
        import pymupdf4llm
    except ImportError as e:
        print(f"pymupdf4llm no está instalado: {e}", file=sys.stderr)
        sys.exit(3)

    pdf_path = sys.argv[1]
    try:
        md = pymupdf4llm.to_markdown(pdf_path)
    except Exception as e:
        print(f"Error al convertir PDF: {e}", file=sys.stderr)
        sys.exit(1)

    sys.stdout.write(clean(md))

if __name__ == "__main__":
    main()
