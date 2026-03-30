'use client';

import React from 'react';
import type { HandHistoryEntry, Card } from '@/types';

interface GameLogProps {
  history: HandHistoryEntry[];
  isOpen: boolean;
  onClose: () => void;
}

function formatCard(card: Card): string {
  const suitSymbols: Record<string, string> = {
    h: '\u2665',
    d: '\u2666',
    c: '\u2663',
    s: '\u2660',
  };
  return `${card.rank}${suitSymbols[card.suit] ?? card.suit}`;
}

function getActionColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('fold')) return '#6b7280';
  if (lower.includes('raise') || lower.includes('all-in') || lower.includes('all in'))
    return '#da3633';
  if (lower.includes('call')) return '#2ea043';
  if (lower.includes('check')) return '#388bfd';
  if (lower.includes('win') || lower.includes('won')) return '#e8b730';
  return '#d1d5db';
}

export default function GameLog({ history, isOpen, onClose }: GameLogProps) {
  // Group entries by hand number
  const grouped: { handNumber: number; entries: HandHistoryEntry[] }[] = [];
  let currentHand: number | null = null;

  for (const entry of history) {
    if (entry.handNumber !== currentHand) {
      currentHand = entry.handNumber;
      grouped.push({ handNumber: entry.handNumber, entries: [entry] });
    } else {
      grouped[grouped.length - 1].entries.push(entry);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 280,
        backgroundColor: '#0e1015',
        borderLeft: '1px solid #1c2028',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease-in-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #1c2028',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#d1d5db', fontSize: 15, fontWeight: 600 }}>
          Game Log
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
        }}
      >
        {grouped.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            No hands played yet.
          </p>
        )}

        {grouped.map((group) => (
          <div key={group.handNumber} style={{ marginBottom: 12 }}>
            {/* Hand number header */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '6px 0 4px',
                borderBottom: '1px solid #1c2028',
                marginBottom: 4,
              }}
            >
              Hand #{group.handNumber}
            </div>

            {group.entries.map((entry, i) => (
              <div
                key={`${group.handNumber}-${i}`}
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: '3px 0',
                  color: '#d1d5db',
                }}
              >
                {entry.playerName && (
                  <span style={{ fontWeight: 600, color: '#d1d5db' }}>
                    {entry.playerName}{' '}
                  </span>
                )}
                <span style={{ color: getActionColor(entry.action) }}>
                  {entry.action}
                </span>
                {entry.amount != null && entry.amount > 0 && (
                  <span style={{ color: '#e8b730', fontWeight: 500 }}>
                    {' '}
                    {entry.amount}
                  </span>
                )}
                {entry.cards && entry.cards.length > 0 && (
                  <span style={{ color: '#6b7280' }}>
                    {' '}
                    [{entry.cards.map(formatCard).join(' ')}]
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
