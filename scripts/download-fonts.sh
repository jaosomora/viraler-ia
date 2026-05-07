#!/usr/bin/env bash
# Descarga las fuentes Google necesarias para AS Clips a assets/fonts/
# Las usa libass al hacer burn-in del .ass para que el MP4 final coincida con el preview.
# Re-ejecutable: si la fuente ya existe, no la re-descarga.
#
# Hoy la mayoría de Google Fonts solo se publica como "variable font" (un único TTF con todos
# los pesos expresados via axis [wght]). libass moderna soporta variable fonts vía freetype,
# y selecciona el peso correcto cuando el .ass usa Bold=1.
set -e
cd "$(dirname "$0")/../assets/fonts"

GH="https://github.com/google/fonts/raw/main"

declare -a FONTS=(
  # path-en-repo|nombre-archivo-destino
  # ----- Hook -----
  "ofl/anton/Anton-Regular.ttf|Anton-Regular.ttf"
  "ofl/bebasneue/BebasNeue-Regular.ttf|BebasNeue-Regular.ttf"
  "ofl/leaguespartan/LeagueSpartan%5Bwght%5D.ttf|LeagueSpartan-Variable.ttf"
  "ofl/oswald/Oswald%5Bwght%5D.ttf|Oswald-Variable.ttf"
  "ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf|Archivo-Variable.ttf"
  "ofl/bowlbyone/BowlbyOne-Regular.ttf|BowlbyOne-Regular.ttf"

  # ----- Caption / Keyword shared families (variable fonts cubren todos los pesos) -----
  "ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf|Inter-Variable.ttf"
  "ofl/montserrat/Montserrat%5Bwght%5D.ttf|Montserrat-Variable.ttf"
  "ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf|Roboto-Variable.ttf"
  "ofl/nunito/Nunito%5Bwght%5D.ttf|Nunito-Variable.ttf"
  "ofl/worksans/WorkSans%5Bwght%5D.ttf|WorkSans-Variable.ttf"
  "ofl/lato/Lato-Bold.ttf|Lato-Bold.ttf"
  "ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf|DMSans-Variable.ttf"
  "ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf|PlusJakartaSans-Variable.ttf"

  # ----- Serifs elegantes (Editorial/Documentary/Boutique) -----
  "ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf|PlayfairDisplay-Variable.ttf"
  "ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf|PlayfairDisplay-Italic-Variable.ttf"
  "ofl/lora/Lora%5Bwght%5D.ttf|Lora-Variable.ttf"
  "ofl/lora/Lora-Italic%5Bwght%5D.ttf|Lora-Italic-Variable.ttf"
  "ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf|EBGaramond-Variable.ttf"
  "ofl/ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf|EBGaramond-Italic-Variable.ttf"
  "ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf|DMSerifDisplay-Regular.ttf"
  "ofl/dmserifdisplay/DMSerifDisplay-Italic.ttf|DMSerifDisplay-Italic.ttf"
  "ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf|CormorantGaramond-Variable.ttf"
  "ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf|CormorantGaramond-Italic-Variable.ttf"

  # ----- Keyword (display) -----
  "ofl/poppins/Poppins-Bold.ttf|Poppins-Bold.ttf"
  "ofl/rubik/Rubik%5Bwght%5D.ttf|Rubik-Variable.ttf"
  "apache/permanentmarker/PermanentMarker-Regular.ttf|PermanentMarker-Regular.ttf"
  "ofl/caveat/Caveat%5Bwght%5D.ttf|Caveat-Variable.ttf"
  "ofl/passionone/PassionOne-Bold.ttf|PassionOne-Bold.ttf"
  "apache/luckiestguy/LuckiestGuy-Regular.ttf|LuckiestGuy-Regular.ttf"
)

OK=0
SKIP=0
FAIL=0
for entry in "${FONTS[@]}"; do
  src="${entry%%|*}"
  dst="${entry##*|}"
  if [ -f "$dst" ]; then
    SKIP=$((SKIP+1))
    continue
  fi
  url="$GH/$src"
  echo "↓ $dst"
  if curl -sSL -f -o "$dst.tmp" "$url"; then
    mv "$dst.tmp" "$dst"
    OK=$((OK+1))
  else
    rm -f "$dst.tmp"
    echo "  ✗ falló: $url"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "Listo. Descargadas: $OK · Existentes: $SKIP · Falladas: $FAIL"
ls -lh *.ttf 2>/dev/null | awk '{printf "  %s  %s\n", $5, $9}'
