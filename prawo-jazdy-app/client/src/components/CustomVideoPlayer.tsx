import { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomVideoPlayerProps {
  src: string;
  mode: "exam" | "practice" | "review";
  onEnded?: () => void;
  isAnswered?: boolean;
  className?: string;
}

export default function CustomVideoPlayer({
  src,
  mode,
  onEnded,
  isAnswered = false,
  className,
}: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // Reset state when source changes
  useEffect(() => {
    setIsPlaying(false);
    setIsEnded(false);
    setIsBuffering(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [src]);

  // Handle play/pause toggle
  const togglePlay = () => {
    if (mode === "exam") return; // Exam mode has automatic, non-interactive flow

    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch((err) => {
        console.error("Failed to play video:", err);
      });
    } else {
      video.pause();
    }
  };

  // Keyboard shortcut for Spacebar in practice mode
  useEffect(() => {
    if (mode !== "practice" || isAnswered) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // Prevent default spacebar action (scrolling)
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mode, isAnswered, isPlaying, isEnded]);

  const handlePlay = () => {
    setIsPlaying(true);
    setIsEnded(false);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    setIsEnded(true);
    if (onEnded) {
      onEnded();
    }
  };

  const isInteractive = mode === "practice" || mode === "review";

  return (
    <div
      onClick={isInteractive ? togglePlay : undefined}
      className={cn(
        "relative overflow-hidden group bg-black/90 aspect-video w-full rounded-none sm:rounded-lg flex items-center justify-center select-none",
        isInteractive ? "cursor-pointer" : "pointer-events-none",
        className
      )}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        playsInline
        autoPlay={mode === "exam"}
        controls={false}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleVideoEnded}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
      />

      {/* Buffering loader */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {/* Custom Control Overlay (Only for practice or review modes, when paused/ended) */}
      {isInteractive && !isPlaying && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center transition-all duration-300 z-10",
            isEnded ? "bg-transparent" : "bg-black/40 hover:bg-black/50"
          )}
        >
          <div
            className={cn(
              "w-16 h-16 rounded-full backdrop-blur-md flex items-center justify-center text-white scale-100 hover:scale-110 active:scale-95 transition-all duration-200 shadow-xl border",
              isEnded
                ? "bg-black/40 hover:bg-black/60 border-white/30"
                : "bg-white/10 hover:bg-white/20 border-white/20"
            )}
          >
            {isEnded ? (
              <RotateCcw className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 fill-white ml-1" />
            )}
          </div>
          <span className="mt-3 text-xs font-semibold text-white/95 tracking-wide uppercase drop-shadow-md bg-black/45 px-2 py-0.5 rounded-md">
            {isEnded
              ? "Odtwórz ponownie"
              : isPlaying
              ? "Wznów odtwarzanie"
              : "Odtwórz film"}
          </span>
          {mode === "practice" && (
            <span className="mt-1 text-[10px] text-white/80 tracking-wider drop-shadow-md bg-black/30 px-1.5 py-0.5 rounded">
              (Kliknij lub naciśnij Spację)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
