import { Button, ButtonGroup, ControlGroup, Divider, Slider } from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { decodePeaks, encodePeaks, useEvent } from 'renderer/scripts/utils';
import { AppToaster } from 'renderer/toaster';
import { useLocalStorage } from 'usehooks-ts';
import WaveSurfer from 'wavesurfer.js';
import Hover from 'wavesurfer.js/dist/plugins/hover';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';

type Props = {
  isZip: boolean;
  path?: string;
  importedAudio: { url: string; duration?: number };
  autoPlay: boolean;
  hasThumbnail: boolean;
  audioMetadata?: FileInfo['audioMetadata'];
};

function PreviewPanelAudio({ importedAudio, isZip, path, audioMetadata, hasThumbnail }: Props) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer>();
  const queryClient = useQueryClient();
  const [playing, setPlay] = useState(false);
  const [volume, setVolume] = useLocalStorage('volume', 0.5);

  const [loop, setLoop] = useLocalStorage('loop', false);
  const [muted, setMuted] = useLocalStorage('muted', false);

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
    wavesurferRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    wavesurferRef.current?.setMuted(muted);
  }, [muted]);

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

  useEffect(() => {
    if (!waveformRef.current) {
      return undefined;
    }
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current!,
      cursorWidth: 2,
      height: 150,
      width: waveformRef.current?.offsetWidth,
      waveColor: '#2d72d2',
      progressColor: '#c87619',
      // If true, normalize by the maximum peak instead of 1.0.
      normalize: false,
      hideScrollbar: true,
      mediaControls: false,
      // Fixes issue with having # in name or path. encodeURI doesn't work
      url: importedAudio!.url.replace('#', '%23'),
      plugins: [Hover.create(), TimelinePlugin.create()],
      autoplay: !!localStorage.getItem('continuePlaying'),
      duration: importedAudio!.duration,
      backend: isZip ? 'WebAudio' : 'MediaElement',
      peaks: audioMetadata?.peaks ? decodePeaks(audioMetadata.peaks) : undefined,
    });
    wavesurfer.setVolume(volume);

    wavesurfer.on('finish', () => {
      if (localStorage.getItem('loop') === 'true') {
        // Only timeout works, if you play directly nothing happens
        setTimeout(() => wavesurfer.play());
      }
    });
    wavesurfer.on('play', () => {
      setPlay(true);
    });
    wavesurfer.on('pause', () => setPlay(false));

    wavesurfer.on('error', (e) => {
      if (e.name === 'AbortError') {
        return;
      }
      AppToaster.then((toaster) => toaster.show({ message: e.name, intent: 'danger' }));
    });

    wavesurfer.on('ready', (e) => {
      wavesurfer.setMuted(muted);
      if (path && !isZip) {
        if (!hasThumbnail) {
          wavesurfer
            .exportImage('image/webp', 0.8, 'dataURL')
            .then((blob) => window.api.saveAudioPreview(path, blob[0]))
            .catch((e) => {
              AppToaster.then((t) => t.show({ message: e.message, intent: 'danger' }));
            });
        }

        if (!audioMetadata?.peaks) {
          window.api.saveAudioPeaks(path, encodePeaks(wavesurfer.exportPeaks({ channels: 1 })));
        }
      }
    });
    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.unAll();
      wavesurfer.stop();
      wavesurfer.once('ready', () => wavesurfer.destroy());
      wavesurfer?.destroy();
      wavesurferRef.current = undefined;
    };
  }, [importedAudio, isZip]);

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
