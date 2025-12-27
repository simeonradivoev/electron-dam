import { Button, ButtonGroup, Classes, ControlGroup, Divider, Slider } from '@blueprintjs/core';
import { IAudioMetadata } from 'music-metadata';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEvent, useSavedState } from 'renderer/scripts/utils';
import { AppToaster } from 'renderer/toaster';
import WaveSurfer from 'wavesurfer.js';
import Hover from 'wavesurfer.js/dist/plugins/hover';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';

type Props = {
  isZip: boolean;
  importedAudio: { url: string; duration?: number };
  autoPlay: boolean;
  audioMetadata?: IAudioMetadata;
};

function PreviewPanelAudio({ importedAudio, audioMetadata, autoPlay, isZip }: Props) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer>();
  const [playing, setPlay] = useState(false);
  const [volume, setVolume] = useSavedState('volume', 0.5);

  const [loop, setLoop] = useState(!!localStorage.getItem('loop'));
  const [muted, setMuted] = useState(!!localStorage.getItem('muted'));

  const updatePlay = (wave: WaveSurfer, play: boolean) => {
    if (play) {
      wave.play();
    } else {
      wave.pause();
    }
  };

  useEvent(document, 'quickAction', (e: KeyboardEvent) => handlePlay());

  useEffect(() => {}, [loop]);

  useEffect(() => {
    if (wavesurferRef.current?.isPlaying()) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current?.pause();
    }
  }, [playing]);

  useEffect(() => {
    wavesurferRef.current?.setVolume(muted ? 0 : volume);
    if (muted) localStorage.setItem('muted', 'true');
    else localStorage.removeItem('muted');
    localStorage.setItem('volume', volume.toString());
    if (loop) localStorage.setItem('loop', 'true');
    else localStorage.removeItem('loop');
  }, [muted, volume, loop]);

  const handleLoop = () => {
    if (localStorage.getItem('loop')) {
      wavesurferRef.current?.play();
    }
  };

  const handleReady = useCallback((wave: WaveSurfer) => {
    if (wavesurferRef.current) {
      wave.setVolume(muted ? 0 : volume);
      //updatePlay(wave, autoPlay);
    }
  }, []);

  const handlePlay = useCallback(() => {
    try {
      if (wavesurferRef.current?.isPlaying()) {
        wavesurferRef.current?.pause();
        localStorage.removeItem('continuePlaying');
      } else {
        wavesurferRef.current?.play();
        localStorage.setItem('continuePlaying', 'true');
      }
    } catch (error) {}
  }, []);

  useLayoutEffect(() => {
    try {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current!,
        cursorWidth: 2,
        height: 150,
        width: waveformRef.current?.offsetWidth,
        waveColor: '#2d72d2',
        progressColor: '#c87619',
        // If true, normalize by the maximum peak instead of 1.0.
        normalize: true,
        hideScrollbar: true,
        mediaControls: false,
        // Fixes issue with having # in name or path. encodeURI doesn't work
        url: importedAudio!.url.replace('#', '%23'),
        plugins: [Hover.create(), TimelinePlugin.create()],
        autoplay: !!localStorage.getItem('continuePlaying'),
        duration: importedAudio!.duration,
        backend: isZip ? 'WebAudio' : 'MediaElement',
      });
      wavesurfer.on('finish', handleLoop);
      wavesurfer.on('play', () => setPlay(true));
      wavesurfer.on('pause', () => setPlay(false));
      wavesurfer.on('error', (e) => {
        if (e.name === 'AbortError') {
          return;
        }
        AppToaster.show({ message: e.name, intent: 'danger' });
      });

      wavesurfer.on('load', () => {});

      wavesurfer.on('ready', (e) => handleReady(wavesurfer));
      wavesurferRef.current = wavesurfer;

      return () => {
        wavesurfer?.destroy();
      };
    } catch (error) {
      return undefined;
    }
  }, [waveformRef, importedAudio, handleReady, isZip]);

  useEffect(() => wavesurferRef.current && updatePlay(wavesurferRef.current, playing), [playing]);

  return (
    <>
      <div id="waveform" ref={waveformRef} />
      <Divider />
      <div className="controls">
        <ControlGroup>
          <ButtonGroup>
            <Button
              icon={playing ? 'pause' : 'play'}
              intent={playing ? 'primary' : 'none'}
              onClick={handlePlay}
            />
            <Button
              icon="stop"
              onClick={() => {
                wavesurferRef.current?.stop();
                localStorage.removeItem('continuePlaying');
              }}
            />
            <Button active={loop} onClick={() => setLoop(!loop)} icon="repeat" />
            <Button
              active={muted}
              onClick={() => setMuted(!muted)}
              icon={muted ? 'volume-off' : 'volume-up'}
            />
          </ButtonGroup>
          <Slider
            labelRenderer={false}
            className="volume-slider"
            min={0}
            max={1}
            disabled={muted}
            value={volume}
            stepSize={0.02}
            onChange={setVolume}
          />
        </ControlGroup>
      </div>
    </>
  );
}

export default PreviewPanelAudio;
