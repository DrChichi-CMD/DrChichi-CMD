import React from 'react';
import { 
  X, Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Play, Check, Edit2, Save
} from 'lucide-react';
import { Song, Background, ProjectorState } from '../types';

interface ConsoleSubTabsProps {
  activeSubTab: 'none' | 'backgrounds' | 'fonts' | 'legends';
  setActiveSubTab: React.Dispatch<React.SetStateAction<'none' | 'backgrounds' | 'fonts' | 'legends'>>;
  state: ProjectorState;
  updateState: (update: (prev: ProjectorState) => ProjectorState) => void;
  backgrounds: Background[];
  handleSelectBackground: (id: string) => void;
  handleDeleteBackground: (id: string, e: React.MouseEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleSetDimMode: (val: boolean | null) => void;
  activeSong: Song | null;
  openProjectorWindow: () => void;
}

export function ConsoleSubTabs({
  activeSubTab,
  setActiveSubTab,
  state,
  updateState,
  backgrounds,
  handleSelectBackground,
  handleDeleteBackground,
  fileInputRef,
  handleSetDimMode,
  activeSong,
  openProjectorWindow,
}: ConsoleSubTabsProps) {
  if (activeSubTab === 'none') return null;

  return (
    <div className="w-full bg-[#18181b] border border-zinc-800 rounded-lg p-3 flex flex-col justify-between overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 shrink-0">
        <span className="text-[10px] font-black tracking-widest text-[#4a90e2] uppercase flex items-center gap-1.5 font-sans">
          {activeSubTab === 'backgrounds' && '🎨 Fondo de Diapositivas'}
          {activeSubTab === 'fonts' && '✍️ Estilo de Fuente'}
          {activeSubTab === 'legends' && '📺 Generador Leyenda'}
        </span>
        <button
          onClick={() => setActiveSubTab('none')}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition cursor-pointer"
          title="Ocultar panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic scrolling panel content */}
      <div className="flex-grow overflow-y-auto pr-1 text-[11px] space-y-3">
        
        {/* SUBTAB 1: BACKGROUND MANAGEMENT */}
        {activeSubTab === 'backgrounds' && (
          <div className="space-y-2 font-sans">
            {/* SINGLE CHANGEABLE SOLID COLOR SELECTION */}
            <div className="bg-[#121214] border border-zinc-800/80 rounded p-2 space-y-1">
              <span className="text-[8px] font-black text-indigo-400 block uppercase">FONDO UNICO DE COLOR</span>
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] text-zinc-400">Estilo Sólido (Reemplaza Fotos):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={state.solidBackgroundColor || '#121214'}
                    onChange={(e) => {
                      updateState(prev => ({ ...prev, solidBackgroundColor: e.target.value }));
                      handleSelectBackground('solid');
                    }}
                    className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[9px] font-mono text-zinc-400">{state.solidBackgroundColor || '#121214'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1">
              <span className="text-[8.5px] uppercase font-black text-zinc-400 block font-sans">Banco de diapositivas (Imágenes):</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[8.5px] bg-indigo-900/40 border border-indigo-800/60 text-indigo-300 font-bold py-0.5 px-2 rounded-sm active:scale-95 flex items-center gap-0.5 cursor-pointer font-sans"
              >
                + SUBIR FOTO
              </button>
            </div>

            {/* Pre-rendered list of backgrounds */}
            <div className="grid grid-cols-2 gap-1 max-h-[105px] overflow-y-auto p-1 bg-zinc-950/40 rounded border border-zinc-900">
              {backgrounds.filter(bg => bg.type === 'image' && bg.id !== 'solid').map((bg) => {
                const isSelected = state.activeBackgroundId === bg.id;
                const bgThumbStyle = { backgroundImage: `url(${bg.url})`, backgroundSize: 'cover', backgroundPosition: 'center' };

                return (
                  <div
                    key={bg.id}
                    onClick={() => handleSelectBackground(bg.id)}
                    className={`relative aspect-[16/10] rounded cursor-pointer border overflow-hidden group transition ${
                      isSelected ? 'border-red-500 ring-1 ring-red-500/20 shadow-sm' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                    title={bg.name}
                  >
                    <div style={bgThumbStyle} className="w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute bottom-0 text-[7.5px] bg-black/90 text-zinc-350 py-0.5 w-full text-center truncate px-1 font-sans">
                      {bg.name}
                    </div>
                    {bg.isCustom && (
                      <button
                        onClick={(e) => handleDeleteBackground(bg.id, e)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-red-600 hover:bg-red-555 rounded text-white opacity-0 group-hover:opacity-100 transition duration-150 shadow cursor-pointer"
                        title="Eliminar de biblioteca"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dim Mode Options */}
            <div className="bg-[#121113] border border-zinc-800/50 rounded p-1.5 space-y-1">
              <span className="text-[8px] font-black text-red-500 block uppercase">Dimmer Brillo de Fondo</span>
              <div className="grid grid-cols-3 gap-1 text-center bg-zinc-950 p-[2px] rounded border border-zinc-850">
                <button
                  type="button"
                  onClick={() => handleSetDimMode(null)}
                  className={`py-0.5 rounded text-[7.5px] uppercase font-black transition ${
                    state.isForceDimmed === null ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-[#4a90e2]'
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDimMode(true)}
                  className={`py-0.5 rounded text-[7.5px] uppercase font-black transition ${
                    state.isForceDimmed === true ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-[#4a90e2]'
                  }`}
                >
                  35% Opaco
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDimMode(false)}
                  className={`py-0.5 rounded text-[7.5px] uppercase font-black transition ${
                    state.isForceDimmed === false ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-[#4a90e2]'
                  }`}
                >
                   Brillo Max
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: FONTS & TYPOGRAPHY FORMAT */}
        {activeSubTab === 'fonts' && (
          <div className="space-y-2 font-sans">
            {/* Sizing slider */}
            <div className="space-y-1 bg-zinc-950/40 p-1.5 rounded border border-zinc-900">
              <div className="flex justify-between text-[8px] text-zinc-450 font-black">
                <span>TAMAÑO DE LA LETRA (PROYECTOR)</span>
                <span className="text-[#4a90e2] font-mono font-bold text-[9px]">{state.fontSize}px</span>
              </div>
              <input
                type="range"
                min="24"
                max="240"
                value={state.fontSize}
                onChange={(e) => updateState(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                className="w-full h-1 cursor-pointer accent-blue-500 rounded bg-zinc-900"
              />
            </div>

            {/* Color selection */}
            <div className="flex items-center justify-between bg-zinc-950/40 p-1.5 rounded border border-zinc-900">
              <span className="text-[8px] font-black text-zinc-450 uppercase font-sans">Color Letra Pantalla:</span>
              <div className="flex items-center gap-1 bg-zinc-950 p-[2px] rounded border border-zinc-850">
                <input
                  type="color"
                  value={state.fontColor}
                  onChange={(e) => updateState(prev => ({ ...prev, fontColor: e.target.value }))}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[8px] font-mono text-zinc-350">{state.fontColor}</span>
              </div>
            </div>

            {/* Alignment options */}
            <div className="bg-[#121214] p-1.5 rounded border border-zinc-850">
              <span className="text-[8px] font-black text-zinc-400 uppercase block mb-1 font-sans">Alineación en Pantalla:</span>
              <div className="flex rounded bg-zinc-950 border border-zinc-850 p-0.5">
                {(['left', 'center', 'right'] as const).map((align) => {
                  const Icon = { left: AlignLeft, center: AlignCenter, right: AlignRight }[align];
                  const isSelected = state.alignment === align;
                  return (
                    <button
                      key={align}
                      onClick={() => updateState(prev => ({ ...prev, alignment: align }))}
                      className={`flex-1 py-0.5 rounded flex items-center justify-center transition ${
                        isSelected ? 'bg-zinc-700 text-white font-black shadow-xs' : 'text-zinc-555 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="w-3 h-3 mr-0.5" />
                      <span className="text-[7.5px] uppercase">{align === 'left' ? 'Izq' : align === 'center' ? 'Centro' : 'Der'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Switches */}
            <div className="grid grid-cols-2 gap-1 font-sans">
              <button
                type="button"
                onClick={() => updateState(prev => ({ ...prev, isBold: !prev.isBold }))}
                className={`py-1 rounded text-[8px] font-black uppercase tracking-wide border transition ${
                  state.isBold ? 'bg-zinc-700 text-white border-zinc-600 shadow' : 'bg-zinc-950 border-zinc-850 text-zinc-500'
                }`}
              >
                Negrita: {state.isBold ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => updateState(prev => ({ ...prev, shadowEnabled: !prev.shadowEnabled }))}
                className={`py-1 rounded text-[8px] font-black uppercase tracking-wide border transition ${
                  state.shadowEnabled ? 'bg-zinc-700 text-white border-zinc-600 shadow' : 'bg-zinc-950 border-zinc-850 text-zinc-500'
                }`}
              >
                Sombra: {state.shadowEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}

        {/* SUBTAB 4: LEGEND AND NOTICIERO TICKER */}
        {activeSubTab === 'legends' && (
          <div className="space-y-2 font-sans">
            <div className="bg-[#121214] border border-zinc-805/80 rounded p-1.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black text-zinc-350 uppercase">Desplegar Leyenda</span>
                <button
                  type="button"
                  onClick={() => updateState(prev => ({ ...prev, isTickerActive: !prev.isTickerActive }))}
                  className={`px-2 py-0.5 text-[8px] font-black rounded-full transition uppercase ${
                    state.isTickerActive ? 'bg-amber-600 text-black shadow' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {state.isTickerActive ? 'ACTIVA' : 'APAGADA'}
                </button>
              </div>

              <div className="space-y-0.5">
                <span className="text-[7.5px] font-bold text-zinc-500 block uppercase">Texto del Cintillo:</span>
                <textarea
                  rows={2}
                  value={state.tickerText}
                  onChange={(e) => updateState(prev => ({ ...prev, tickerText: e.target.value }))}
                  placeholder="Ej. Bienvenido a nuestra reunión. Culto General de Adoración."
                  className="w-full text-[9px] bg-zinc-950 border border-zinc-800 p-1 rounded text-zinc-100 outline-none focus:border-amber-500 resize-none font-sans leading-normal"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[7.5px] font-bold text-zinc-400 uppercase">Fondo del Cintillo:</span>
                <div className="flex items-center gap-1 bg-zinc-950 p-[2px] rounded border border-zinc-850">
                  <input
                    type="color"
                    value={state.tickerColor}
                    onChange={(e) => updateState(prev => ({ ...prev, tickerColor: e.target.value }))}
                    className="w-4 h-4 cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[8px] font-mono text-zinc-350">{state.tickerColor}</span>
                </div>
              </div>

              {/* Ticker Opacity Slider Control */}
              <div className="space-y-1 font-sans pt-1 border-t border-zinc-900">
                <div className="flex justify-between items-center text-[7.5px] font-bold text-zinc-400 uppercase">
                  <span>Opacidad del Fondo:</span>
                  <span className="font-mono text-amber-500 font-bold">{state.tickerOpacity ?? 80}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={state.tickerOpacity ?? 80}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateState(prev => ({ ...prev, tickerOpacity: val }));
                  }}
                  className="w-full accent-amber-600 bg-zinc-900 border border-zinc-800 rounded h-1 cursor-pointer appearance-none outline-none"
                />
              </div>

              {/* Ticker Speed Slider Control */}
              <div className="space-y-1 font-sans pt-1 border-t border-zinc-900">
                <div className="flex justify-between items-center text-[7.5px] font-bold text-zinc-400 uppercase">
                  <span>Velocidad de Desplazamiento:</span>
                  <span className="font-mono text-amber-500 font-bold">
                    {state.tickerSpeed === 1 && 'Muy Lento (1)'}
                    {state.tickerSpeed === 2 && 'Lento (2)'}
                    {state.tickerSpeed === 3 && 'Lento (3)'}
                    {state.tickerSpeed === 4 && 'Moderado (4)'}
                    {state.tickerSpeed === 5 && 'Medio (5)'}
                    {state.tickerSpeed === 6 && 'Medio (6)'}
                    {state.tickerSpeed === 7 && 'Rápido (7)'}
                    {state.tickerSpeed === 8 && 'Rápido (8)'}
                    {state.tickerSpeed === 9 && 'Muy Rápido (9)'}
                    {state.tickerSpeed === 10 && 'Frenético (10)'}
                    {!state.tickerSpeed && 'Medio (5)'}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={state.tickerSpeed || 5}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    updateState(prev => ({ ...prev, tickerSpeed: val }));
                  }}
                  className="w-full accent-amber-600 bg-zinc-900 border border-zinc-800 rounded h-1 cursor-pointer appearance-none outline-none"
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Launcher live output link */}
      <div className="border-t border-zinc-850 pt-1.5 flex-shrink-0 font-sans mt-2">
        <button
          onClick={openProjectorWindow}
          className="w-full py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded text-[8.5px] uppercase font-black tracking-wider transition duration-150 border border-indigo-700/30"
        >
          📺 SALIDA PROYECTOR LIVE
        </button>
      </div>
    </div>
  );
}
