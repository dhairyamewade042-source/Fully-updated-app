// Approximate phonetic transliteration of Roman (English-spelt) names into
// Hindi (Devanagari) script. Used ONLY for customer names in the Hindi PDF.
// It is rule-based/phonetic, so output is a close approximation
// (e.g. "Shabbir" -> "शब्बीर", "Kumar" -> "कुमार").

type Unit = { seq: string; a: string; b: string };

// Vowels: `a` = independent form (word/syllable start), `b` = dependent matra.
// Longest sequences first so digraphs win over single letters.
const VOWELS: Unit[] = [
  { seq: "aa", a: "आ", b: "ा" },
  { seq: "ai", a: "ऐ", b: "ै" },
  { seq: "au", a: "औ", b: "ौ" },
  { seq: "ee", a: "ई", b: "ी" },
  { seq: "ii", a: "ई", b: "ी" },
  { seq: "oo", a: "ऊ", b: "ू" },
  { seq: "uu", a: "ऊ", b: "ू" },
  { seq: "a", a: "अ", b: "" }, // inherent vowel -> no matra
  { seq: "e", a: "ए", b: "े" },
  { seq: "i", a: "ई", b: "ी" }, // single 'i' rendered long (matches "Shabbir"->शब्बीर)
  { seq: "o", a: "ओ", b: "ो" },
  { seq: "u", a: "उ", b: "ु" },
];

// Consonants (base carries an inherent 'a'). Longest sequences first.
const CONSONANTS: { seq: string; d: string }[] = [
  { seq: "chh", d: "छ" },
  { seq: "shh", d: "ष" },
  { seq: "kh", d: "ख" },
  { seq: "gh", d: "घ" },
  { seq: "ch", d: "च" },
  { seq: "jh", d: "झ" },
  { seq: "th", d: "थ" },
  { seq: "dh", d: "ध" },
  { seq: "ph", d: "फ" },
  { seq: "bh", d: "भ" },
  { seq: "sh", d: "श" },
  { seq: "ck", d: "क" },
  { seq: "k", d: "क" },
  { seq: "g", d: "ग" },
  { seq: "c", d: "क" },
  { seq: "j", d: "ज" },
  { seq: "t", d: "त" },
  { seq: "d", d: "द" },
  { seq: "n", d: "न" },
  { seq: "p", d: "प" },
  { seq: "b", d: "ब" },
  { seq: "m", d: "म" },
  { seq: "r", d: "र" },
  { seq: "l", d: "ल" },
  { seq: "v", d: "व" },
  { seq: "w", d: "व" },
  { seq: "s", d: "स" },
  { seq: "h", d: "ह" },
  { seq: "f", d: "फ" },
  { seq: "z", d: "ज़" },
  { seq: "x", d: "क्स" },
  { seq: "q", d: "क़" },
  { seq: "y", d: "य" },
];

const matchAt = (s: string, i: number, list: { seq: string }[]) =>
  list.find((u) => s.startsWith(u.seq, i));

const transliterateWord = (raw: string): string => {
  const w = raw.toLowerCase();
  let out = "";
  let i = 0;
  let prevConsonant = false;
  while (i < w.length) {
    // Trailing / pre-consonant 'y' acts like a long 'ee' vowel (e.g. "Rocky").
    if (w[i] === "y" && prevConsonant) {
      const next = w[i + 1];
      if (next === undefined || !/[a-z]/.test(next) || matchAt(w, i + 1, CONSONANTS)) {
        out += "ी";
        prevConsonant = false;
        i += 1;
        continue;
      }
    }

    const v = matchAt(w, i, VOWELS) as Unit | undefined;
    if (v) {
      out += prevConsonant ? v.b : v.a;
      prevConsonant = false;
      i += v.seq.length;
      continue;
    }

    const c = matchAt(w, i, CONSONANTS) as { seq: string; d: string } | undefined;
    if (c) {
      if (prevConsonant) out += "\u094D"; // halant between consecutive consonants
      out += c.d;
      prevConsonant = true;
      i += c.seq.length;
      continue;
    }

    // Any other character (space kept by caller): pass through.
    out += w[i];
    prevConsonant = false;
    i += 1;
  }
  return out;
};

export const toHindiName = (name: string): string =>
  String(name)
    .split(/(\s+)/) // keep the whitespace separators
    .map((part) => (/^\s+$/.test(part) || part === "" ? part : transliterateWord(part)))
    .join("");
