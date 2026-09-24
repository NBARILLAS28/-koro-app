// ============================================================
// Motor de tonalidad para KORO
// Soporta notación ChordPro simplificada: "[G]Amazing [C]grace how [G]sweet"
// ============================================================

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Tonalidades que convencionalmente se escriben con bemoles
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm']);

const NOTE_TO_INDEX: Record<string, number> = {};
SHARP_SCALE.forEach((n, i) => (NOTE_TO_INDEX[n] = i));
FLAT_SCALE.forEach((n, i) => (NOTE_TO_INDEX[n] = i));

export const ALL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
];

/** Calcula cuántos semitonos hay entre dos tonalidades (destino - origen) */
export function semitoneDistance(fromKey: string, toKey: string): number {
  const from = NOTE_TO_INDEX[normalizeRoot(fromKey)];
  const to = NOTE_TO_INDEX[normalizeRoot(toKey)];
  if (from === undefined || to === undefined) return 0;
  return (to - from + 12) % 12;
}

/** Extrae la nota raíz de un acorde o tonalidad, ej: "G#m7" -> "G#" */
function normalizeRoot(chord: string): string {
  const match = chord.match(/^[A-G](#|b)?/);
  return match ? match[0] : chord;
}

/** Transpone un solo acorde N semitonos, preservando sufijos (m, 7, sus4, etc) */
export function transposeChord(chord: string, semitones: number, preferFlats = false): string {
  if (semitones === 0) return chord;
  const rootMatch = chord.match(/^[A-G](#|b)?/);
  if (!rootMatch) return chord;

  const root = rootMatch[0];
  const suffix = chord.slice(root.length); // m, 7, maj7, sus4, /bass, etc.
  const idx = NOTE_TO_INDEX[root];
  if (idx === undefined) return chord;

  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  const scale = preferFlats ? FLAT_SCALE : SHARP_SCALE;

  // Si el sufijo incluye un bajo tipo "/D", transponer también esa nota
  const bassMatch = suffix.match(/^([^/]*)\/([A-G](#|b)?)(.*)$/);
  if (bassMatch) {
    const [, mainSuffix, bassNote, rest] = bassMatch;
    const bassIdx = NOTE_TO_INDEX[bassNote];
    const newBass = bassIdx !== undefined ? scale[((bassIdx + semitones) % 12 + 12) % 12] : bassNote;
    return `${scale[newIdx]}${mainSuffix}/${newBass}${rest}`;
  }

  return `${scale[newIdx]}${suffix}`;
}

/** Transpone todo el texto en formato ChordPro: [Am] Verse [C] here */
export function transposeChordPro(text: string, semitones: number, targetKey?: string): string {
  if (semitones === 0) return text;
  const preferFlats = targetKey ? FLAT_KEYS.has(targetKey) : false;
  return text.replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChord(chord, semitones, preferFlats)}]`);
}

/** Parsea una línea ChordPro en segmentos {chord, lyric} para renderizar acorde-arriba-de-letra */
export interface ChordSegment {
  chord: string | null;
  lyric: string;
}

export function parseChordProLine(line: string): ChordSegment[] {
  const segments: ChordSegment[] = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let pendingChord: string | null = null;

  while ((match = regex.exec(line)) !== null) {
    const lyricChunk = line.slice(lastIndex, match.index);
    if (lyricChunk || pendingChord) {
      segments.push({ chord: pendingChord, lyric: lyricChunk });
    }
    pendingChord = match[1];
    lastIndex = regex.lastIndex;
  }
  segments.push({ chord: pendingChord, lyric: line.slice(lastIndex) });
  return segments;
}

/** Sube o baja una tonalidad N semitonos y devuelve el nombre resultante */
export function shiftKey(key: string, semitones: number): string {
  const idx = NOTE_TO_INDEX[normalizeRoot(key)];
  if (idx === undefined) return key;
  const isMinor = key.endsWith('m') && !key.endsWith('bm') === false ? key.endsWith('m') : key.endsWith('m');
  const scale = FLAT_KEYS.has(key) ? FLAT_SCALE : SHARP_SCALE;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return isMinor ? `${scale[newIdx]}m` : scale[newIdx];
}
