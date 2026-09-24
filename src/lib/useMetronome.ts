import { useEffect, useRef, useState, useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';
import { useSharedValue, withTiming, withSequence, SharedValue } from 'react-native-reanimated';

const clickNormal = require('../../assets/click.wav');
const clickAccent = require('../../assets/click-accent.wav');

const POOL_SIZE = 3; // suficiente incluso a tempos muy rápidos (300 BPM) sin pisarse

/**
 * Metrónomo 100% local al dispositivo: nunca se sincroniza por red ni se
 * comparte con otros integrantes (a propósito — un clic de audio "en red"
 * siempre llega con variación de milisegundos entre teléfonos, lo cual
 * desincroniza más de lo que ayuda). Cada quien corre el suyo.
 *
 * `audible` controla si además del pulso visual también suena el clic —
 * se apaga automáticamente en vivo y se deja prender en ensayo.
 *
 * Dos optimizaciones sobre la primera versión (que se sentía "trabada"):
 * 1. Pool de reproductores en lugar de uno solo con seekTo(0)+play() —
 *    ese patrón corría una carrera entre el seek (asíncrono) y el play,
 *    lo que causaba clics tarde o silenciados. Con varios reproductores
 *    rotando, cada uno se usa y termina de sonar antes de reutilizarse.
 * 2. El pulso visual usa valores compartidos de Reanimated en vez de
 *    estado de React — así no fuerza que toda la pantalla de la canción
 *    (con scroll, video de YouTube, letra) se vuelva a renderizar en
 *    cada pulso, que era la causa más probable del "trabajeo".
 */
export function useMetronome(bpm: number, audible: boolean, beatsPerBar = 4) {
  const [isPlaying, setIsPlaying] = useState(false);
  const beatRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poolIndexRef = useRef({ normal: 0, accent: 0 });

  // Pools fijos (las reglas de hooks no permiten crearlos en un loop dinámico)
  const normalPlayers = [
    useAudioPlayer(clickNormal),
    useAudioPlayer(clickNormal),
    useAudioPlayer(clickNormal),
  ];
  const accentPlayers = [
    useAudioPlayer(clickAccent),
    useAudioPlayer(clickAccent),
    useAudioPlayer(clickAccent),
  ];

  // Un valor compartido por punto del pulso (hasta 4 tiempos por compás,
  // que cubre los compases más comunes — 4/4, 3/4, 2/4).
  const dot0 = useSharedValue(0);
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const dots = [dot0, dot1, dot2, dot3];

  const playClick = useCallback(
    (accent: boolean) => {
      if (!audible) return;
      try {
        if (accent) {
          const i = poolIndexRef.current.accent;
          accentPlayers[i].play();
          poolIndexRef.current.accent = (i + 1) % POOL_SIZE;
        } else {
          const i = poolIndexRef.current.normal;
          normalPlayers[i].play();
          poolIndexRef.current.normal = (i + 1) % POOL_SIZE;
        }
      } catch {
        // Si el audio falla (dispositivo en silencio, etc.) el pulso visual sigue solo.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audible]
  );

  const pulseDot = useCallback(
    (index: number) => {
      'worklet';
      dots[index].value = withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 220 }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!isPlaying || bpm <= 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const intervalMs = 60000 / bpm;
    let expected = Date.now() + intervalMs;

    const tick = () => {
      const beat = beatRef.current;
      pulseDot(beat);
      playClick(beat === 0);
      beatRef.current = (beat + 1) % beatsPerBar;

      const drift = Date.now() - expected;
      expected += intervalMs;
      timeoutRef.current = setTimeout(tick, Math.max(0, intervalMs - drift));
    };

    beatRef.current = 0;
    pulseDot(0);
    playClick(true);
    beatRef.current = 1 % beatsPerBar;
    timeoutRef.current = setTimeout(tick, intervalMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, bpm, beatsPerBar, audible]);

  const toggle = useCallback(() => setIsPlaying((v) => !v), []);
  const stop = useCallback(() => setIsPlaying(false), []);

  return { isPlaying, toggle, stop, dots: dots as SharedValue<number>[] };
}
