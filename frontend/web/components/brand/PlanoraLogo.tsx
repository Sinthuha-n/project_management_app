'use client';

import { useId, type CSSProperties } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Planora brand mark — "the delivery track"
   ───────────────────────────────────────────────────────────────
   No letterform. The mark is the product: a rising three-stage
   track (backlog → in progress → done) with a task card riding it.
   The track lights up behind the card as it climbs, so the mark
   doubles as a progress meter, and the card pops when it reaches
   the top — work shipped. Then the board clears and the next one
   starts. That is the whole plan/track/ship loop in one glyph.

   Everything is drawn as geometry — no <text>, no fonts — so it
   renders identically on every OS from a 16px favicon up to a
   hero lockup. Ids are namespaced with useId() so instances can
   never collide, and the animation is scoped to this component
   through an inline <style>, keeping the mark self-contained.
   ═══════════════════════════════════════════════════════════════ */

const BRAND_BLUE = '#155DFC';
const BRAND_VIOLET = '#9810FA';
const BRAND_PINK = '#F6339A';

/**
 * The track: three treads joined by two risers, on a 48-unit grid,
 * optically centred on (24, 24). Every segment is 8 long, so the card's
 * travel and the progress dash offsets both step in multiples of 8.
 */
const TRACK_PATH = 'M 12 32 H 20 V 24 H 28 V 16 H 36';
const TRACK_LENGTH = 40;
const TRACK_WIDTH = 4.5;

/** Where the card starts, and where it ends up once shipped. */
const CARD_START = { x: 12, y: 32 };
const CARD_END = { x: 36, y: 16 };
const CARD_SIZE = 9;

const WORDMARK_FONT =
  "var(--font-inter), Inter, 'Segoe UI', system-ui, -apple-system, sans-serif";

export type PlanoraIconProps = {
  size?: number;
  /** Runs the plan→track→ship loop. Suppressed under prefers-reduced-motion. */
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible name. Omit to mark the icon decorative. */
  title?: string;
};

export type PlanoraLogoProps = {
  width?: number;
  className?: string;
  style?: CSSProperties;
  animated?: boolean;
  title?: string;
};

/**
 * useId() wraps its ids in punctuation that differs by React version —
 * colons on 18, guillemets on 19 — and none of it is legal in a CSS
 * selector or a url(#…) reference. Keep only selector-safe characters.
 */
function useMarkId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

type A11yProps = {
  role?: 'img';
  'aria-hidden'?: true;
  'aria-labelledby'?: string;
};

function a11yFor(title: string | undefined, titleId: string): A11yProps {
  return title ? { role: 'img', 'aria-labelledby': titleId } : { 'aria-hidden': true };
}

/* ── Shared defs ── */

function MarkDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-ramp`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={BRAND_BLUE} />
        <stop offset="52%" stopColor={BRAND_VIOLET} />
        <stop offset="100%" stopColor={BRAND_PINK} />
      </linearGradient>

      {/* Top-left light source: lifts the tile off flat colour. */}
      <radialGradient id={`${id}-gloss`} cx="26%" cy="18%" r="82%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>

      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
      </linearGradient>

      <clipPath id={`${id}-tile`}>
        <rect x="3" y="3" width="42" height="42" rx="13" />
      </clipPath>
    </defs>
  );
}

/* ── Scoped animation stylesheet ──────────────────────────────────
   The resting state lives in plain CSS (card shipped, track full), and
   the loop is layered on only under `no-preference`. That way anyone
   who asks for less motion gets a complete, correct mark rather than
   whatever frame the animation happened to stop on.                */

function MarkStyles({ id, animated }: { id: string; animated: boolean }) {
  return (
    <style>{`
      .${id}-card {
        transform: translate(24px, -16px);
        transform-origin: ${CARD_START.x}px ${CARD_START.y}px;
      }
      .${id}-progress {
        stroke-dasharray: ${TRACK_LENGTH};
        stroke-dashoffset: 0;
      }
      .${id}-burst {
        opacity: 0;
        transform-origin: ${CARD_END.x}px ${CARD_END.y}px;
      }
      ${
        animated
          ? `
      @media (prefers-reduced-motion: no-preference) {
        .${id}-card    { animation: ${id}-ride 7s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .${id}-progress{ animation: ${id}-fill 7s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
        .${id}-burst   { animation: ${id}-burst 7s ease-out infinite; }
        .${id}-sheen   { animation: ${id}-sheen 7s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
      }`
          : ''
      }

      @keyframes ${id}-ride {
        0%   { transform: translate(0px, 0px) scale(1); opacity: 0; }
        5%   { transform: translate(0px, 0px) scale(1); opacity: 1; }
        14%  { transform: translate(0px, 0px) scale(1); }
        26%  { transform: translate(8px, 0px) scale(1); }
        34%  { transform: translate(8px, -8px) scale(1); }
        42%  { transform: translate(8px, -8px) scale(1); }
        54%  { transform: translate(16px, -8px) scale(1); }
        62%  { transform: translate(16px, -16px) scale(1); }
        70%  { transform: translate(16px, -16px) scale(1); }
        80%  { transform: translate(24px, -16px) scale(1); }
        84%  { transform: translate(24px, -16px) scale(1.24); }
        89%  { transform: translate(24px, -16px) scale(1); }
        94%  { transform: translate(24px, -16px) scale(1); opacity: 1; }
        100% { transform: translate(24px, -16px) scale(1); opacity: 0; }
      }

      @keyframes ${id}-fill {
        0%   { stroke-dashoffset: ${TRACK_LENGTH}; opacity: 0; }
        5%   { stroke-dashoffset: ${TRACK_LENGTH}; opacity: 1; }
        14%  { stroke-dashoffset: ${TRACK_LENGTH}; }
        26%  { stroke-dashoffset: 32; }
        34%  { stroke-dashoffset: 24; }
        42%  { stroke-dashoffset: 24; }
        54%  { stroke-dashoffset: 16; }
        62%  { stroke-dashoffset: 8; }
        70%  { stroke-dashoffset: 8; }
        80%  { stroke-dashoffset: 0; }
        94%  { stroke-dashoffset: 0; opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 0; }
      }

      @keyframes ${id}-burst {
        0%, 80%   { transform: scale(0.5); opacity: 0; }
        84%       { opacity: 0.55; }
        93%, 100% { transform: scale(2.1); opacity: 0; }
      }

      @keyframes ${id}-sheen {
        0%   { transform: translateX(-34px); }
        26%  { transform: translateX(52px); }
        100% { transform: translateX(52px); }
      }
    `}</style>
  );
}

/* ── The glyph: track, progress, card, ship burst ── */

function TrackGlyph({
  id,
  stroke,
  cardFill,
  trackOpacity = 0.28,
}: {
  id: string;
  stroke: string;
  cardFill: string;
  trackOpacity?: number;
}) {
  return (
    <g>
      {/* The stages still to come. */}
      <path
        d={TRACK_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={TRACK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={trackOpacity}
      />

      {/* The stages already cleared — this is the progress meter. */}
      <path
        className={`${id}-progress`}
        d={TRACK_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={TRACK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.82"
      />

      {/* The moment of shipping. */}
      <circle
        className={`${id}-burst`}
        cx={CARD_END.x}
        cy={CARD_END.y}
        r="6.4"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
      />

      {/* The work item itself, riding the track. */}
      <rect
        className={`${id}-card`}
        x={CARD_START.x - CARD_SIZE / 2}
        y={CARD_START.y - CARD_SIZE / 2}
        width={CARD_SIZE}
        height={CARD_SIZE}
        rx="2.8"
        fill={cardFill}
      />
    </g>
  );
}

/* ── Gradient squircle tile: gloss, sheen, specular rim ── */

function MarkTile({ id, animated }: { id: string; animated: boolean }) {
  return (
    <>
      <rect x="3" y="3" width="42" height="42" rx="13" fill={`url(#${id}-ramp)`} />
      <rect x="3" y="3" width="42" height="42" rx="13" fill={`url(#${id}-gloss)`} />

      {animated ? (
        <g clipPath={`url(#${id}-tile)`}>
          <g transform="rotate(20 24 24)">
            <rect
              className={`${id}-sheen`}
              x="-6"
              y="-14"
              width="14"
              height="76"
              fill={`url(#${id}-sheen)`}
            />
          </g>
        </g>
      ) : null}

      {/* Inner specular rim — the detail that makes the tile read as glass. */}
      <rect
        x="3.6"
        y="3.6"
        width="40.8"
        height="40.8"
        rx="12.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.3"
        strokeWidth="1.2"
      />
    </>
  );
}

/* ═══════════════ Public components ═══════════════ */

/**
 * The app icon: gradient squircle + white delivery track.
 * Used in the sidebar and the compact nav.
 */
export function PlanoraIcon({
  size = 32,
  animated = true,
  className,
  style,
  title,
}: PlanoraIconProps) {
  const id = useMarkId('planora-icon');
  const titleId = `${id}-title`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      {...a11yFor(title, titleId)}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <MarkDefs id={id} />
      <MarkStyles id={id} animated={animated} />
      <MarkTile id={id} animated={animated} />
      <TrackGlyph id={id} stroke="#FFFFFF" cardFill="#FFFFFF" />
    </svg>
  );
}

/**
 * The tile-less mark: gradient track on a transparent ground, for placing
 * over solid brand colour where a second container would double up.
 */
export function PlanoraIconMark({
  size = 32,
  animated = true,
  className,
  style,
  title,
}: PlanoraIconProps) {
  const id = useMarkId('planora-mark');
  const titleId = `${id}-title`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      {...a11yFor(title, titleId)}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <MarkDefs id={id} />
      <MarkStyles id={id} animated={animated} />
      <TrackGlyph
        id={id}
        stroke={`url(#${id}-ramp)`}
        cardFill={`url(#${id}-ramp)`}
        trackOpacity={0.22}
      />
    </svg>
  );
}

/**
 * The horizontal lockup: mark + wordmark.
 * The wordmark is set in the app's own Inter stack so the logo and the
 * product UI share one voice.
 */
export function PlanoraLogo({
  width = 160,
  className,
  style,
  animated = true,
  title = 'Planora',
}: PlanoraLogoProps) {
  const id = useMarkId('planora-logo');
  const titleId = `${id}-title`;
  const height = (width * 120) / 370;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 370 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: 'visible', ...style }}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{title}</title>
      <MarkDefs id={id} />
      <MarkStyles id={id} animated={animated} />

      <linearGradient
        id={`${id}-word`}
        x1="118"
        y1="30"
        x2="350"
        y2="96"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor={BRAND_BLUE} />
        <stop offset="55%" stopColor={BRAND_VIOLET} />
        <stop offset="100%" stopColor={BRAND_PINK} />
      </linearGradient>

      {/* Mark, scaled 2× from its 48-unit grid and optically centred. */}
      <g transform="translate(6 12) scale(2)">
        <MarkTile id={id} animated={animated} />
        <TrackGlyph id={id} stroke="#FFFFFF" cardFill="#FFFFFF" />
      </g>

      <text
        x="118"
        y="79"
        fontFamily={WORDMARK_FONT}
        fontSize="58"
        fontWeight="800"
        letterSpacing="-2.2"
        fill={`url(#${id}-word)`}
      >
        planora
      </text>
    </svg>
  );
}

export default PlanoraLogo;
