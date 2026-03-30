'use client';

import { useState, useEffect } from 'react';
import type { PlayerPreferences, RunItPref, DeckColorPref } from '@/types';

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
    setDraft(prev => ({ ...prev, [key]: value }));
    onUpdate({ [key]: value });
  };

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
    background: on ? '#1e40af' : '#1c2028', border: `1px solid ${on ? '#3b82f680' : '#262b33'}`,
    transition: 'background 0.2s',
  });
  const dotStyle = (on: boolean): React.CSSProperties => ({
    position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
    background: '#d1d5db', transition: 'left 0.15s', left: on ? 18 : 2,
  });

  const radioStyle = (selected: boolean): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 500,
    background: selected ? '#1e40af' : '#1c2028',
    border: `1px solid ${selected ? '#3b82f680' : '#262b33'}`,
    color: selected ? 'white' : '#6b7280',
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 280,
      backgroundColor: '#0e1015', borderLeft: '1px solid #1c2028', zIndex: 50,
      display: 'flex', flexDirection: 'column',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.25s ease-in-out',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #1c2028', flexShrink: 0,
      }}>
        <span style={{ color: '#d1d5db', fontSize: 15, fontWeight: 600 }}>My Preferences</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>&times;</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Auto Straddle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1c2028' }}>
          <div>
            <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>Auto Straddle</div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>Auto-post straddle when UTG</div>
          </div>
          <div style={toggleStyle(draft.autoStraddle)} onClick={() => update('autoStraddle', !draft.autoStraddle)}>
            <div style={dotStyle(draft.autoStraddle)} />
          </div>
        </div>

        {/* Deck Colors */}
        <div style={{ padding: '10px 0', borderBottom: '1px solid #1c2028' }}>
          <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500, marginBottom: 6 }}>Deck Colors</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={radioStyle(draft.deckColor === '2color')} onClick={() => update('deckColor', '2color' as DeckColorPref)}>
              <span style={{ color: '#dc2626' }}>{'\u2665'}</span> <span style={{ color: '#1a1a1a' }}>{'\u2660'}</span> 2-Color
            </div>
            <div style={radioStyle(draft.deckColor === '4color')} onClick={() => update('deckColor', '4color' as DeckColorPref)}>
              <span style={{ color: '#dc2626' }}>{'\u2665'}</span> <span style={{ color: '#2563eb' }}>{'\u2666'}</span> <span style={{ color: '#16a34a' }}>{'\u2663'}</span> <span>{'\u2660'}</span> 4-Color
            </div>
          </div>
        </div>

        {/* Run It Preference */}
        <div style={{ padding: '10px 0', borderBottom: '1px solid #1c2028' }}>
          <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500, marginBottom: 4 }}>Run It When All-In</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>How many times to deal remaining board</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {([['once', 'Once'], ['twice', 'Twice'], ['thrice', 'Thrice'], ['ask', 'Ask Each Time']] as [RunItPref, string][]).map(([val, label]) => (
              <div key={val} style={radioStyle(draft.runItPref === val)} onClick={() => update('runItPref', val)}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #262b33', margin: '12px 0' }} />

        {/* Auto Top-Up */}
        <div style={{ padding: '4px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>Auto Top-Up</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Add chips when below threshold</div>
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
                  style={{ width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 13, background: '#0e1015', border: '1px solid #262b33', borderRadius: 4, color: 'white', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>When below</label>
                <input type="text" inputMode="numeric" value={String(draft.autoTopUpThreshold)}
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); update('autoTopUpThreshold', v === '' ? 0 : parseInt(v, 10)); }}
                  style={{ width: '100%', marginTop: 4, padding: '6px 10px', fontSize: 13, background: '#0e1015', border: '1px solid #262b33', borderRadius: 4, color: 'white', outline: 'none' }} />
              </div>
              <div style={{
                fontSize: 11, padding: '6px 8px', borderRadius: 4,
                background: draft.autoTopUpApproved ? '#16453420' : '#1c2028',
                border: `1px solid ${draft.autoTopUpApproved ? '#22c55e30' : '#262b33'}`,
                color: draft.autoTopUpApproved ? '#22c55e' : '#6b7280',
              }}>
                {draft.autoTopUpApproved ? '\u2713 Approved by host' : 'Pending host approval'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
