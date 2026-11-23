import React from 'react';

// Same idea as the eCommerce demo: everything MongoDB green, with what changed in amber.
export default function JsonView({ doc, amberKeys = [], placeholder = '// Waiting for a record' }) {
  if (!doc) return <span className="text-slate-400">{placeholder}</span>;
  const lines = JSON.stringify(doc, null, 2).split('\n');
  return lines.map((line, i) => {
    const hit = amberKeys.some((k) => line.includes(`"${k}"`));
    return (
      <span key={i} className={`block ${hit ? 'text-amber-400 font-semibold' : 'text-[#00ED64]'}`}>
        {line}
      </span>
    );
  });
}
