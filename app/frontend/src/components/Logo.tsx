import React from 'react';

/**
 * Canonical NextAlloc brand mark — the authorised logo.png.
 *
 * Sized with a container that frames the official artwork cleanly without
 * distortion, stretching, or excessive outer whitespace.
 */
export function Logo({
  width = 210,
  tile = false,
  className = '',
}: {
  width?: number;
  tile?: boolean;
  className?: string;
}) {
  const containerWidth = width;
  const containerHeight = Math.round(containerWidth / 4.6);
  const imgWidth = Math.round(containerWidth * 1.18);
  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-white ${
        tile ? 'shadow-md shadow-black/10 ring-1 ring-white/20 px-3 py-2' : 'shadow-sm ring-1 ring-navy-900/10'
      } ${className}`}
      style={{ width: containerWidth, height: containerHeight }}
    >
      <img
        src="/logo.png"
        alt="NextAlloc — AI-Powered Internship Allocation Engine"
        className="absolute max-w-none select-none"
        style={{
          width: imgWidth,
          height: 'auto',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        draggable={false}
      />
    </div>
  );
}

/**
 * Compact horizontal lockup for tight sidebar and header bars.
 *
 * Uses the canonical logo.png scaled and centered within a subtle rounded white plate
 * so it reads with maximum contrast and crispness against the dark sidebar glass.
 */
export function LogoMark({
  height = 38,
  className = '',
}: {
  /** Rendered height of the logo container, in px. Width scales automatically. */
  height?: number;
  className?: string;
}) {
  const containerHeight = height;
  const containerWidth = Math.round(containerHeight * 4.9);
  const imgWidth = Math.round(containerWidth * 1.18);
  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/10 ${className}`}
      style={{ width: containerWidth, height: containerHeight }}
    >
      <img
        src="/logo.png"
        alt="NextAlloc"
        className="absolute max-w-none select-none"
        style={{
          width: imgWidth,
          height: 'auto',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        draggable={false}
      />
    </div>
  );
}
