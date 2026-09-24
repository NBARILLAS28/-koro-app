import YoutubePlayer from 'react-native-youtube-iframe';

export function YouTubeEmbed({
  videoId,
  height,
  play,
}: {
  videoId: string;
  height: number;
  play: boolean;
}) {
  return <YoutubePlayer height={height} videoId={videoId} play={play} />;
}
