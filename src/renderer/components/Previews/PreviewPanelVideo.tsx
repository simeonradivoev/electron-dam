import { Spinner } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import mime from 'mime';
import { useEffect, useRef } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.min.css';

type Props = {
  video: UseQueryResult<string | null, unknown>;
};

function PreviewPanelVideo({ video }: Props) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player>();
  const [play, setPlay] = useSessionStorage('play-video', false);

  useEffect(() => {
    if (!video.data) {
      return;
    }
    if (!playerRef.current) {
      if (!videoRef.current) return;
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current?.appendChild(videoElement);
      console.log('Created');

      playerRef.current = videojs(
        videoElement,
        {
          controls: true,
          responsive: true,
          fluid: true,
          autoPlay: play,
          sources: [
            { src: video.data, type: mime.getType(video.data) },
            { src: video.data, type: 'video/mp4' },
          ],
        },
        () => {},
      );
      playerRef.current.on('play', () => setPlay(true));
      playerRef.current.on('pause', () => setPlay(false));
    } else {
      const player = playerRef.current;

      player.src([
        { src: video.data, type: mime.getType(video.data) },
        { src: video.data, type: 'video/mp4' },
      ]);
    }
  }, [video.data, videoRef, setPlay]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.autoplay(play);
    }
  }, [play]);

  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = undefined;
      }
    };
  }, [playerRef]);

  return video.data ? (
    <div data-vjs-player>
      <div ref={videoRef} />
    </div>
  ) : (
    <Spinner />
  );
}

export default PreviewPanelVideo;
