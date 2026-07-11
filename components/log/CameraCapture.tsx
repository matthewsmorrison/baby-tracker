"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

/**
 * In-app camera with a dotted framing guide. Only the area inside the guide
 * box is captured — nothing outside the dotted line is ever saved — so
 * parents can be confident the baby stays out of the photo. After a shot the
 * parent confirms ("happy with this photo?") before it's used.
 */
export function CameraCapture({
  onCapture,
  onCancel,
  onUnavailable,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
  /** Called when the camera can't start (no permission / no device). */
  onUnavailable: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) onUnavailable();
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onUnavailable]);

  // Revoke the preview object URL when it's replaced or on unmount.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const box = boxRef.current;
    if (!video || !box || !video.videoWidth) return;

    // Map the guide box (element coords) back to intrinsic video pixels,
    // accounting for object-cover scaling and centring.
    const videoRect = video.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const scale = Math.max(
      videoRect.width / video.videoWidth,
      videoRect.height / video.videoHeight
    );
    const offsetX = (video.videoWidth * scale - videoRect.width) / 2;
    const offsetY = (video.videoHeight * scale - videoRect.height) / 2;

    const sx = (boxRect.left - videoRect.left + offsetX) / scale;
    const sy = (boxRect.top - videoRect.top + offsetY) / scale;
    const sw = boxRect.width / scale;
    const sh = boxRect.height / scale;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `nappy-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPreview({ url: URL.createObjectURL(blob), file });
      },
      "image/jpeg",
      0.85
    );
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {preview ? (
        /* Review the captured photo before using it */
        <>
          <div className="relative flex-1 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt="Captured nappy photo"
              className="absolute inset-0 h-full w-full object-contain"
            />
            <div className="absolute inset-x-0 top-0 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
              <p className="text-base font-semibold text-white">
                Happy with this photo?
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 bg-black px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/40 py-3 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Retake
            </button>
            <button
              type="button"
              onClick={() => onCapture(preview.file)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-black"
            >
              <Check className="h-4 w-4" />
              Use photo
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Live preview */}
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Shade everything OUTSIDE the guide box. The box is a tall
                portrait rectangle — nappies are long and thin. */}
            <div className="absolute inset-0 flex flex-col">
              <div className="flex-1 bg-black/60" />
              <div className="flex" style={{ height: "min(125vw, 72vh)" }}>
                <div className="flex-1 bg-black/60" />
                <div
                  ref={boxRef}
                  className="relative rounded-3xl border-2 border-dashed border-white/90"
                  style={{ width: "min(58vw, 42vh)" }}
                  aria-hidden
                />
                <div className="flex-1 bg-black/60" />
              </div>
              <div className="flex-1 bg-black/60" />
            </div>

            {/* Guidance */}
            <div className="absolute inset-x-0 top-0 px-6 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
              <p className="text-base font-semibold text-white">
                Fit the whole nappy inside the box — lengthways
              </p>
              <p className="mt-1 text-sm text-white/80">
                Please keep your baby out of the frame — only what’s inside the
                dotted line is saved.
              </p>
            </div>

            <button
              type="button"
              aria-label="Close camera"
              onClick={onCancel}
              className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-black/50 p-2.5 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Shutter */}
          <div className="flex items-center justify-center bg-black pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
            <button
              type="button"
              aria-label="Take photo"
              onClick={capture}
              disabled={!ready}
              className="rounded-full border-4 border-white/40 bg-white disabled:opacity-40"
              style={{ height: 68, width: 68 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
