import type { CSSProperties } from "react";

export type PlanoraIconProps = {
  size?: number;
};

export type PlanoraLogoProps = {
  width?: number;
  className?: string;
  style?: CSSProperties;
};

export function PlanoraIcon({ size = 32 }: PlanoraIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="planora-icon-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="100%" stopColor="#9810FA" />
        </linearGradient>
        <linearGradient id="planora-icon-b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
        <linearGradient id="planora-icon-c" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="50%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
        <linearGradient id="planora-icon-d" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="55%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
      </defs>

      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke="#9810FA"
        strokeWidth="1.5"
        strokeOpacity="0.14"
      />
      <circle
        cx="100"
        cy="100"
        r="56"
        fill="none"
        stroke="#155DFC"
        strokeWidth="1.2"
        strokeOpacity="0.11"
      />
      <path
        d="M 100 12 A 88 88 0 0 0 25 163"
        fill="none"
        stroke="url(#planora-icon-a)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M 100 12 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="url(#planora-icon-b)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M 100 44 A 56 56 0 1 1 64 148"
        fill="none"
        stroke="url(#planora-icon-a)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="100" cy="100" r="28" fill="url(#planora-icon-c)" />
      <text
        x="100"
        y="104"
        fontSize="30"
        fontWeight="700"
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        P
      </text>
      <circle cx="100" cy="12" r="8" fill="url(#planora-icon-a)" />
      <circle cx="100" cy="12" r="4" fill="white" />
      <circle cx="188" cy="100" r="8" fill="url(#planora-icon-b)" />
      <circle cx="188" cy="100" r="4" fill="white" />
      <circle cx="25" cy="163" r="6" fill="#9810FA" opacity="0.55" />
    </svg>
  );
}

export function PlanoraLogo({ width = 160, className, style }: PlanoraLogoProps) {
  const height = (width * 200) / 520;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 520 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible", ...style }}
    >
      <defs>
        <linearGradient id="planora-logo-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="100%" stopColor="#9810FA" />
        </linearGradient>
        <linearGradient id="planora-logo-b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
        <linearGradient id="planora-logo-c" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="50%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
        <linearGradient id="planora-logo-d" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="55%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
      </defs>

      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke="#9810FA"
        strokeWidth="1.5"
        strokeOpacity="0.14"
      />
      <circle
        cx="100"
        cy="100"
        r="56"
        fill="none"
        stroke="#155DFC"
        strokeWidth="1.2"
        strokeOpacity="0.11"
      />
      <path
        d="M 100 12 A 88 88 0 0 0 25 163"
        fill="none"
        stroke="url(#planora-logo-a)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M 100 12 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="url(#planora-logo-b)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M 100 44 A 56 56 0 1 1 64 148"
        fill="none"
        stroke="url(#planora-logo-a)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="100" cy="100" r="28" fill="url(#planora-logo-c)" />
      <text
        x="100"
        y="104"
        fontSize="30"
        fontWeight="700"
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        P
      </text>
      <circle cx="100" cy="12" r="8" fill="url(#planora-logo-a)" />
      <circle cx="100" cy="12" r="4" fill="white" />
      <circle cx="188" cy="100" r="8" fill="url(#planora-logo-b)" />
      <circle cx="188" cy="100" r="4" fill="white" />
      <circle cx="25" cy="163" r="6" fill="#9810FA" opacity="0.55" />

      <text x="220" y="120" fontSize="52" fontWeight="800" fill="url(#planora-logo-d)">
        planora
      </text>
      <text x="220" y="148" fontSize="10.5" fill="#9810FA" opacity="0.55">
        PLAN · TRACK · SHIP
      </text>
    </svg>
  );
}

export default PlanoraLogo;

export function PlanoraIconMark({ size = 32 }: PlanoraIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="planora-icon-mark-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="100%" stopColor="#9810FA" />
        </linearGradient>
        <linearGradient id="planora-icon-mark-b" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
        <linearGradient id="planora-icon-mark-c" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="50%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
        <linearGradient id="planora-icon-mark-d" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#155DFC" />
          <stop offset="55%" stopColor="#9810FA" />
          <stop offset="100%" stopColor="#F6339A" />
        </linearGradient>
      </defs>

      <path
        d="M 100 12 A 88 88 0 0 0 25 163"
        fill="none"
        stroke="url(#planora-icon-mark-a)"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.70"
      />
      <path
        d="M 100 12 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="url(#planora-icon-mark-b)"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.70"
      />
      <path
        d="M 100 44 A 56 56 0 1 1 64 148"
        fill="none"
        stroke="url(#planora-icon-mark-a)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="100" cy="100" r="28" fill="url(#planora-icon-mark-c)" />
      <text
        x="100"
        y="104"
        fontSize="30"
        fontWeight="700"
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        P
      </text>
      <circle cx="100" cy="12" r="8" fill="url(#planora-icon-mark-a)" />
      <circle cx="100" cy="12" r="4" fill="white" />
      <circle cx="188" cy="100" r="8" fill="url(#planora-icon-mark-b)" />
      <circle cx="188" cy="100" r="4" fill="white" />
      <circle cx="25" cy="163" r="6" fill="#9810FA" opacity="0.55" />
    </svg>
  );
}
