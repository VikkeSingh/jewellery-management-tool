import { useState } from 'react';

// The printed layout is designed for A4. For other papers we tell the
// browser the page size (so the print dialog picks it by default) and
// scale the sheet by the ratio of printable widths, so the same layout
// fills the page proportionally instead of overflowing or leaving it half
// empty.
const PAGE_MARGIN_MM = 10;
const A4_PRINTABLE_WIDTH_MM = 210 - 2 * PAGE_MARGIN_MM;

const PAPER_SIZES = [
  { id: 'A4', label: 'A4', size: 'A4', widthMm: 210 },
  { id: 'A5', label: 'A5', size: 'A5', widthMm: 148 },
  { id: 'A3', label: 'A3', size: 'A3', widthMm: 297 },
  { id: 'Letter', label: 'Letter', size: 'letter', widthMm: 215.9 },
  { id: 'Legal', label: 'Legal', size: 'legal', widthMm: 215.9 },
  { id: 'Tabloid', label: 'Tabloid', size: '11in 17in', widthMm: 279.4 },
];

const STORAGE_KEY = 'print_paper_size';

export function usePaperSize() {
  const [paperId, setPaperIdState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return PAPER_SIZES.some((p) => p.id === saved) ? saved : 'A4';
    } catch {
      return 'A4';
    }
  });
  function setPaperId(id) {
    setPaperIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }
  return [paperId, setPaperId];
}

export function PaperSizeSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto' }} aria-label="Paper size">
      {PAPER_SIZES.map((p) => <option key={p.id} value={p.id}>Paper: {p.label}</option>)}
    </select>
  );
}

// Renders the print-only rules for the chosen paper.
export function PaperSizeStyle({ paperId }) {
  const paper = PAPER_SIZES.find((p) => p.id === paperId) || PAPER_SIZES[0];
  const scale = (paper.widthMm - 2 * PAGE_MARGIN_MM) / A4_PRINTABLE_WIDTH_MM;
  return (
    <style>{`
      @page { size: ${paper.size}; margin: ${PAGE_MARGIN_MM}mm; }
      @media print { .invoice-sheet { zoom: ${scale.toFixed(3)}; } }
    `}</style>
  );
}
