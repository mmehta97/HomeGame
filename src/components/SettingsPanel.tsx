'use client';

import React, { useState, useEffect } from 'react';
import type { GameConfig } from '@/types';

interface SettingsPanelProps {
  config: GameConfig;
  isHost: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUpdateConfig: (config: Partial<GameConfig>) => void;
}

export default function SettingsPanel({
  config,
  isHost,
  isOpen,
  onClose,
  onUpdateConfig,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState<GameConfig>(config);
  const [dirty, setDirty] = useState(false);

  // Sync draft when config changes externally
  useEffect(() => {
    setDraft(config);
    setDirty(false);
  }, [config]);

  function updateField<K extends keyof GameConfig>(key: K, value: GameConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    // Build a partial with only changed fields
    const changes: Partial<GameConfig> = {};
    for (const key of Object.keys(draft) as (keyof GameConfig)[]) {
      if (draft[key] !== config[key]) {
        (changes as Record<string, unknown>)[key] = draft[key];
      }
    }
    if (Object.keys(changes).length > 0) {
      onUpdateConfig(changes);
    }
    setDirty(false);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    color: '#d1d5db',
    backgroundColor: '#161b22',
    border: '1px solid #1c2028',
    borderRadius: 4,
    outline: 'none',
  };

  const readOnlyValueStyle: React.CSSProperties = {
    fontSize: 13,
    color: '#d1d5db',
    padding: '6px 0',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    display: 'block',
  };

  const rowStyle: React.CSSProperties = {
    marginBottom: 14,
  };

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #1c2028',
  };

  function NumberField({
    label,
    field,
    suffix,
  }: {
    label: string;
    field: keyof GameConfig;
    suffix?: string;
  }) {
    const value = draft[field] as number;
    return (
      <div style={rowStyle}>
        <label style={labelStyle}>{label}</label>
        {isHost ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              value={value}
              onChange={(e) => updateField(field, Number(e.target.value))}
              style={inputStyle}
              min={0}
            />
            {suffix && (
              <span style={{ color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                {suffix}
              </span>
            )}
          </div>
        ) : (
          <div style={readOnlyValueStyle}>
            {value}
            {suffix ? ` ${suffix}` : ''}
          </div>
        )}
      </div>
    );
  }

  function ToggleField({
    label,
    field,
  }: {
    label: string;
    field: keyof GameConfig;
  }) {
    const value = draft[field] as boolean;
    return (
      <div style={toggleRowStyle}>
        <span style={{ color: '#d1d5db', fontSize: 13 }}>{label}</span>
        {isHost ? (
          <button
            onClick={() => updateField(field, !value)}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: value ? '#2ea043' : '#1c2028',
              position: 'relative',
              transition: 'background-color 0.15s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: value ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: '#d1d5db',
                transition: 'left 0.15s',
              }}
            />
          </button>
        ) : (
          <span style={{ color: value ? '#2ea043' : '#6b7280', fontSize: 12, fontWeight: 500 }}>
            {value ? 'On' : 'Off'}
          </span>
        )}
      </div>
    );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#d1d5db', fontSize: 15, fontWeight: 600 }}>
            Game Settings
          </span>
          {isHost && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#e8b730',
                backgroundColor: 'rgba(232,183,48,0.15)',
                padding: '2px 6px',
                borderRadius: 3,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              HOST
            </span>
          )}
        </div>
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
          padding: '12px 16px',
        }}
      >
        {/* Game variant */}
        <div style={rowStyle}>
          <label style={labelStyle}>Game Type</label>
          {isHost ? (
            <select
              value={draft.variant}
              onChange={(e) => updateField('variant', e.target.value as 'nlh' | 'plo4')}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="nlh">No-Limit Hold&apos;em</option>
              <option value="plo4">Pot-Limit Omaha 4</option>
              <option value="plo5">Pot-Limit Omaha 5</option>
              <option value="plo6">Pot-Limit Omaha 6</option>
            </select>
          ) : (
            <div style={readOnlyValueStyle}>
              {{ nlh: 'NLH', plo4: 'PLO4', plo5: 'PLO5', plo6: 'PLO6' }[draft.variant] || draft.variant}
            </div>
          )}
        </div>

        {/* Number fields */}
        <NumberField label="Small Blind" field="smallBlind" />
        <NumberField label="Big Blind" field="bigBlind" />
        <NumberField label="Min Buy-in" field="minBuyIn" suffix="x BB" />
        <NumberField label="Max Buy-in" field="maxBuyIn" suffix="x BB" />
        <NumberField label="Turn Timer" field="turnTimer" suffix="sec" />
        <NumberField label="Max Players" field="maxPlayers" />
        <NumberField label="Ante" field="ante" />

        {/* Divider */}
        <div
          style={{
            borderTop: '1px solid #1c2028',
            margin: '8px 0 12px',
          }}
        />

        {/* Toggles */}
        <ToggleField label="Auto-fold on Timeout" field="autoFoldOnTimeout" />
        <ToggleField label="Allow Straddle" field="allowStraddle" />
        <ToggleField label="Run it Twice" field="runItTwice" />
        <ToggleField label="BB Ante" field="bbAnte" />

        {!isHost && (
          <p
            style={{
              color: '#6b7280',
              fontSize: 12,
              textAlign: 'center',
              marginTop: 20,
              fontStyle: 'italic',
            }}
          >
            Only the host can change settings.
          </p>
        )}
      </div>

      {/* Save button (host only) */}
      {isHost && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #1c2028',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleSave}
            disabled={!dirty}
            style={{
              width: '100%',
              padding: '8px 0',
              fontSize: 13,
              fontWeight: 600,
              color: dirty ? '#fff' : '#6b7280',
              backgroundColor: dirty ? '#2ea043' : '#1c2028',
              border: 'none',
              borderRadius: 6,
              cursor: dirty ? 'pointer' : 'default',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
