"use client";

import { useEffect, useState } from "react";

/**
 * A sun or moon that tracks the real local time, arcing across the Today
 * hero — up at midday, down at the horizons, with the hero's glow following
 * it and shifting warm (day) to cool (night). Client-only: the page is
 * server-rendered in UTC, so the time of day must come from the browser.
 */
type Phase = "night" | "dawn" | "day" | "dusk";

function phaseFor(hour: number): Phase {
  if (hour < 5 || hour >= 20) return "night";
  if (hour < 8) return "dawn";
  if (hour < 17) return "day";
  return "dusk";
}

const GLOW: Record<Phase, string> = {
  night: "#D8DBEE",
  dawn: "#F6D6BE",
  day: "#F6E3C6",
  dusk: "#F4CBA6",
};

export function SkyArc() {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setMinutes(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Flip after first paint so the body sweeps from the horizon into place.
  useEffect(() => {
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  if (minutes === null) {
    // Server + first client paint: a neutral warm glow, no time-specific bits.
    return (
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 85% at 50% 8%, var(--bg-glow), transparent 72%)",
        }}
      />
    );
  }

  const hour = minutes / 60;
  const isDay = hour >= 6 && hour < 18;
  // Day maps 6h→18h across the arc; night maps 18h→6h.
  const progress = isDay ? (hour - 6) / 12 : ((hour + 6) % 24) / 12;
  const phase = phaseFor(hour);

  const targetX = 8 + progress * 84; // 8%..92%
  const targetTop = 82 - Math.sin(progress * Math.PI) * 60; // 82%..22%..82%
  const x = mounted ? targetX : 6;
  const top = mounted ? targetTop : 86;

  const stars = [
    [18, 30],
    [34, 18],
    [62, 22],
    [78, 34],
    [88, 16],
    [48, 12],
  ];

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl">
      {/* Glow follows the body's horizontal position */}
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{
          background: `radial-gradient(ellipse 70% 85% at ${x}% 6%, ${GLOW[phase]}, transparent 72%)`,
        }}
      />

      {/* Stars at night */}
      {!isDay &&
        stars.map(([sx, sy], i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white sky-twinkle"
            style={{
              left: `${sx}%`,
              top: `${sy}%`,
              animationDelay: `${i * 0.6}s`,
              boxShadow: "0 0 4px rgba(255,255,255,0.8)",
            }}
          />
        ))}

      {/* The sun or moon */}
      <div
        className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[1400ms] ease-out"
        style={{ left: `${x}%`, top: `${top}%` }}
      >
        {isDay ? (
          <div
            className="h-full w-full rounded-full"
            style={{
              background: "radial-gradient(circle at 35% 35%, #F7D98A, #E9A23B)",
              boxShadow:
                "0 0 22px 6px rgba(233,162,59,0.45), 0 0 8px 2px rgba(233,162,59,0.6)",
            }}
          />
        ) : (
          <div
            className="h-full w-full rounded-full"
            style={{
              background: "radial-gradient(circle at 34% 32%, #FBFBFF, #C9CEE6)",
              boxShadow:
                "inset -5px -4px 0 0 rgba(150,156,190,0.35), 0 0 18px 5px rgba(180,188,224,0.5)",
            }}
          />
        )}
      </div>
    </div>
  );
}
