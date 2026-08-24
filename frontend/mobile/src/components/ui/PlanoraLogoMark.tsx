import React from 'react';
import Svg, {
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

/* ═══════════════════════════════════════════════════════════════
   Planora brand mark — "the delivery track" (React Native)
   ───────────────────────────────────────────────────────────────
   The native twin of components/brand/PlanoraLogo.tsx on web. No
   letterform: a rising three-stage track (backlog → in progress →
   done) with a task card sitting at the top, shipped.

   The web mark animates the card up the track; React Native has no
   CSS animation, so this renders the mark's resting state — track
   complete, card delivered — which is exactly the frame the web
   mark holds between loops. Keep the two in sync when either
   changes.

   Gradient ids are namespaced per component: the icon and the
   wordmark are rendered side by side in BrandHeader, and both used
   to declare an id of "d".
   ═══════════════════════════════════════════════════════════════ */

const BRAND_BLUE = '#155DFC';
const BRAND_VIOLET = '#9810FA';
const BRAND_PINK = '#F6339A';

/** Three treads joined by two risers, on a 48-unit grid, centred on (24, 24). */
const TRACK_PATH = 'M 12 32 H 20 V 24 H 28 V 16 H 36';
const TRACK_WIDTH = 4.5;

/** Where the card comes to rest once it has shipped. */
const CARD_END = { x: 36, y: 16 };
const CARD_SIZE = 9;

interface PlanoraIconMarkProps {
  size?: number;
}

export function PlanoraIconMark({ size = 48 }: PlanoraIconMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <SvgLinearGradient id="pln-mark-ramp" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={BRAND_BLUE} />
          <Stop offset="52%" stopColor={BRAND_VIOLET} />
          <Stop offset="100%" stopColor={BRAND_PINK} />
        </SvgLinearGradient>

        {/* Top-left light source: lifts the tile off flat colour. */}
        <RadialGradient id="pln-mark-gloss" cx="26%" cy="18%" r="82%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.34} />
          <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.05} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Gradient squircle tile */}
      <Rect x={3} y={3} width={42} height={42} rx={13} fill="url(#pln-mark-ramp)" />
      <Rect x={3} y={3} width={42} height={42} rx={13} fill="url(#pln-mark-gloss)" />

      {/* Inner specular rim */}
      <Rect
        x={3.6}
        y={3.6}
        width={40.8}
        height={40.8}
        rx={12.5}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.3}
        strokeWidth={1.2}
      />

      <G>
        {/* The track, complete */}
        <Path
          d={TRACK_PATH}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={TRACK_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.82}
        />

        {/* The work item, shipped */}
        <Rect
          x={CARD_END.x - CARD_SIZE / 2}
          y={CARD_END.y - CARD_SIZE / 2}
          width={CARD_SIZE}
          height={CARD_SIZE}
          rx={2.8}
          fill="#FFFFFF"
        />
      </G>
    </Svg>
  );
}

interface PlanoraWordmarkProps {
  width?: number;
}

export function PlanoraWordmark({ width = 160 }: PlanoraWordmarkProps) {
  const height = (width * 78) / 250;

  return (
    <Svg width={width} height={height} viewBox="0 0 250 78">
      <Defs>
        <SvgLinearGradient id="pln-word-ramp" x1="0" y1="10" x2="240" y2="70" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={BRAND_BLUE} />
          <Stop offset="55%" stopColor={BRAND_VIOLET} />
          <Stop offset="100%" stopColor={BRAND_PINK} />
        </SvgLinearGradient>
      </Defs>

      <SvgText x={0} y={58} fontSize={58} fontWeight="800" fill="url(#pln-word-ramp)">
        planora
      </SvgText>
    </Svg>
  );
}
