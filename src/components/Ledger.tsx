'use client';

import React from 'react';
import type { LedgerEntry } from '@/types';

interface LedgerProps {
  ledger: LedgerEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export default function Ledger({ ledger, isOpen, onClose }: LedgerProps) {
  const sorted = [...ledger].sort((a, b) => b.netResult - a.netResult);
  const totalPot = ledger.reduce((sum, e) => sum + e.buyIns, 0);

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
          Ledger
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

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto',
          gap: 6,
          padding: '8px 12px 4px',
          fontSize: 10,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: '1px solid #1c2028',
        }}
      >
        <span>Player</span>
        <span style={{ textAlign: 'right' }}>Buy-in</span>
        <span style={{ textAlign: 'right' }}>Stack</span>
        <span style={{ textAlign: 'right' }}>Net</span>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px',
        }}
      >
        {sorted.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            No player data yet.
          </p>
        )}

        {sorted.map((entry) => {
          const netColor =
            entry.netResult > 0
              ? '#2ea043'
              : entry.netResult < 0
                ? '#da3633'
                : '#6b7280';
          const netPrefix = entry.netResult > 0 ? '+' : '';
          const stack = entry.isActive
            ? entry.buyIns + entry.netResult
            : entry.cashOut;

          return (
            <div
              key={entry.playerId}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                gap: 6,
                padding: '8px 0',
                borderBottom: '1px solid #1c2028',
                fontSize: 12,
                alignItems: 'center',
              }}
            >
              {/* Name + hands */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: '#d1d5db',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {entry.playerName}
                  {!entry.isActive && (
                    <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 10, marginLeft: 4 }}>
                      (out)
                    </span>
                  )}
                </div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>
                  {entry.handsPlayed} hand{entry.handsPlayed !== 1 ? 's' : ''}
                </div>
              </div>

              <span style={{ color: '#6b7280', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {entry.buyIns}
              </span>
              <span style={{ color: '#d1d5db', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {stack}
              </span>
              <span
                style={{
                  color: netColor,
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {netPrefix}
                {entry.netResult}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total pot footer */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #1c2028',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>
          Total Pot
        </span>
        <span style={{ color: '#e8b730', fontSize: 14, fontWeight: 700 }}>
          {totalPot}
        </span>
      </div>
    </div>
  );
}
