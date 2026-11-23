import React from 'react';

const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');

// Exposure over time for one account, with its typical level and the hold line.
export function ExposureChart({ points, typical, threshold, height = 230 }) {
  const W = 560;
  const H = height;
  const pad = { l: 56, r: 12, t: 12, b: 24 };
  const vals = points.map((p) => p.v);
  const max = Math.max(threshold * 1.25, ...vals, typical * 1.5);
  const t0 = points.length ? points[0].t : 0;
  const t1 = points.length ? points[points.length - 1].t : 1;
  const span = Math.max(t1 - t0, 5000);
  const x = (t) => pad.l + ((t - t0) / span) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map((f) => f * max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#64748b">{usd(v)}</text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(typical)} y2={y(typical)} stroke="#64748b" strokeDasharray="4 3" />
      <text x={W - pad.r} y={y(typical) - 4} textAnchor="end" fontSize="10" fill="#475569">typical for this account {usd(typical)}</text>
      <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="#DA291C" strokeDasharray="4 3" />
      <text x={W - pad.r} y={y(threshold) - 4} textAnchor="end" fontSize="10" fill="#DA291C">hold line (3x typical) {usd(threshold)}</text>
      {path && <path d={path} fill="none" stroke="#004B87" strokeWidth="2.5" />}
      {points.length > 0 && <circle cx={x(t1)} cy={y(points[points.length - 1].v)} r="4" fill="#004B87" />}
    </svg>
  );
}

// Scans per 10 seconds from the Time Series collection.
export function VolumeChart({ buckets, baseline, height = 190 }) {
  const W = 480;
  const H = height;
  const pad = { l: 40, r: 10, t: 10, b: 22 };
  const max = Math.max(5, baseline * 3, ...buckets.map((b) => b.count));
  const bw = (W - pad.l - pad.r) / Math.max(buckets.length, 1);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(f * max)} y2={y(f * max)} stroke="#e2e8f0" />
          <text x={pad.l - 5} y={y(f * max) + 3} textAnchor="end" fontSize="10" fill="#64748b">{Math.round(f * max)}</text>
        </g>
      ))}
      {buckets.map((b, i) => (
        <rect key={b.t} x={pad.l + i * bw + 0.5} y={y(b.count)} width={Math.max(bw - 1, 1)} height={H - pad.b - y(b.count)}
          fill={b.count > Math.max(baseline * 5, 8) ? '#DA291C' : '#004B87'} />
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(baseline)} y2={y(baseline)} stroke="#475569" strokeDasharray="4 3" />
      <text x={W - pad.r} y={y(baseline) - 4} textAnchor="end" fontSize="10" fill="#475569">typical {baseline} per 10 s</text>
    </svg>
  );
}

// A simplified outline of the lower 48 states (illustrative, no map tiles needed).
const US = [[-124.7,48.4],[-117,49],[-95.2,49],[-94.6,48.7],[-89.6,48],[-84.8,46.9],[-83,46],[-82.4,43],[-79,43.2],[-76.5,43.6],[-75,45],[-71.5,45],[-69.2,47.4],[-67,44.8],[-70,43.6],[-70.7,42],[-71,41.5],[-74,40.6],[-75.5,38.5],[-76,37],[-75.5,35.3],[-78.5,33.8],[-81,32],[-81.4,30.5],[-80,26.8],[-80.4,25.2],[-81.8,26],[-82.8,27.8],[-83,29.2],[-85,29.7],[-87.5,30.3],[-89.5,30.2],[-89.4,29],[-91.5,29.5],[-94,29.6],[-97.2,27.8],[-97.2,25.9],[-99.1,26.4],[-100.6,28.5],[-101.4,29.8],[-103,29],[-104.5,29.7],[-106.5,31.8],[-108.2,31.8],[-108.2,31.3],[-111,31.3],[-114.8,32.5],[-117.1,32.5],[-118.5,34],[-120.6,34.5],[-122.4,37.5],[-123.8,39.5],[-124.3,42],[-124.1,46]];

export function GeoMap({ geo }) {
  const W = 600;
  const H = 320;
  const px = (lon) => ((lon + 125) / 59) * W;
  const py = (lat) => ((50 - lat) / 26) * H;
  const outline = US.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ') + ' Z';
  const c = geo?.cluster;
  const ringR = c ? (c.radius_miles / 69) * (H / 26) : 0; // degrees of latitude to pixels
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <path d={outline} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
      {geo?.facilities.map((f) => (
        <g key={f.city}>
          <circle cx={px(f.lon)} cy={py(f.lat)} r="3" fill="#fff" stroke="#64748b" />
          <text x={px(f.lon) + 5} y={py(f.lat) - 5} fontSize="9" fill="#64748b">{f.city}</text>
        </g>
      ))}
      {geo?.points.filter((p) => !p.flagged).map((p, i) => (
        <circle key={`n${i}`} cx={px(p.lon)} cy={py(p.lat)} r="1.6" fill="#94a3b8" />
      ))}
      {geo?.points.filter((p) => p.flagged).map((p, i) => (
        <circle key={`f${i}`} cx={px(p.lon)} cy={py(p.lat)} r="2.2" fill="#DA291C" opacity="0.75" />
      ))}
      {c && <circle cx={px(c.lon)} cy={py(c.lat)} r={Math.max(ringR, 9)} fill="none" stroke="#DA291C" strokeWidth="1.5" strokeDasharray="3 2" />}
    </svg>
  );
}
