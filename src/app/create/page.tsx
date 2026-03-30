'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectSocket } from '@/lib/socket';
import { GameConfig } from '@/types';

export default function CreateGame() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const [config, setConfig] = useState<GameConfig>({
    variant: 'nlh',
    smallBlind: 1,
    bigBlind: 2,
    minBuyIn: 0,
    maxBuyIn: 0,
    turnTimer: 30,
    autoFoldOnTimeout: true,
    allowStraddle: false,
    ante: 0,
    bbAnte: false,
    runItTwice: false,
    maxPlayers: 9,
  });

  const updateConfig = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleCreate = () => {
    setIsCreating(true);
    const socket = connectSocket();

    const doCreate = () => {
      socket.emit('room:create', config, (roomId: string) => {
        router.push(`/game/${roomId}`);
      });
    };

    socket.on('connect', doCreate);
    if (socket.connected) doCreate();
  };

  return (
    <div className="h-dvh overflow-auto p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #161b22 0%, #0d1117 70%)' }}
    >
      <div className="max-w-sm mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            <span className="text-[#2ea043]">Home</span>
            <span className="text-white">Game</span>
          </h1>
          <p className="text-[13px] text-[#8b949e] mt-1">Set up your table</p>
        </div>

        {/* Form */}
        <div className="space-y-4 rounded-lg p-4 bg-[#161b22] border border-[#21262d]">
          {/* Blinds */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Blinds</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[#484f58] mb-1">Small Blind</label>
                <input
                  type="number"
                  value={config.smallBlind}
                  onChange={(e) => { updateConfig('smallBlind', Number(e.target.value)); updateConfig('bigBlind', Number(e.target.value) * 2); }}
                  min={1}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#484f58] mb-1">Big Blind</label>
                <input
                  type="number"
                  value={config.bigBlind}
                  onChange={(e) => updateConfig('bigBlind', Number(e.target.value))}
                  min={1}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Buy-in */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Buy-in Range (x BB)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={config.minBuyIn}
                onChange={(e) => updateConfig('minBuyIn', Number(e.target.value))}
                min={1}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
                placeholder="Min"
              />
              <input
                type="number"
                value={config.maxBuyIn}
                onChange={(e) => updateConfig('maxBuyIn', Number(e.target.value))}
                min={1}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
                placeholder="Max"
              />
            </div>
            <div className="text-[11px] text-[#484f58] mt-1">
              {config.minBuyIn * config.bigBlind} – {config.maxBuyIn * config.bigBlind} chips
            </div>
          </div>

          {/* Players + Timer */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[#484f58] mb-1">Max Players</label>
              <select
                value={config.maxPlayers}
                onChange={(e) => updateConfig('maxPlayers', Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#484f58] mb-1">Turn Timer (sec)</label>
              <input
                type="number"
                value={config.turnTimer}
                onChange={(e) => updateConfig('turnTimer', Number(e.target.value))}
                min={0} max={300}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1">
            {([
              ['autoFoldOnTimeout', 'Auto-fold on timeout'],
              ['allowStraddle', 'Allow straddle'],
              ['runItTwice', 'Run it twice'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-1">
                <span className="text-[13px] text-[#e6edf3]">{label}</span>
                <div
                  className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${
                    config[key] ? 'bg-[#238636]' : 'bg-[#21262d]'
                  }`}
                  onClick={() => updateConfig(key, !config[key])}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    config[key] ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`} />
                </div>
              </label>
            ))}
          </div>

          {/* Ante */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Ante</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={config.ante}
                onChange={(e) => updateConfig('ante', Number(e.target.value))}
                min={0}
                className="w-24 bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-[14px] focus:border-[#388bfd] focus:outline-none"
              />
              <label className="flex items-center gap-1.5 cursor-pointer">
                <div
                  className={`w-4 h-4 rounded border ${
                    config.bbAnte ? 'bg-[#238636] border-[#2ea043]' : 'border-[#30363d] bg-[#0d1117]'
                  } flex items-center justify-center`}
                  onClick={() => updateConfig('bbAnte', !config.bbAnte)}
                >
                  {config.bbAnte && <span className="text-[10px] text-white">&#10003;</span>}
                </div>
                <span className="text-[13px] text-[#8b949e]">BB Ante</span>
              </label>
            </div>
          </div>
        </div>

        {/* Create */}
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full py-3.5 rounded-lg font-bold text-[15px] text-white transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: isCreating
              ? '#21262d'
              : 'linear-gradient(180deg, #238636 0%, #1a6b2b 100%)',
            border: `1px solid ${isCreating ? '#30363d' : '#2ea04380'}`,
          }}
        >
          {isCreating ? 'Creating...' : 'Create Table'}
        </button>
      </div>
    </div>
  );
}
