import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Song } from '@/types';
import { colors, radius, spacing } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { parseChordProLine, ALL_KEYS } from '@/utils/chords';

const QUICK_CHORDS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export default function EditSongScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [text, setText] = useState('');
  const [originalKey, setOriginalKey] = useState('C');
  const [bpm, setBpm] = useState<number | null>(null);
  const [minorMode, setMinorMode] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('songs').select('*').eq('id', id).single();
    if (data) {
      setSong(data);
      setText(data.lyrics_chordpro ?? '');
      setOriginalKey(data.original_key ?? 'C');
      setBpm(data.bpm ?? null);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const insertChord = (root: string) => {
    const chord = minorMode ? `${root}m` : root;
    const token = `[${chord}]`;
    const before = text.slice(0, selection.start);
    const after = text.slice(selection.end);
    const newText = before + token + after;
    setText(newText);
    // Mueve el cursor justo después del token insertado
    const newPos = selection.start + token.length;
    setSelection({ start: newPos, end: newPos });
  };

  const insertNewLine = () => {
    const before = text.slice(0, selection.start);
    const after = text.slice(selection.end);
    const newText = before + '\n' + after;
    setText(newText);
    const newPos = selection.start + 1;
    setSelection({ start: newPos, end: newPos });
  };

  const save = async () => {
    if (!song) return;
    setSaving(true);
    const { error } = await supabase
      .from('songs')
      .update({ lyrics_chordpro: text, original_key: originalKey, bpm, updated_at: new Date().toISOString() })
      .eq('id', song.id);
    setSaving(false);
    if (error) showAlert('No se pudo guardar', friendlyError(error));
    else router.back();
  };

  const previewLines = useMemo(() => text.split('\n'), [text]);

  if (!song) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={styles.back}>‹ Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>{song.title}</Text>
        <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
        </Pressable>
      </View>

      {/* Tonalidad original */}
      <View style={styles.keyRow}>
        <Text style={styles.keyRowLabel}>Tonalidad original:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {ALL_KEYS.map((k) => (
            <Pressable
              key={k}
              style={[styles.keyChip, originalKey === k && styles.keyChipActive]}
              onPress={() => setOriginalKey(k)}
            >
              <Text style={[styles.keyChipText, originalKey === k && styles.keyChipTextActive]}>{k}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Tempo (BPM) — usado por el metrónomo local en la pantalla de la canción */}
      <View style={styles.keyRow}>
        <Text style={styles.keyRowLabel}>Tempo:</Text>
        <Pressable
          style={styles.bpmStepBtn}
          onPress={() => setBpm((b) => Math.max(30, (b ?? 120) - 5))}
        >
          <Text style={styles.bpmStepText}>−</Text>
        </Pressable>
        <Text style={styles.bpmValue}>{bpm ?? '—'}</Text>
        <Text style={styles.bpmLabel}>BPM</Text>
        <Pressable
          style={styles.bpmStepBtn}
          onPress={() => setBpm((b) => Math.min(300, (b ?? 115) + 5))}
        >
          <Text style={styles.bpmStepText}>+</Text>
        </Pressable>
        {bpm !== null && (
          <Pressable onPress={() => setBpm(null)} style={{ marginLeft: spacing(3) }}>
            <Text style={styles.bpmClear}>Quitar</Text>
          </Pressable>
        )}
      </View>

      {/* Barra de inserción rápida de acordes */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {QUICK_CHORDS.map((c) => (
            <Pressable key={c} style={styles.chordBtn} onPress={() => insertChord(c)}>
              <Text style={styles.chordBtnText}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          style={[styles.minorToggle, minorMode && styles.minorToggleActive]}
          onPress={() => setMinorMode((v) => !v)}
        >
          <Text style={[styles.minorToggleText, minorMode && styles.minorToggleTextActive]}>m</Text>
        </Pressable>
        <Pressable style={styles.newLineBtn} onPress={insertNewLine}>
          <Text style={styles.newLineBtnText}>↵</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Toca un acorde para insertarlo donde esté el cursor. Formato: [G]letra [C]más letra
      </Text>

      {/* Editor de texto */}
      <TextInput
        style={styles.editor}
        multiline
        value={text}
        onChangeText={setText}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder="[G]Amazing [C]grace how [G]sweet the sound..."
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
      />

      {/* Vista previa en vivo */}
      <Pressable style={styles.previewToggle} onPress={() => setShowPreview((v) => !v)}>
        <Text style={styles.previewToggleText}>{showPreview ? 'Ocultar vista previa ▲' : 'Ver vista previa ▼'}</Text>
      </Pressable>
      {showPreview && (
        <ScrollView style={styles.previewBlock}>
          {text ? (
            previewLines.map((line, i) => (
              <View key={i} style={styles.previewLine}>
                {parseChordProLine(line).map((seg, j) => (
                  <View key={j} style={styles.segment}>
                    {seg.chord ? <Text style={styles.chord}>{seg.chord}</Text> : <Text style={styles.chordPlaceholder}> </Text>}
                    <Text style={styles.lyric}>{seg.lyric || ' '}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.previewEmpty}>La vista previa aparecerá aquí mientras escribes.</Text>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing(4),
    paddingTop: spacing(14),
  },
  back: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3) },
  saveBtnText: { color: '#12121A', fontWeight: '700', fontSize: 13 },

  keyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(4), marginBottom: spacing(2) },
  keyRowLabel: { color: colors.textMuted, fontSize: 12, marginRight: spacing(2) },
  keyChip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing(1), paddingHorizontal: spacing(2.5), marginRight: spacing(1.5) },
  keyChipActive: { backgroundColor: colors.primary },
  keyChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  keyChipTextActive: { color: '#12121A' },
  bpmStepBtn: { backgroundColor: colors.surfaceAlt, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: spacing(1) },
  bpmStepText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  bpmValue: { color: colors.primary, fontSize: 16, fontWeight: '800', minWidth: 30, textAlign: 'center' },
  bpmLabel: { color: colors.textMuted, fontSize: 10, marginRight: spacing(1) },
  bpmClear: { color: colors.danger, fontSize: 12 },

  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing(4), marginBottom: spacing(1) },
  chordBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: spacing(1.5), paddingHorizontal: spacing(3), marginRight: spacing(1.5) },
  chordBtnText: { color: colors.accentChord, fontWeight: '800', fontSize: 13 },
  minorToggle: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: spacing(1) },
  minorToggleActive: { backgroundColor: colors.primary },
  minorToggleText: { color: colors.textMuted, fontWeight: '800' },
  minorToggleTextActive: { color: '#12121A' },
  newLineBtn: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: spacing(1) },
  newLineBtnText: { color: colors.text, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 11, paddingHorizontal: spacing(4), marginBottom: spacing(2) },

  editor: {
    marginHorizontal: spacing(4),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing(3),
    minHeight: 160,
    maxHeight: 220,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },

  previewToggle: { paddingHorizontal: spacing(4), marginTop: spacing(3) },
  previewToggleText: { color: colors.accentChord, fontWeight: '600', fontSize: 13 },
  previewBlock: {
    marginHorizontal: spacing(4),
    marginTop: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    flex: 1,
  },
  previewEmpty: { color: colors.textMuted, textAlign: 'center' },
  previewLine: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(3) },
  segment: { marginRight: spacing(0.5) },
  chord: { color: colors.accentChord, fontWeight: '800', fontSize: 13 },
  chordPlaceholder: { fontSize: 13 },
  lyric: { color: colors.text, fontSize: 15 },
});
