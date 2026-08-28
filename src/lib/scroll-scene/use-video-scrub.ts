"use client";

/**
 * SCROLL-TIED VIDEO — the scrub engine.
 *
 * The film is never played. Scroll position IS the playhead: progress p through
 * the tall track maps linearly onto the clip's duration, and each animation frame
 * paints the nearest decoded frame to that time.
 *
 * Two paths, in this order of preference:
 *
 *  1. FRAME BANK (WebCodecs). The mp4 is fetched once, demuxed with mp4box, and
 *     every frame is decoded and re-encoded as a small webp blob keyed by its
 *     presentation timestamp. Painting then means picking the nearest blob and
 *     drawing it — no seeking at all, so scrubbing is smooth in both directions.
 *  2. FALLBACK. No VideoDecoder, reduced motion, a decode failure, or a build that
 *     takes longer than the watchdog allows: we drive `video.currentTime` instead
 *     and hide the canvas. Rougher, but it always shows something.
 *
 * The playhead is EASED, not snapped. `current` chases `target` with an
 * exponential lerp so a flicked wheel glides rather than jumping between frames —
 * the single most important detail in how this reads.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { MP4Info, MP4Sample } from "mp4box";

/** How fast the playhead chases the scroll target. Higher = tighter. */
const LERP_TAU = 8;
/** Below this gap in seconds, stop easing and sit exactly on the target. */
const SNAP = 0.002;
/** How many decoded bitmaps stay resident at once. */
const LRU_MAX = 24;
/** How far decode may run ahead of webp encoding, in frames. */
const LEAD = 24;
/** If the bank is not live within this long, give up and seek the video. */
const WATCHDOG = 60000;

type BankEntry = { ts: number; blob: Blob };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Binary search for the frame whose timestamp is closest to t seconds. */
function nearestIndex(bank: BankEntry[], t: number): number {
  const micro = t * 1e6;
  let low = 0;
  let high = bank.length - 1;
  if (high < 0) return -1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (bank[mid].ts < micro) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && Math.abs(bank[low - 1].ts - micro) < Math.abs(bank[low].ts - micro)) {
    return low - 1;
  }
  return low;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type VideoScrub = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** 0 → 1 through the scroll track. */
  scrollProgress: number;
  /** True once the canvas has painted a real frame; fades it in over the video. */
  canvasLive: boolean;
};

export function useVideoScrub(videoSrc: string): VideoScrub {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [canvasLive, setCanvasLive] = useState(false);

  /** Decoded webp frames, sorted by timestamp. */
  const bankRef = useRef<BankEntry[]>([]);
  /** index → bitmap (null while a decode of that index is in flight). */
  const lruRef = useRef<Map<number, ImageBitmap | null>>(new Map());
  const readyRef = useRef(false);
  const paintedRef = useRef(false);
  const buildingRef = useRef(false);

  const currentRef = useRef(0);
  const targetRef = useRef(0);
  const durRef = useRef(0);
  const spanRef = useRef(1);
  const seekingRef = useRef(false);
  const drawnRef = useRef(-1);

  const measureSpan = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    spanRef.current = Math.max(1, el.offsetHeight - window.innerHeight);
  }, []);

  const getProgress = useCallback(() => {
    const y = window.scrollY;
    return Math.min(1, Math.max(0, y / spanRef.current));
  }, []);

  useEffect(() => {
    measureSpan();
    const onResize = () => measureSpan();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [measureSpan]);

  /** Bring bitmaps for i-1..i+2 into the LRU and evict the oldest beyond the cap. */
  const warmLRU = useCallback((index: number) => {
    const bank = bankRef.current;
    const lru = lruRef.current;
    for (let i = index - 1; i <= index + 2; i += 1) {
      if (i < 0 || i >= bank.length || lru.has(i)) continue;
      lru.set(i, null);
      void createImageBitmap(bank[i].blob)
        .then((bitmap) => {
          if (lru.has(i)) lru.set(i, bitmap);
          else bitmap.close();
        })
        .catch(() => {
          lru.delete(i);
        });
    }
    while (lru.size > LRU_MAX) {
      const oldest = lru.keys().next();
      if (oldest.done) break;
      const bitmap = lru.get(oldest.value);
      if (bitmap) bitmap.close();
      lru.delete(oldest.value);
    }
  }, []);

  /* ── the paint loop ──────────────────────────────────────────────────────── */

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const reduced = prefersReducedMotion();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const p = getProgress();
      setScrollProgress(p);

      const dur = durRef.current;
      if (dur > 0) {
        targetRef.current = p * dur;
        if (reduced) {
          currentRef.current = targetRef.current;
        } else {
          currentRef.current +=
            (targetRef.current - currentRef.current) * (1 - Math.exp(-dt * LERP_TAU));
          if (Math.abs(targetRef.current - currentRef.current) < SNAP) {
            currentRef.current = targetRef.current;
          }
        }

        if (readyRef.current) {
          const index = nearestIndex(bankRef.current, currentRef.current);
          if (index >= 0) {
            warmLRU(index);
            const bitmap = lruRef.current.get(index);
            const canvas = canvasRef.current;
            if (bitmap && canvas && drawnRef.current !== index) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                drawnRef.current = index;
                if (!paintedRef.current) {
                  paintedRef.current = true;
                  setCanvasLive(true);
                }
              }
            }
          }
        } else {
          const video = videoRef.current;
          if (video && !seekingRef.current) {
            if (Math.abs(video.currentTime - currentRef.current) > 0.01) {
              seekingRef.current = true;
              try {
                video.currentTime = currentRef.current;
              } catch {
                seekingRef.current = false;
              }
            }
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getProgress, warmLRU]);

  /* ── the video element: duration source and fallback surface ─────────────── */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) durRef.current = video.duration;
      measureSpan();
    };
    const onSeeked = () => {
      seekingRef.current = false;
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onSeeked);
    if (video.readyState >= 1) onMeta();
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onSeeked);
    };
  }, [measureSpan]);

  /* ── the frame bank ──────────────────────────────────────────────────────── */

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;
    if (typeof VideoDecoder === "undefined") return;
    if (buildingRef.current) return;

    let cancelled = false;
    let watchdog: number | undefined;

    // Give up on the frame bank: hide the canvas and let the video element's
    // own seeking carry the scrub from here.
    const revert = () => {
      readyRef.current = false;
      paintedRef.current = false;
      setCanvasLive(false);
    };

    const build = async () => {
      buildingRef.current = true;
      watchdog = window.setTimeout(() => {
        if (!readyRef.current) revert();
      }, WATCHDOG);

      // mp4box ships CommonJS, so accept it whether the bundler hands back the
      // namespace or a default-wrapped object.
      const imported = await import("mp4box");
      const mp4box = (imported as unknown as { default?: typeof imported }).default ?? imported;
      const { createFile, DataStream } = mp4box;

      const response = await fetch(videoSrc, { mode: "cors" });
      if (!response.ok) throw new Error(`fetch ${response.status}`);
      const raw = await response.arrayBuffer();
      if (cancelled) return;

      const buffer = raw as import("mp4box").MP4ArrayBuffer;
      buffer.fileStart = 0;

      const file = createFile();
      const samples: MP4Sample[] = [];

      // Demux ONCE. onSamples is armed before the buffer is appended, and
      // extraction starts from inside onReady, which is the only order in which
      // mp4box actually hands the samples over.
      const info = await new Promise<MP4Info>((resolve, reject) => {
        file.onError = (error) => reject(new Error(error));
        file.onSamples = (_trackId, _user, chunk) => {
          for (const sample of chunk) samples.push(sample);
        };
        file.onReady = (parsed) => {
          const track = parsed.videoTracks[0];
          if (!track) {
            reject(new Error("no video track"));
            return;
          }
          file.setExtractionOptions(track.id, null, {
            nbSamples: track.nb_samples || 1_000_000,
          });
          file.start();
          resolve(parsed);
        };
        file.appendBuffer(buffer);
        file.flush();
      });

      if (cancelled) return;
      const track = info.videoTracks[0];
      if (samples.length === 0) throw new Error("no samples");

      const entry = file.getTrackById(track.id)?.mdia.minf.stbl.stsd.entries[0];
      const box = entry?.avcC ?? entry?.hvcC ?? entry?.vpcC ?? entry?.av1C;
      let description: Uint8Array | undefined;
      if (box) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        box.write(stream);
        description = new Uint8Array(stream.buffer, 8);
      }

      const off = document.createElement("canvas");
      let offCtx: CanvasRenderingContext2D | null = null;

      /** One decode pass. `software` is the retry after a hardware failure. */
      const pass = async (software: boolean) => {
        const bank: BankEntry[] = [];
        let encoding = 0;
        let decoded = 0;
        let failure: Error | null = null;

        const store = (frame: VideoFrame) =>
          new Promise<void>((resolve) => {
            if (!offCtx) {
              off.width = frame.displayWidth;
              off.height = frame.displayHeight;
              offCtx = off.getContext("2d");
            }
            const ts = frame.timestamp ?? 0;
            if (!offCtx) {
              frame.close();
              encoding -= 1;
              resolve();
              return;
            }
            offCtx.drawImage(frame, 0, 0, off.width, off.height);
            frame.close();
            off.toBlob(
              (blob) => {
                if (blob) bank.push({ ts, blob });
                encoding -= 1;
                resolve();
              },
              "image/webp",
              0.82,
            );
          });

        const decoder = new VideoDecoder({
          output: (frame) => {
            decoded += 1;
            encoding += 1;
            void store(frame);
          },
          error: (error) => {
            failure = error instanceof Error ? error : new Error(String(error));
          },
        });

        decoder.configure({
          codec: track.codec,
          codedWidth: track.video?.width,
          codedHeight: track.video?.height,
          description,
          ...(software ? { hardwareAcceleration: "prefer-software" as const } : {}),
        });

        try {
          for (const sample of samples) {
            if (cancelled || failure) break;
            // Never let decoding outrun webp encoding: a long clip would
            // otherwise hold thousands of live frames in memory at once.
            while (encoding > LEAD && !cancelled && !failure) await sleep(8);
            decoder.decode(
              new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: (sample.cts * 1e6) / sample.timescale,
                duration: (sample.duration * 1e6) / sample.timescale,
                data: sample.data as unknown as BufferSource,
              }),
            );
          }
          if (failure) throw failure;
          await decoder.flush();
          while (encoding > 0 && !cancelled) await sleep(8);
        } finally {
          if (decoder.state !== "closed") decoder.close();
        }

        if (decoded === 0 || bank.length === 0) throw new Error("decoded nothing");
        return bank;
      };

      let bank: BankEntry[];
      try {
        bank = await pass(false);
      } catch {
        if (cancelled) return;
        bank = await pass(true);
      }

      if (cancelled) return;
      bank.sort((a, b) => a.ts - b.ts);
      bankRef.current = bank;
      drawnRef.current = -1;
      readyRef.current = true;
      if (watchdog) window.clearTimeout(watchdog);
    };

    const start = () => {
      void build().catch(() => {
        if (!cancelled) revert();
      });
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    const lru = lruRef.current;
    return () => {
      cancelled = true;
      if (watchdog) window.clearTimeout(watchdog);
      window.removeEventListener("load", start);
      for (const bitmap of lru.values()) bitmap?.close();
      lru.clear();
    };
  }, [videoSrc]);

  return {
    containerRef,
    videoRef,
    canvasRef,
    scrollProgress,
    canvasLive,
  };
}
