'use client';

import { useState, useEffect } from 'react';
import type { PlayerPreferences } from '@/types';

interface PreferencesPanelProps {
  preferences: PlayerPreferences;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (prefs: Partial<PlayerPreferences>) => void;
}

export default function PreferencesPanel({ preferences, isOpen, onClose, onUpdate }: PreferencesPanelProps) {
  const [draft, setDraft] = useState<PlayerPreferences>(preferences);

  useEffect(() => { setDraft(preferences); }, [preferences]);

  const update = <K extends keyof PlayerPreferences>(key: K, value: PlayerPreferences[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onUpdate({ [key]: value });
  };

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
    background: on ? '#1e40af' : '#1c2028', border: `1px solid ${on ? '#3b82f680' : '#262b33'}`,
    transition: 'background 0.2s',
  });

  const dotStyle = (on: boolean): React.CSSProperties => ({
    position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
    background: '#d1d5db', transition: 'left 0.15s',
    left: on ? 18 : 2,
  });

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 280,
      backgroundColor: '#0e1015', borderLeft: '1px solid #1c2028', zIndex: 50,
      display: 'flex', flexDirection: 'column',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.25s ease-in-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #1c2028', flexShrink: 0,
      }}>
        <span style={{ color: '#d1d5db', fontSize: 15, fontWeight: 600 }}>My Preferences</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px',
        }}>&times;</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Straddle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1c2028' }}>
          <div>
            <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>Auto Straddle</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>Automatically post straddle when UTG</div>
          </div>
          <div style={toggleStyle(draft.autoStraddle)} onClick={() => update('autoStraddle', !draft.autoStraddle)}>
            <div style={dotStyle(draft.autoStraddle)} />
          </div>
        </div>

        {/* Run it twice */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1c2028' }}>
          <div>
            <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>Run It Twice</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>Deal remaining board twice when all-in</div>
          </div>
          <div style={toggleStyle(draft.runItTwice)} onClick={() => update('runItTwice', !draft.runItTwice)}>
            <div style={dotStyle(draft.runItTwice)} />
          </div>
        </div>

        {/* Run it thrice */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1c2028' }}>
          <div>
            <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>Run It Thrice</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>Deal remaining board three times when all-in</div>
          </div>
          <div style={toggleStyle(draft.runItThrice)} onClick={() => update('runItThrice', !draft.runItThrice)}>
            <div style={dotStyle(draft.runItThrice)} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #262b33', margin: '12px 0' }} />

        {/* Auto Top-Up */}
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>Auto Top-Up</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Automatically add chips when below threshold</div>
            </div>
            <div style={toggleStyle(draft.autoTopUp)} onClick={() => update('autoTopUp', !draft.autoTopUp)}>
              <div style={dotStyle(draft.autoTopUp)} />
            </div>
          </div>

          {draft.autoTopUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Top up to</label>
                <input type="text" inputMode="numeric" value={String(draft.autoTopUpTarget)}
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); update('autoTopUpTarget', v === '' ? 0 : parseInt(v, 10)); }}
                  style={{
                    width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 13,
                    background: '#0e1015', border: '1px solid #262b33', borderRadius: 4,
                    color: 'white', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>When below</label>
                <input type="text" inputMode="numeric" value={String(draft.autoTopUpThreshold)}
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); update('autoTopUpThreshold', v === '' ? 0 : parseInt(v, 10)); }}
                  style={{
                    width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 13,
                    background: '#0e1015', border: '1px solid #262b33', borderRadius: 4,
                    color: 'white', outline: 'none',
                  }}
                />
              </div>
              {/* Approval status */}
              <div style={{
                fontSize: 11, padding: '6px 8px', borderRadius: 4,
                background: draft.autoTopUpApproved ? '#16453420' : '#1c2028',
                border: `1px solid ${draft.autoTopUpApproved ? '#22c55e30' : '#262b33'}`,
                color: draft.autoTopUpApproved ? '#22c55e' : '#6b7280',
              }}>
                {draft.autoTopUpApproved
                  ? '✓ Approved by host'
                  : 'Pending host approval'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
