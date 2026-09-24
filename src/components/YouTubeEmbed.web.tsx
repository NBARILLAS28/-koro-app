import { createElement } from 'react-native-web';

export function YouTubeEmbed({
  videoId,
  height,
  play,
}: {
  videoId: string;
  height: number;
  play: boolean;
}) {
  return createElement('iframe', {
    key: videoId,
    src: `https://www.youtube.com/embed/${videoId}${play ? '?autoplay=1' : ''}`,
    style: { width: '100%', height, border: 0, borderRadius: 12 },
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
    allowFullScreen: true,
  });
}
