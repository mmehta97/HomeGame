'use client';

import { Card as CardType } from '@/types';

const SUIT_MAP: Record<string, { symbol: string; color: string }> = {
  h: { symbol: '\u2665', color: '#dc2626' },
  d: { symbol: '\u2666', color: '#dc2626' },
  c: { symbol: '\u2663', color: '#1a1a1a' },
  s: { symbol: '\u2660', color: '#1a1a1a' },
};

const RANK_DISPLAY: Record<string, string> = {
  'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
};

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

const DIMS = {
  sm: { w: 36, h: 50, rank: 11, suitSm: 8, suitLg: 18, pad: 3 },
  md: { w: 52, h: 72, rank: 14, suitSm: 10, suitLg: 26, pad: 4 },
  lg: { w: 64, h: 88, rank: 17, suitSm: 12, suitLg: 32, pad: 5 },
};

export default function Card({ card, faceDown = false, size = 'md', className = '', style }: CardProps) {
  const d = DIMS[size];

  // Face-down card
  if (faceDown || !card) {
    return (
      <div className={`rounded-md overflow-hidden ${className}`}
        style={{
          width: d.w, height: d.h,
          background: 'linear-gradient(145deg, #1e3a8a 0%, #1e40af 40%, #1d4ed8 100%)',
          border: '1.5px solid rgba(59,130,246,0.4)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          ...style,
        }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div style={{ width: '55%', height: '65%', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 3px)',
          }} />
        </div>
      </div>
    );
  }

  const { symbol, color } = SUIT_MAP[card.suit];
  const rank = RANK_DISPLAY[card.rank];

  return (
    <div className={`rounded-md overflow-hidden select-none ${className}`}
      style={{
        position: 'relative',
        width: d.w, height: d.h,
        background: 'linear-gradient(180deg, #ffffff 0%, #f9f9f7 100%)',
        border: '1px solid #d4d4cc',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        ...style,
      }}
    >
      {/* Top-left corner: rank then small suit below it */}
      <div style={{
        position: 'absolute',
        top: d.pad,
        left: d.pad,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{ fontSize: d.rank, fontWeight: 800, color, lineHeight: 1 }}>{rank}</span>
        <span style={{ fontSize: d.suitSm, color, lineHeight: 1, marginTop: -1 }}>{symbol}</span>
      </div>

      {/* Center: large suit */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: d.suitLg, color, lineHeight: 1 }}>{symbol}</span>
      </div>

    </div>
  );
}
