import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Clock, Timer, Activity, SkipForward, Music } from 'lucide-react';
import { useFocusTimer, PRESETS } from '../../hooks/useFocusTimer';

interface PomodoroWidgetProps {
  timer: ReturnType<typeof useFocusTimer>;
  onOpenMusic?: () => void;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ timer, onOpenMusic }) => {
  const {
    status,
    mode,
    timeLeft,
    totalTime,
    currentPreset,
    engineMode,
    toggleTimer,
    resetTimer,
    selectPreset,
    startCustom,
    switchEngineMode,
    skipSession,
  } = timer;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customMins, setCustomMins] = useState(30);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Circular progress stroke calculation
  // radius = 42, circumference = 2 * PI * 42 = 263.89
  const radius = 42;
  const strokeDasharray = 2 * Math.PI * radius; // ~263.9
  const progressPercent = engineMode === 'STOPWATCH' ? 100 : (1 - timeLeft / totalTime) * 100;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * progressPercent) / 100;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-2.5 shadow-sm relative overflow-hidden transition-all duration-300 flex flex-col items-center">
      {/* Background soft glowing accent */}
      <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-10 transition-colors duration-500 ${
        engineMode === 'STOPWATCH' ? 'bg-amber-500' : mode === 'WORK' ? 'bg-indigo-500' : 'bg-emerald-500'
      }`} />

      {/* Widget Header */}
      <div className="w-full flex justify-between items-center mb-4 relative z-10">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <Clock size={16} className="text-slate-700" />
          Pomodoro
        </h3>
        {onOpenMusic && (
          <button
            onClick={onOpenMusic}
            className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1"
          >
            <Music size={11} />
            Lofi
          </button>
        )}
      </div>

      {/* Mode Switcher: Cổ điển vs Chuyên sâu */}
      <div className="flex bg-slate-100 rounded-full p-0.5 mb-5 relative z-10 w-full">
        <button
          onClick={() => switchEngineMode('TIMER')}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${
            engineMode === 'TIMER' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-750'
          }`}
        >
          Cổ điển
        </button>
        <button
          onClick={() => switchEngineMode('STOPWATCH')}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all ${
            engineMode === 'STOPWATCH' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-750'
          }`}
        >
          Chuyên sâu
        </button>
      </div>

      {/* Circular Timer Display */}
      <div className="relative w-28 h-28 flex flex-col justify-center items-center mb-5 mt-1 select-none">
        <svg className="absolute w-full h-full -rotate-90">
          {/* Background track circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Foreground progress circle */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`transition-all duration-300 ${
              engineMode === 'STOPWATCH'
                ? 'stroke-amber-500'
                : mode === 'WORK'
                  ? 'stroke-indigo-600'
                  : 'stroke-emerald-500'
            }`}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center">
          <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
            {engineMode === 'STOPWATCH' ? 'TẬP TRUNG' : mode === 'WORK' ? 'TẬP TRUNG' : 'GIẢI LAO'}
          </span>
          <span className="font-mono text-2.5xl font-black text-slate-800 tracking-tight leading-none mt-1">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center items-center gap-2 mb-3.5 relative z-10">
        <button
          onClick={toggleTimer}
          className="bg-black hover:bg-slate-900 text-white font-extrabold text-xs px-5 py-2.5 rounded-full flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 shrink-0"
        >
          {status === 'RUNNING' ? (
            <>
              <Pause size={12} fill="white" className="stroke-[3]" />
              Tạm dừng
            </>
          ) : (
            <>
              <Play size={12} fill="white" className="ml-0.5 stroke-[3]" />
              Bắt đầu
            </>
          )}
        </button>

        {engineMode === 'TIMER' && (
          <button
            onClick={() => skipSession?.()}
            className="w-9 h-9 bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all flex items-center justify-center active:scale-90"
            title="Bỏ qua"
          >
            <SkipForward size={14} className="stroke-[2.5]" />
          </button>
        )}

        <button
          onClick={resetTimer}
          className="w-9 h-9 bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all flex items-center justify-center active:scale-90"
          title="Reset"
        >
          <RotateCcw size={14} className="stroke-[2.5]" />
        </button>
      </div>

      {/* Description / Setting Text */}
      <p className="text-[10px] font-bold text-slate-400 mb-2">
        {engineMode === 'STOPWATCH'
          ? 'Đếm giờ tự do'
          : `Tập trung ${currentPreset.work}' · Nghỉ ${currentPreset.break}'`}
      </p>

      {/* Custom timer drawer toggler */}
      {engineMode === 'TIMER' && (
        <div className="w-full border-t border-slate-100 pt-2.5 mt-2 relative z-10">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-center gap-1 text-[10px] font-extrabold text-slate-450 hover:text-slate-700 transition-colors uppercase tracking-wider"
          >
            Tùy chọn nâng cao
          </button>

          {showAdvanced && (
            <div className="mt-3.5 space-y-3 animate-in slide-in-from-top-1 duration-200 w-full">
              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => {
                  const isActive = currentPreset?.id === p.id && engineMode === 'TIMER';
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        selectPreset(p);
                        setShowAdvanced(false);
                      }}
                      className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                        isActive
                          ? 'bg-slate-100 border-slate-250 text-slate-800 ring-1 ring-slate-200'
                          : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-tight">{p.name}</span>
                      <span className="text-[9px] opacity-75 font-medium">{p.work}p / {p.break}p</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Minutes Input */}
              <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                  <input
                    type="number"
                    value={customMins}
                    onChange={(e) => setCustomMins(Math.max(1, Math.min(180, Number(e.target.value))))}
                    className="w-12 p-1 text-center text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-450"
                    min="1"
                    max="180"
                  />
                  <span className="text-[9px] font-bold text-slate-400">PHÚT</span>
                </div>
                <button
                  onClick={() => {
                    startCustom(customMins);
                    setShowAdvanced(false);
                  }}
                  className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Bắt đầu
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
