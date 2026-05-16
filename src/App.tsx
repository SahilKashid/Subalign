/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useMemo, memo, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Download, 
  Move, 
  Type, 
  Settings, 
  FileText, 
  Trash2, 
  Layout, 
  Maximize2,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  X,
  Plus,
  Layers,
  ArrowRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  parseSrtVtt, 
  parseAss,
  formatTime,
  SubtitleItem, 
  SubtitleFormat 
} from './lib/subtitleUtils';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const RangeSlider = ({ 
  label, 
  value, 
  min = 0, 
  max = 100, 
  onChange,
  icon: Icon
}: { 
  label: string, 
  value: number, 
  min?: number, 
  max?: number, 
  onChange: (val: number) => void,
  icon?: any
}) => (
  <div className="bg-bg-surface/50 p-4 xl:p-5 rounded-[1.5rem] border border-border-muted hover:border-blue-500/30 transition-all group/slider">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-blue-500/5 text-blue-400 group-hover/slider:scale-110 transition-transform">
          {Icon && <Icon size={14} />}
        </div>
        <label className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] font-display">{label}</label>
      </div>
      <div className="flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
        <input 
          type="number"
          value={Math.round(value)}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val)) onChange(Math.max(min, Math.min(max, val)));
          }}
          className="w-10 bg-transparent text-xs font-mono font-bold text-blue-400 focus:outline-none text-right"
        />
        <span className="text-[9px] font-mono font-bold text-blue-400/60">%</span>
      </div>
    </div>
    <div className="relative flex items-center h-3">
      <div className="absolute inset-x-0 h-1 bg-border-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500/30 transition-all" 
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step="1"
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div 
        className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-xl pointer-events-none transition-transform group-hover/slider:scale-125"
        style={{ left: `calc(${((value - min) / (max - min)) * 100}% - 6px)` }}
      />
    </div>
  </div>
);

const ALIGNMENT_PRESETS = [
  { name: 'Lower Center', x: 50, y: 90 },
  { name: 'Lower Left', x: 10, y: 90 },
  { name: 'Lower Right', x: 90, y: 90 },
  { name: 'Upper Center', x: 50, y: 10 },
  { name: 'Absolute Center', x: 50, y: 50 },
];

// --- Main App ---

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<SubtitleFormat>('srt');
  const [items, setItems] = useState<SubtitleItem[]>([]);
  const [globalOffset, setGlobalOffset] = useState(() => {
    const saved = localStorage.getItem('subalign_offset');
    return saved ? JSON.parse(saved) : { x: 50, y: 90 };
  });
  const [scale, setScale] = useState(1);
  const [showGuides, setShowGuides] = useState(true);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('subalign_offset', JSON.stringify(globalOffset));
  }, [globalOffset]);

  // File loading
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const extension = uploadedFile.name.split('.').pop()?.toLowerCase();
    const format = (extension === 'vtt' || extension === 'srt' || extension === 'ass' || extension === 'ssa') 
      ? (extension.startsWith('ass') || extension.startsWith('ssa') ? 'ass' : extension as SubtitleFormat)
      : 'srt';

    const text = await uploadedFile.text();
    let parsedItems: SubtitleItem[] = [];
    
    if (format === 'ass') {
      parsedItems = parseAss(text);
    } else {
      parsedItems = parseSrtVtt(text);
    }

    setFile(uploadedFile);
    setFormat(format);
    setItems(parsedItems);
  };

  // Sample item for preview (using the first one as representative)
  const previewItem = useMemo(() => items[0], [items]);

  const handleExport = () => {
    if (!items.length) return;

    const exportedItems = items.map(item => ({
      ...item,
      position: {
        x: globalOffset.x,
        y: globalOffset.y,
      }
    }));

    // If SRT, we export as VTT because SRT doesn't officially support alignment metadata
    const exportFormat = format === 'srt' ? 'vtt' : format;
    let content = "";
    let mimeType = "text/plain";

    if (exportFormat === 'vtt') {
      mimeType = 'text/vtt';
      content = "WEBVTT\n\n" + exportedItems.map((item, i) => {
        const timeLine = `${formatTime(item.start)} --> ${formatTime(item.end)}${item.position ? ` line:${item.position.y}% position:${item.position.x}%` : ''}`;
        return `${i + 1}\n${timeLine}\n${item.text}\n\n`;
      }).join('');
    } else if (exportFormat === 'ass') {
      mimeType = "text/x-ass";
      content = "[Script Info]\nTitle: Exported from Subalign\nPlayResX: 1920\nPlayResY: 1080\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
      content += exportedItems.map(item => {
        const start = formatTime(item.start).slice(0, -1);
        const end = formatTime(item.end).slice(0, -1);
        const x = Math.round(1920 * (item.position?.x || 50) / 100);
        const y = Math.round(1080 * (item.position?.y || 90) / 100);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\pos(${x},${y})}${item.text.replace(/\n/g, '\\N')}`;
      }).join('\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Ensure we don't double up extensions
    const baseName = file?.name || 'subtitles';
    const nameWithoutExt = baseName.replace(/\.(srt|vtt|ass|ssa)$/i, '');
    a.download = `${nameWithoutExt}_positioned.${exportFormat}`;
    
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-bg-base text-text-base selection:bg-blue-600/30 font-sans overflow-hidden">
      {/* Compact Header */}
      <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-border-muted bg-bg-surface/50 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-inner-glow">
            <Layers size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white leading-none mb-0.5 font-display uppercase italic text-blue-500">Subalign</h1>
            <p className="text-[8px] text-text-muted uppercase font-black tracking-[0.3em] opacity-40 font-mono">Spatial Metadata Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".srt,.vtt,.ass,.ssa" 
            onChange={handleFileUpload} 
          />
          
          {file && (
            <>
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 border border-border-muted bg-bg-base rounded-xl text-[10px] font-mono font-bold text-text-muted">
                <FileText size={12} className="text-blue-500" />
                {file.name}
              </div>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all bg-blue-600 text-white rounded-xl hover:bg-blue-500 hover:shadow-2xl hover:shadow-blue-600/20 active:scale-95 font-display"
              >
                <Download size={14} />
                Export
              </button>
            </>
          )}

          <button 
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "p-2.5 rounded-xl transition-all border font-display flex items-center gap-2",
              file 
                ? "text-text-muted hover:text-white hover:bg-white/5 border-transparent hover:border-border-muted" 
                : "bg-blue-600/10 text-blue-500 border-blue-500/20 hover:bg-blue-600/20"
            )}
            title={file ? "Load New File" : "Import Subtitles"}
          >
            <Plus size={18} />
            {!file && <span className="text-[10px] font-black uppercase tracking-widest pr-1">Add Subtitles</span>}
          </button>
        </div>
      </header>

      {/* Main Workspace - Zero Scroll Optimized */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-base/50 to-bg-base pointer-events-none" />
        
        <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-start relative z-10 min-h-0 px-4 py-4 md:py-6 gap-4 md:gap-6">
          {/* Stage Controls Overlay */}
          <div className="flex items-center gap-3 p-1.5 bg-bg-surface/90 backdrop-blur-2xl border border-border-muted rounded-xl shadow-premium shrink-0 scale-90 sm:scale-100">
             <div className="flex items-center gap-1 bg-bg-base rounded-lg border border-border-muted p-0.5">
               <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-1.5 text-text-muted hover:text-white transition-colors"><ChevronLeft size={14}/></button>
               <span className="text-[9px] font-black w-10 text-center text-blue-400 font-mono">{Math.round(scale * 100)}%</span>
               <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1.5 text-text-muted hover:text-white transition-colors"><ChevronRight size={14}/></button>
             </div>
             <div className="w-px h-4 bg-border-muted mx-0.5" />
             <button 
               onClick={() => setShowGuides(!showGuides)} 
               className={cn(
                 "p-2 rounded-lg transition-all", 
                 showGuides ? "text-blue-500 bg-blue-500/10 shadow-inner-glow" : "text-text-muted hover:text-white"
               )}
             >
               {showGuides ? <Eye size={16} /> : <EyeOff size={16} />}
             </button>
          </div>

          {/* Canvas Container - Responsive Scaling */}
          <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden relative group/canvas-container">
            <div 
              ref={previewRef}
              className={cn(
                "relative aspect-video bg-[#000] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden ring-1 ring-white/5 rounded-2xl w-full max-h-full transition-transform duration-300 ease-out",
                showGuides ? "bg-grid opacity-100" : ""
              )}
              style={{ transform: `scale(${scale})`, width: 'auto', height: '100%', maxWidth: '100%' }}
            >
              {showGuides && (
                <div className="absolute inset-0 pointer-events-none">
                   <div className="absolute top-0 bottom-0 left-1/2 w-px bg-blue-500/20 -translate-x-1/2" />
                   <div className="absolute left-0 right-0 top-1/2 h-px bg-blue-500/20 -translate-y-1/2" />
                   <div className="absolute top-[10%] bottom-[10%] left-[10%] right-[10%] border border-dashed border-white/5 rounded-lg" />
                </div>
              )}

              <motion.div
                className="absolute cursor-move select-none p-4 w-full text-center"
                style={{
                  left: `${globalOffset.x}%`,
                  top: `${globalOffset.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 50
                }}
                drag
                dragMomentum={false}
                onDragEnd={(e, info) => {
                  const rect = previewRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const deltaX = (info.offset.x / rect.width) * 100;
                  const deltaY = (info.offset.y / rect.height) * 100;
                  setGlobalOffset(prev => ({
                    x: Math.round(Math.max(0, Math.min(100, prev.x + deltaX))),
                    y: Math.round(Math.max(0, Math.min(100, prev.y + deltaY)))
                  }));
                }}
              >
                <div className="inline-block px-6 py-3 md:px-8 md:py-4 text-white bg-black/90 backdrop-blur-3xl rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] group-active/canvas:scale-105 transition-transform duration-300">
                  <p className="text-lg sm:text-xl md:text-3xl font-black tracking-tight drop-shadow-[0_8px_16px_rgba(0,0,0,1)] whitespace-pre-wrap font-sans">
                    {previewItem ? previewItem.text : "Preview Subtitle Pipeline"}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Controls Section - Optimized for Vertical Space */}
          <div className="w-full flex flex-col gap-3 md:gap-4 shrink-0 max-w-5xl pb-2">
            {/* Presets Grid */}
            <div className="w-full flex flex-wrap justify-center gap-1.5 md:gap-2">
              {ALIGNMENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setGlobalOffset({ x: preset.x, y: preset.y })}
                  className={cn(
                    "px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border font-display shrink-0",
                    globalOffset.x === preset.x && globalOffset.y === preset.y
                      ? "bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20"
                      : "bg-bg-surface/50 border-border-muted text-text-muted hover:text-white hover:border-white/20"
                  )}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Bulk Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 bg-bg-surface/80 border border-border-muted p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] backdrop-blur-3xl shadow-premium relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-white shadow-2xl font-mono">
                Spatial Calibration
              </div>
              <RangeSlider 
                label="Horizontal Axis (X)" 
                value={globalOffset.x} 
                min={0} max={100} 
                icon={Move}
                onChange={(val) => setGlobalOffset(prev => ({ ...prev, x: val }))} 
              />
              <RangeSlider 
                label="Vertical Axis (Y)" 
                value={globalOffset.y} 
                min={0} max={100} 
                icon={Move}
                onChange={(val) => setGlobalOffset(prev => ({ ...prev, y: val }))} 
              />
            </div>
            
            <p className="text-[8px] md:text-[9px] text-text-muted font-black text-center uppercase tracking-[0.3em] opacity-30 font-mono italic">
              {items.length > 0 ? `Broadcasting values to ${items.length} units` : "Spatial engine initialized and awaiting data"}
            </p>
          </div>
        </div>
      </main>

      <footer className="px-10 py-5 border-t border-border-muted bg-bg-surface/40 flex flex-col sm:flex-row justify-between items-center gap-4 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="font-mono text-[8px] uppercase tracking-widest font-black text-text-muted opacity-60 transition-opacity hover:opacity-100 cursor-default">Synchronized Subalign: OK</span>
        </div>
        <div className="flex gap-8">
          <span className="font-mono text-[8px] uppercase tracking-widest font-black text-blue-500/60 hover:text-blue-400 transition-colors cursor-default">Spatial V3.0</span>
          <span className="font-mono text-[8px] uppercase tracking-widest font-black text-text-muted opacity-40">Precision Pipeline</span>
        </div>
      </footer>

    </div>
  );
}

