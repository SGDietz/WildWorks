"use client";

import {
  Maximize,
  MoreVertical,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

type BrandedVideoPlayerProps = {
  src: string;
  ariaLabel: string;
};

type VideoStyle = CSSProperties & {
  "--ww-video-progress": string;
  "--ww-video-volume": string;
};

const playbackRates = [0.75, 1, 1.25, 1.5];

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function BrandedVideoPlayer({
  src,
  ariaLabel,
}: BrandedVideoPlayerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);

  const togglePlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch {
        // The browser may still require a direct user gesture. The control
        // remains available for the next explicit tap.
      }
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Number(event.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolume = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVolume = Number(event.target.value);
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    const video = videoRef.current;
    if (!shell || !video) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (shell.requestFullscreen) {
      await shell.requestFullscreen();
      return;
    }

    const webkitVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    webkitVideo.webkitEnterFullscreen?.();
  };

  const selectPlaybackRate = (nextRate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
    setMenuOpen(false);
  };

  const handleShellKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") setMenuOpen(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const audibleVolume = isMuted ? 0 : volume;
  const style: VideoStyle = {
    "--ww-video-progress": `${progress}%`,
    "--ww-video-volume": `${audibleVolume * 100}%`,
  };

  return (
    <div
      ref={shellRef}
      className="wild-branded-video"
      style={style}
      onKeyDown={handleShellKeyDown}
      aria-label={ariaLabel}
    >
      <video
        ref={videoRef}
        className="wild-home-craftsmanship-video__player"
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setIsMuted(event.currentTarget.muted);
        }}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support HTML video.
      </video>

      {!isPlaying ? (
        <button
          type="button"
          className="wild-branded-video__center-control"
          onClick={togglePlayback}
          aria-label="Play video"
        >
          <Play aria-hidden fill="currentColor" />
        </button>
      ) : null}

      <div className="wild-branded-video__controls" role="group" aria-label="Video controls">
        <button
          type="button"
          className="wild-branded-video__control"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause video" : "Play video"}
        >
          {isPlaying ? <Pause aria-hidden fill="currentColor" /> : <Play aria-hidden fill="currentColor" />}
        </button>

        <span className="wild-branded-video__time" aria-label={`${formatTime(currentTime)} of ${formatTime(duration)}`}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <label className="wild-branded-video__range-wrap wild-branded-video__range-wrap--progress">
          <span className="sr-only">Video position</span>
          <input
            className="wild-branded-video__range wild-branded-video__range--progress"
            type="range"
            min="0"
            max={duration || 0}
            step="0.05"
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
        </label>

        <button
          type="button"
          className="wild-branded-video__control"
          onClick={toggleMute}
          aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
        >
          {isMuted || volume === 0 ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
        </button>

        <label className="wild-branded-video__range-wrap wild-branded-video__range-wrap--volume">
          <span className="sr-only">Volume</span>
          <input
            className="wild-branded-video__range wild-branded-video__range--volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={audibleVolume}
            onChange={handleVolume}
          />
        </label>

        <button
          type="button"
          className="wild-branded-video__control"
          onClick={toggleFullscreen}
          aria-label="View video fullscreen"
        >
          <Maximize aria-hidden />
        </button>

        <div className="wild-branded-video__menu-wrap">
          <button
            type="button"
            className="wild-branded-video__control"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Video playback options"
            aria-expanded={menuOpen}
          >
            <MoreVertical aria-hidden />
          </button>
          {menuOpen ? (
            <div className="wild-branded-video__menu" role="menu" aria-label="Playback speed">
              <span className="wild-branded-video__menu-title">Speed</span>
              {playbackRates.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  role="menuitemradio"
                  aria-checked={playbackRate === rate}
                  className="wild-branded-video__rate"
                  onClick={() => selectPlaybackRate(rate)}
                >
                  {rate === 1 ? "Normal" : `${rate}×`}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
