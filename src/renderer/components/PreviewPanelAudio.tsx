import { Button, ControlGroup, Divider, Slider } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactAudioPlayer from 'react-audio-player';
import WaveSurfer from 'wavesurfer.js';

type Props = {
  importedAudio: UseQueryResult<string | null, unknown>;
  panelSize: number;
  autoPlay: boolean;
};

const PreviewPanelAudio = ({ panelSize, importedAudio, autoPlay }: Props) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer>();
  const [playing, setPlay] = useState(autoPlay);
  const [volume, setVolume] = useState(
    Number.parseFloat(localStorage.getItem('volume') ?? '0.5')
  );
  const [loop, setLoop] = useState(localStorage.getItem('loop') === 'true');
  const [muted, setMuted] = useState(localStorage.getItem('muted') === 'true');

  const updatePlay = (play: boolean) => {
    if (play) {
      wavesurferRef.current?.play();
    } else {
      wavesurferRef.current?.pause();
    }
  };

  useEffect(() => {
    localStorage.setItem('loop', loop.toString());
  }, [loop]);

  const handleLoop = () => {
    if (localStorage.getItem('loop') === 'true') {
      wavesurferRef.current?.play();
    }
  };

  useEffect(() => {
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current!,
      cursorWidth: 2,
      responsive: true,
      height: 150,
      waveColor: '#2d72d2',
      progressColor: '#c87619',
      // If true, normalize by the maximum peak instead of 1.0.
      normalize: true,
      hideScrollbar: true,
      mediaControls: true,
    });
    wavesurferRef.current.on('finish', handleLoop);
    wavesurferRef.current.on('play', () => setPlay(true));
    wavesurferRef.current.on('pause', () => setPlay(false));

    // Fixes issue with having # in name or path. encodeURI doesn't work
    const fileUrl = importedAudio.data!.replace('#', '%23');
    wavesurferRef.current.load(fileUrl);
    setPlay(autoPlay);

    wavesurferRef.current.on('ready', function () {
      if (wavesurferRef.current) {
        wavesurferRef.current.setVolume(muted ? 0 : volume);
        updatePlay(autoPlay);
      }
    });

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, [importedAudio]);

  useEffect(() => updatePlay(playing), [playing]);

  useEffect(() => {
    wavesurferRef.current?.setVolume(muted ? 0 : volume);
    localStorage.setItem('muted', muted ? 'true' : 'false');
    localStorage.setItem('volume', volume.toString());
  }, [volume, muted]);

  useEffect(() => {
    wavesurferRef.current?.fireEvent('redraw');
  }, [panelSize]);

  return (
    <>
      <div id="waveform" ref={waveformRef} />
      <Divider />
      <div className="controls">
        <ControlGroup>
          <Button
            icon={playing ? 'pause' : 'play'}
            intent={playing ? 'primary' : 'none'}
            onClick={() => {
              if (wavesurferRef.current?.isPlaying()) {
                wavesurferRef.current?.pause();
              } else {
                wavesurferRef.current?.play();
              }
            }}
          />
          <Button
            icon="stop"
            onClick={() => {
              wavesurferRef.current?.stop();
            }}
          />
          <Button active={loop} onClick={() => setLoop(!loop)} icon="repeat" />
          <Button
            active={muted}
            onClick={() => setMuted(!muted)}
            icon={muted ? 'volume-off' : 'volume-up'}
          />
          <Slider
            labelRenderer={false}
            className="volume-slider"
            min={0}
            max={1}
            value={volume}
            stepSize={0.02}
            onChange={(v) => setVolume(v)}
          />
        </ControlGroup>
      </div>
    </>
  );
};

export default PreviewPanelAudio;
