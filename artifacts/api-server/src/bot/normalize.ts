/**
 * Mappa dei blocchi Unicode "Mathematical Bold" (e varianti corsive/sans-serif)
 * verso i corrispondenti caratteri ASCII.
 * I nomi dei ruoli Discord usano spesso questi caratteri speciali che
 * non vengono ridotti da String.normalize("NFD").
 */
const UNICODE_BOLD_RANGES: Array<[number, number, number]> = [
  // Mathematical Bold Capital A–Z  (U+1D400–U+1D419)
  [0x1d400, 0x1d419, 0x41],
  // Mathematical Bold Small a–z    (U+1D41A–U+1D433)
  [0x1d41a, 0x1d433, 0x61],
  // Mathematical Italic Capital    (U+1D434–U+1D44D)
  [0x1d434, 0x1d44d, 0x41],
  // Mathematical Italic Small      (U+1D44E–U+1D467)
  [0x1d44e, 0x1d467, 0x61],
  // Mathematical Bold Italic Cap   (U+1D468–U+1D481)
  [0x1d468, 0x1d481, 0x41],
  // Mathematical Bold Italic Small (U+1D482–U+1D49B)
  [0x1d482, 0x1d49b, 0x61],
  // Mathematical Script Capital    (U+1D49C–U+1D4B5) — skip gaps handled below
  [0x1d49c, 0x1d4b5, 0x41],
  // Mathematical Bold Script Cap   (U+1D4D0–U+1D4E9)
  [0x1d4d0, 0x1d4e9, 0x41],
  // Mathematical Bold Script Small (U+1D4EA–U+1D503)
  [0x1d4ea, 0x1d503, 0x61],
  // Mathematical Fraktur Capital   (U+1D504–U+1D51D)
  [0x1d504, 0x1d51d, 0x41],
  // Mathematical Double-Struck Cap (U+1D538–U+1D551)
  [0x1d538, 0x1d551, 0x41],
  // Mathematical Bold Fraktur Cap  (U+1D56C–U+1D585)
  [0x1d56c, 0x1d585, 0x41],
  // Mathematical Bold Fraktur Sml  (U+1D586–U+1D59F)
  [0x1d586, 0x1d59f, 0x61],
  // Mathematical Sans-Serif Cap    (U+1D5A0–U+1D5B9)
  [0x1d5a0, 0x1d5b9, 0x41],
  // Mathematical Sans-Serif Small  (U+1D5BA–U+1D5D3)
  [0x1d5ba, 0x1d5d3, 0x61],
  // Mathematical Sans Bold Cap     (U+1D5D4–U+1D5ED)
  [0x1d5d4, 0x1d5ed, 0x41],
  // Mathematical Sans Bold Small   (U+1D5EE–U+1D607)
  [0x1d5ee, 0x1d607, 0x61],
  // Mathematical Sans Italic Cap   (U+1D608–U+1D621)
  [0x1d608, 0x1d621, 0x41],
  // Mathematical Sans Italic Small (U+1D622–U+1D63B)
  [0x1d622, 0x1d63b, 0x61],
  // Mathematical Sans Bold Ital Cap(U+1D63C–U+1D655)
  [0x1d63c, 0x1d655, 0x41],
  // Mathematical Sans Bold Ital Sml(U+1D656–U+1D66F)
  [0x1d656, 0x1d66f, 0x61],
  // Mathematical Monospace Cap     (U+1D670–U+1D689)
  [0x1d670, 0x1d689, 0x41],
  // Mathematical Monospace Small   (U+1D68A–U+1D6A3)
  [0x1d68a, 0x1d6a3, 0x61],
];

function unicodeMathToAscii(str: string): string {
  const chars = [...str]; // split by codepoint (handles surrogate pairs)
  return chars
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      for (const [start, end, base] of UNICODE_BOLD_RANGES) {
        if (cp >= start && cp <= end) {
          return String.fromCodePoint(base + (cp - start));
        }
      }
      return ch;
    })
    .join("");
}

/**
 * Normalizza una stringa per confronto fuzzy insensibile a:
 * - maiuscole/minuscole
 * - accenti diacritici
 * - caratteri Unicode bold/italic/monospace matematici
 * - punteggiatura, spazi, trattini, emoji
 *
 * Due stringhe che differiscono solo per questi aspetti risulteranno uguali.
 */
export function normalize(str: string): string {
  return unicodeMathToAscii(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")                          // accenti
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035\u0060\u00b4]/g, "") // virgolette tipografiche
    .replace(/[^a-z0-9]/g, "");                                // tutto il resto (emoji, -, spazi, ♢ ecc.)
}
