"use client";

import { useEffect, useRef } from "react";

interface MicWaveformProps {
  /** Live microphone stream (from useSttRecorder). Hidden when null. */
  stream: MediaStream | null;
  className?: string;
}

/**
 * Live frequency-bar visualizer for the microphone, so the candidate can SEE
 * that the examiner is hearing them while they speak.
 */
export function MicWaveform({ stream, className }: MicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barCount = 32;
      const step = Math.floor(data.length / barCount);
      const barWidth = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const value = data[i * step] / 255;
        const barHeight = Math.max(3, value * height);
        const x = i * barWidth + barWidth * 0.15;
        const y = (height - barHeight) / 2;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + value * 0.6})`; // red-500, brighter when louder
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth * 0.7, barHeight, 2);
        ctx.fill();
      }
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={48}
      className={className}
      aria-label="Microphone activity"
    />
  );
}
