import React, { useState, useRef } from "react";
import { motion } from "framer-motion";

interface MapDot {
  x: number;
  y: number;
  city: string;
  internships: number;
}

export function IndiaMap() {
  // realistic-ish approximate positions (0-100 coordinate system)
  const locations: MapDot[] = [
    { x: 50, y: 16, city: "Delhi", internships: 8500 },
    { x: 30, y: 52, city: "Mumbai", internships: 12000 },
    { x: 60, y: 68, city: "Bangalore", internships: 15000 },
    { x: 71, y: 70, city: "Chennai", internships: 6500 },
    { x: 62, y: 55, city: "Hyderabad", internships: 9000 },
    { x: 84, y: 36, city: "Kolkata", internships: 5500 },
    { x: 46, y: 29, city: "Jaipur", internships: 3200 },
    { x: 26, y: 40, city: "Ahmedabad", internships: 4800 },
    { x: 48, y: 86, city: "Kochi", internships: 2800 },
    { x: 92, y: 30, city: "Guwahati", internships: 1500 },
    { x: 40, y: 58, city: "Pune", internships: 7500 },
    { x: 22, y: 44, city: "Surat", internships: 2200 },
  ];

  const [hover, setHover] = useState<{ city: string; x: number; y: number; internships: number } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const viewBoxSize = 100; // base viewbox (0..100)
  const half = (viewBoxSize / zoom) / 2;
  // center at (50,50)
  const vbX = 50 - half;
  const vbY = 50 - half;

  function onMarkerEnter(e: React.MouseEvent, loc: MapDot) {
    const clientX = e.clientX;
    const clientY = e.clientY;
    setHover({ city: loc.city, x: clientX, y: clientY, internships: loc.internships });
  }

  function onMarkerMove(e: React.MouseEvent, loc: MapDot) {
    setHover({ city: loc.city, x: e.clientX, y: e.clientY, internships: loc.internships });
  }

  function onMarkerLeave() {
    setHover(null);
  }

  function togglePin(city: string) {
    setPinned((prev) => (prev === city ? null : city));
  }

  return (
    <div className="relative w-full max-w-3xl mx-auto aspect-[4/5]" aria-hidden={false}>
      {/* Zoom Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 bg-card/80 backdrop-blur p-2 rounded-md border">
        <button
          className="p-1 rounded bg-primary/90 text-primary-foreground text-sm"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
        >
          +
        </button>
        <button
          className="p-1 rounded bg-primary/30 text-primary text-sm"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
        >
          −
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${viewBoxSize / zoom} ${viewBoxSize / zoom}`}
        className="w-full h-full"
        role="img"
        aria-label="Interactive map of India showing internship concentrations"
        style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.08))" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.16" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* approximate india silhouette (kept intentionally simple so it's performant and self-contained) */}
        <path
          d="M30 5 L45 3 L55 8 L60 15 L58 25 L65 30 L60 40 L55 50 L58 60 L50 75 L45 85 L40 95 L35 100 L30 95 L25 85 L20 75 L15 60 L18 45 L15 35 L20 25 L25 15 Z"
          fill="url(#mapGradient)"
          stroke="hsl(var(--primary))"
          strokeWidth="0.5"
          className="opacity-95"
        />

        {/* markers */}
        {locations.map((loc, index) => {
          const cx = loc.x;
          const cy = loc.y;
          const isPinned = pinned === loc.city;
          return (
            <g key={loc.city} transform={`translate(0,0)`}>
              <motion.circle
                cx={cx}
                cy={cy}
                r={isPinned ? 4.5 : 3}
                fill={isPinned ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                stroke={isPinned ? "hsl(var(--accent))" : "transparent"}
                strokeWidth={isPinned ? 1 : 0}
                filter="url(#glow)"
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.9] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.12,
                }}
                onMouseEnter={(e) => onMarkerEnter(e, loc)}
                onMouseMove={(e) => onMarkerMove(e, loc)}
                onMouseLeave={onMarkerLeave}
                onClick={() => togglePin(loc.city)}
                style={{ cursor: "pointer" }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    togglePin(loc.city);
                  }
                }}
                aria-label={`${loc.city}: ${loc.internships.toLocaleString()} internships`}
              />

              {/* pulse ring */}
              <motion.circle
                cx={cx}
                cy={cy}
                r={6}
                fill={isPinned ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                opacity={isPinned ? 0.25 : 0.18}
                initial={{ scale: 0.6 }}
                animate={{ scale: [0.7, 1.4, 0.7] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: index * 0.12,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: Math.min(Math.max(hover.x - 120, 8), window.innerWidth - 240),
            top: Math.max(hover.y - 80, 8),
            width: 220,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border rounded-lg p-3 shadow-md"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-semibold text-sm text-foreground">{hover.city}</div>
              <div className="text-xs text-muted-foreground">{hover.internships.toLocaleString()} internships</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Click to pin this location.
            </div>
          </motion.div>
        </div>
      )}

      {/* pinned callout */}
      {pinned && (
        <div className="absolute left-4 bottom-4 z-30">
          <div className="bg-card border rounded-lg p-3 shadow-sm flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">{pinned}</div>
              <div className="text-xs text-muted-foreground">Pinned location — click marker to unpin</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IndiaMap;
