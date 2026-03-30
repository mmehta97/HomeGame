'use client';

import { Card as CardType } from '@/types';
import { useFourColor } from './DeckColorContext';

const SUIT_2C: Record<string, { sym: string; color: string }> = {
  h: { sym: '\u2665', color: '#E5343A' },
  d: { sym: '\u2666', color: '#E5343A' },
  c: { sym: '\u2663', color: '#1C1C1C' },
  s: { sym: '\u2660', color: '#1C1C1C' },
};
const SUIT_4C: Record<string, { sym: string; color: string }> = {
  h: { sym: '\u2665', color: '#E5343A' },
  d: { sym: '\u2666', color: '#3B7BF6' },
  c: { sym: '\u2663', color: '#2D9F4E' },
  s: { sym: '\u2660', color: '#1C1C1C' },
};

const RANK: Record<string, string> = {
  '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
  'T':'10','J':'J','Q':'Q','K':'K','A':'A',
};

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  fourColor?: boolean;
}

// PokerNow-style card dimensions
const D = {
  sm: { w: 32, h: 44, r: 14, s: 11, gap: -1, pad: 3, radius: 3 },
  md: { w: 48, h: 66, r: 19, s: 14, gap: -1, pad: 4, radius: 4 },
  lg: { w: 58, h: 80, r: 23, s: 17, gap: -1, pad: 5, radius: 5 },
};

export default function Card({ card, faceDown = false, size = 'md', className = '', style, fourColor: fp }: CardProps) {
  const fc = useFourColor();
  const use4c = fp ?? fc;
  const d = D[size];

  // Face down
  if (faceDown || !card) {
    return (
      <div className={className} style={{
        width: d.w, height: d.h, borderRadius: d.radius,
        background: '#2B2D52',
        border: '1px solid #3D3F6A',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        ...style,
      }} />
    );
  }

  const suit = use4c ? SUIT_4C[card.suit] : SUIT_2C[card.suit];

  return (
    <div className={className} style={{
      position: 'relative',
      width: d.w, height: d.h, borderRadius: d.radius,
      background: '#FFFFFF',
      border: '1px solid #D8D8D0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      userSelect: 'none',
      ...style,
    }}>
      <div style={{
        position: 'absolute', top: d.pad, left: d.pad,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        lineHeight: 1,
      }}>
        <span style={{
          fontSize: d.r, fontWeight: 700, color: suit.color,
          fontFamily: "'Inter', -apple-system, sans-serif",
          lineHeight: 1,
        }}>{RANK[card.rank]}</span>
        <span style={{
          fontSize: d.s, color: suit.color, lineHeight: 1,
          marginTop: d.gap,
        }}>{suit.sym}</span>
      </div>
    </div>
  );
}
