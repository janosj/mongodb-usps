import React, { useEffect, useRef, useState } from 'react';

// Adapted from the "Scale is a slider" panel in temp/mongodb-public-sector-demo.html.
// These numbers are scripted to illustrate horizontal scale. They are not measurements.
const MAX_SHARDS = 12;

// Eases a displayed number toward its target over about half a second.
function useAnimated(target) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min((t - t0) / 520, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (target - start) * eased;
      from.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

function Stat({ value, label, color }) {
  return (
    <div>
      <div className="text-3xl font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">{label}</div>
    </div>
  );
}

export default function ScaleSlider() {
  const [n, setN] = useState(1);
  const chunksPer = Math.max(2, Math.round(96 / n));

  const ops = useAnimated(n * 48000);
  const data = useAnimated(n * 7.5);
  const lat = useAnimated(Math.max(3, 34 - n * 2.2));
  const chunks = useAnimated(chunksPer);

  return (
    <section className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Scale is a slider, not a re-architecture</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          MongoDB scales horizontally by distributing data and processing across multiple nodes, using a shard key of your choosing. This is a scripted illustration — real numbers depend on your workload.
        </p>
      </div>

      <div className="flex items-center gap-5 mb-5">
        <label className="text-xs font-semibold text-slate-700">Shards</label>
        <input
          type="range"
          min="1"
          max={MAX_SHARDS}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: '#00A651' }}
        />
        <span className="font-mono text-xl font-bold text-[#00684A] w-8 text-right">{n}</span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        <Stat value={Math.round(ops).toLocaleString('en-US')} label="Writes / sec (illustrative)" color="#00684A" />
        <Stat value={data.toFixed(1)} label="TB working set" color="#004B87" />
        <Stat value={lat.toFixed(1)} label="p99 read latency, ms (illustrative)" color="#B45309" />
        <Stat value={Math.round(chunks)} label="Chunks per shard, auto-balanced" color="#7C3AED" />
      </div>

      <div className="flex flex-wrap gap-2 min-h-[6.5rem] content-start">
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="w-[4.5rem] rounded-lg border border-emerald-300 bg-emerald-50 px-1.5 py-2 text-center shard-pop"
            style={{ animationDelay: `${i * 42}ms` }}
          >
            <div className="font-mono text-[10px] font-bold text-[#00684A]">shard{String(i).padStart(2, '0')}</div>
            <div className="flex flex-wrap gap-0.5 justify-center mt-1.5">
              {Array.from({ length: Math.min(chunksPer, 16) }, (_, j) => (
                <i key={j} className="w-[7px] h-[7px] rounded-[2px] bg-[#00ED64] opacity-80 block" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
