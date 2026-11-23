import React, { useState } from 'react';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Code is white, comments are blue, and only the named keywords are amber.
function renderLine(line, highlight) {
  const at = line.indexOf('//');
  const codePart = at === -1 ? line : line.slice(0, at);
  const commentPart = at === -1 ? '' : line.slice(at);
  const words = (Array.isArray(highlight) ? highlight : highlight ? [highlight] : []).filter(Boolean);

  let pieces = [codePart];
  if (words.length && codePart) {
    const re = new RegExp(`(${words.map(escapeRe).join('|')})`);
    pieces = codePart.split(re).map((seg, i) =>
      i % 2 === 1 ? <span key={i} className="text-amber-400 font-semibold">{seg}</span> : seg
    );
  }
  return (
    <>
      {pieces}
      {commentPart && <span className="text-blue-300">{commentPart}</span>}
    </>
  );
}

// The same "Show code (database operation)" drawer as the eCommerce demo.
export default function CodePanel({ title = 'Show code (database operation)', heading, note, code, highlight }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1 px-1 border-t border-slate-100"
      >
        <span className="flex items-center space-x-1.5">
          <span className="font-mono text-[#004B87] font-bold">&lt;/&gt;</span>
          <span>{open ? 'Hide database operation' : title}</span>
        </span>
        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
        <div className="mt-2 bg-slate-900 text-slate-100 p-4 rounded-md border border-slate-700/80 shadow-inner">
          {(heading || note) && (
            <div className="mb-2.5 pb-2 border-b border-slate-800">
              {heading && <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block">{heading}</span>}
              {note && <p className="text-xs text-slate-400 mt-1 leading-snug">{note}</p>}
            </div>
          )}
          <pre className="font-mono text-xs leading-relaxed text-[#00ED64] overflow-x-auto whitespace-pre">
            {code.split('\n').map((line, i) => (
              <span key={i} className="block min-h-[1.3em]">
                {renderLine(line, highlight)}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
