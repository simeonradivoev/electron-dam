import { Button, ControlGroup, Divider, Slider } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import React, { useEffect, useRef, useState } from 'react';
import ReactAudioPlayer from 'react-audio-player';

const WaveSurfer = require('wavesurfer.js');

type Props = {
  importedAudio: UseQueryResult<string | null, unknown>;
  panelSize: number;
};

const PreviewPanelAudio = ({ panelSize, importedAudio }: Props) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<any>(null);
  const [playing, setPlay] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      barWidth: 3,
      barRadius: 3,
      cursorWidth: 2,
      responsive: true,
      height: 150,
      // If true, normalize by the maximum peak instead of 1.0.
      normalize: true,
      hideScrollbar: true,
    });
    wavesurfer.current.load(importedAudio.data);
    setPlay(false);

    wavesurfer.current.on('ready', function () {
      if (wavesurfer.current) {
        wavesurfer.current.setVolume(volume);
        setVolume(volume);
      }
    });

    return () => {
      wavesurfer.current.destroy();
    };
  }, [importedAudio, volume]);

  useEffect(() => {
    if (playing) {
      wavesurfer.current.play();
    } else {
      wavesurfer.current.pause();
    }
  }, [playing]);

  useEffect(() => {
    wavesurfer.current.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  useEffect(() => {
    wavesurfer.current.drawer.fireEvent('redraw');
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
              setPlay(!playing);
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button
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
