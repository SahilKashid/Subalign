/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

export interface SubtitleItem {
  id: string;
  start: number;
  end: number;
  text: string;
  position?: {
    x: number; // 0 to 100 (percentage)
    y: number; // 0 to 100 (percentage)
  };
}

/**
 * Lightweight browser-compatible parser for SRT and VTT.
 */
export function parseSrtVtt(content: string): SubtitleItem[] {
  const items: SubtitleItem[] = [];
  const normalization = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalization.split(/\n\s*\n/);
  
  const isVtt = normalization.startsWith('WEBVTT');
  let itemCounter = 0;

  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length < 2) return;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) return;

    const timeLine = lines[timeLineIndex];
    const parts = timeLine.split('-->');
    if (parts.length !== 2) return;

    const start = timestampToMs(parts[0].trim());
    const endStrRaw = parts[1].trim();
    const endMatch = endStrRaw.match(/^(\d{1,2}:\d{2}:\d{2}[.,]\d{3})|^(\d{2}:\d{2}[.,]\d{3})/);
    
    if (!endMatch) return;
    const end = timestampToMs(endMatch[0]);

    // Text is everything after the time line
    const text = lines.slice(timeLineIndex + 1).join('\n');
    
    const item: SubtitleItem = {
      id: `sub-${itemCounter++}-${Date.now()}`,
      start,
      end,
      text,
      position: { x: 50, y: 90 }
    };

    if (isVtt) {
      const posMatch = endStrRaw.match(/position:(\d+)%/);
      const lineMatch = endStrRaw.match(/line:(\d+)%/);
      if (posMatch) item.position!.x = parseInt(posMatch[1]);
      if (lineMatch) item.position!.y = parseInt(lineMatch[1]);
    }

    items.push(item);
  });

  return items;
}

/**
 * Basic ASS parser that looks for Dialogue lines.
 */
export function parseAss(content: string): SubtitleItem[] {
  const lines = content.replace(/\r/g, '').split('\n');
  const items: SubtitleItem[] = [];
  
  let resX = 384; 
  let resY = 288;

  lines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (cleanLine.startsWith('PlayResX:')) resX = parseInt(cleanLine.split(':')[1]) || 384;
    if (cleanLine.startsWith('PlayResY:')) resY = parseInt(cleanLine.split(':')[1]) || 288;

    if (cleanLine.startsWith('Dialogue:')) {
      const parts = cleanLine.split(',');
      if (parts.length < 10) return;

      const startStr = parts[1].trim();
      const endStr = parts[2].trim();
      const text = parts.slice(9).join(',');

      // Look for \pos(x,y)
      const posMatch = text.match(/\\pos\((\d+\.?\d*),(\d+\.?\d*)\)/);
      let x = 50;
      let y = 90;

      if (posMatch) {
        x = (parseFloat(posMatch[1]) / resX) * 100;
        y = (parseFloat(posMatch[2]) / resY) * 100;
      }

      items.push({
        id: `ass-${index}-${Date.now()}-${Math.random()}`,
        start: assTimeToMs(startStr),
        end: assTimeToMs(endStr),
        text: text.replace(/\{.*?\}/g, '').replace(/\\N/g, '\n'), // basic cleaning
        position: { x, y }
      });
    }
  });

  return items;
}

function assTimeToMs(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const [s, cs] = parts[2].split('.');
  return (h * 3600 + m * 60 + parseInt(s)) * 1000 + parseInt(cs || '0') * 10;
}

function timestampToMs(ts: string): number {
  // Supports 00:00:00,000 or 00:00,000
  const parts = ts.replace(',', '.').split(':');
  let h = 0, m = 0, s = 0, ms = 0;

  if (parts.length === 3) {
    h = parseInt(parts[0]);
    m = parseInt(parts[1]);
    const secParts = parts[2].split('.');
    s = parseInt(secParts[0]);
    ms = parseInt(secParts[1] || '0');
  } else if (parts.length === 2) {
    m = parseInt(parts[0]);
    const secParts = parts[1].split('.');
    s = parseInt(secParts[0]);
    ms = parseInt(secParts[1] || '0');
  }

  return (h * 3600 + m * 60 + s) * 1000 + ms;
}

export function formatTime(ms: number): string {
  const sTotal = Math.floor(ms / 1000);
  const h = Math.floor(sTotal / 3600);
  const m = Math.floor((sTotal % 3600) / 60);
  const s = sTotal % 60;
  const msRem = ms % 1000;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${msRem.toString().padStart(3, '0')}`;
}
