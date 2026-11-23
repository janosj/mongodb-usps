import React, { useEffect, useRef, useState } from 'react';
import { api, feed, WATCH_ACCOUNT } from '../api';
import CodePanel from './CodePanel';
import { ExposureChart } from './Visuals';
import ScaleSlider from './ScaleSlider';

const ACTION_STYLE = {
  RELEASE: 'bg-emerald-600 text-white',
  REVIEW: 'bg-amber-500 text-white',
  HOLD: 'bg-[#DA291C] text-white',
};

const ROW_STYLE = {
  RELEASE: 'bg-slate-50 border-slate-100',
  REVIEW: 'bg-amber-50 border-amber-200',
  HOLD: 'bg-red-50 border-red-200',
};

const MAX_ROWS = 7;

// One grid for the header and every row, so the columns line up.
const ROW_GRID = 'grid grid-cols-[4.5rem_5.5rem_1fr_5rem_3.5rem] gap-2 items-center';

const CODE = `// One atomic update returns the new exposure...
const acct = await accounts.findOneAndUpdate(
  { _id: label.account_id },
  { $inc: { exposure_usd: label.postage_usd } },
  { returnDocument: 'after' }
);

// ...so the decision is ready after a single round trip.
const decision = decide(acct.exposure_usd, acct.typical_exposure_usd, weight.delta_oz);
await pieces.insertOne({ ...label, decision });`;

export default function LiveDecisions() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ rate: 0, p50: 0, p99: 0, holds: 0, total: 0 });
  const [points, setPoints] = useState([]);
  const [acct, setAcct] = useState(null);
  const [status, setStatus] = useState(null);
  const buf = useRef({ rows: [], lat: [], stamps: [], holds: 0, total: 0, points: [] });

  const refreshStatus = () => feed.get('/status').then((r) => setStatus(r.data)).catch(() => setStatus(null));

  useEffect(() => {
    api.get(`/accounts/${WATCH_ACCOUNT}`).then((r) => setAcct(r.data)).catch(() => {});
    refreshStatus();
    const poll = setInterval(refreshStatus, 2000);
    const accPoll = setInterval(() => api.get(`/accounts/${WATCH_ACCOUNT}`).then((r) => setAcct(r.data)).catch(() => {}), 2000);

    const es = new EventSource('/api/stream');
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      const b = buf.current;
      b.rows = [d, ...b.rows].slice(0, MAX_ROWS);
      b.lat.push(d.decision_ms);
      if (b.lat.length > 300) b.lat.shift();
      b.stamps.push(Date.now());
      b.total += 1;
      if (d.action === 'HOLD') b.holds += 1;
      if (d.account_id === WATCH_ACCOUNT) {
        b.points.push({ t: Date.now(), v: d.exposure_usd });
        if (b.points.length > 400) b.points.splice(0, b.points.length - 400);
      }
    };

    const flush = setInterval(() => {
      const b = buf.current;
      const now = Date.now();
      b.stamps = b.stamps.filter((s) => now - s < 2000);
      const sorted = [...b.lat].sort((a, c) => a - c);
      const pct = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
      setRows(b.rows);
      setPoints([...b.points]);
      setStats({ rate: Math.round(b.stamps.length / 2), p50: pct(0.5), p99: pct(0.99), holds: b.holds, total: b.total });
    }, 250);

    return () => {
      es.close();
      clearInterval(poll);
      clearInterval(accPoll);
      clearInterval(flush);
    };
  }, []);

  const control = (body) => feed.post('/control', body).then((r) => setStatus(r.data));

  const typical = acct?.typical_exposure_usd || 6000;

  return (
    <div className="flex flex-col space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          ['Scans per second', stats.rate],
          ['Decision time, median', `${stats.p50} ms`],
          ['Decision time, 99th percentile', `${stats.p99} ms`],
          ['Held', stats.holds],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
            <div className="text-3xl font-bold text-[#004B87] mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8 items-stretch">
        <section className="col-span-5 bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
          <div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => control({ running: !status?.running })}
                className={`flex-1 font-medium py-2.5 px-4 rounded shadow transition text-white ${status?.running ? 'bg-slate-600 hover:bg-slate-700' : 'bg-[#004B87] hover:bg-[#003660]'}`}
              >
                {status?.running ? 'Acceptance Scans - Pause Feed' : 'Acceptance Scans - Start Feed'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {status ? `Feed v${status.version} · ${status.running ? 'running' : 'paused'} · ${status.sent.toLocaleString()} sent` : 'Scan feed is not running. Start it with run-feed.sh.'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Decisions as they happen</h3>
              <div className="flex items-center space-x-1.5">
                {['RELEASE', 'REVIEW', 'HOLD'].map((a) => (
                  <span key={a} className={`px-2 py-0.5 rounded font-bold text-[10px] ${ACTION_STYLE[a]}`}>{a}</span>
                ))}
              </div>
            </div>
            <div className="font-mono text-[11px] space-y-1 min-h-[13.5rem]">
              <div className={`${ROW_GRID} px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400`}>
                <span>Label ID</span>
                <span>Account</span>
                <span>City</span>
                <span>Decision</span>
                <span className="text-right">Time</span>
              </div>
              {rows.length === 0 && (
                <div className="text-slate-400 pt-3 space-y-1">
                  <div>Start the acceptance scans to see decisions.</div>
                  <div>REVIEW indicates a weight mismatch.</div>
                  <div>HOLD indicates account exposure has exceeded 3x its baseline.</div>
                </div>
              )}
              {rows.map((r) => (
                <div key={r.label_id} className={`${ROW_GRID} border rounded px-2 py-1 ${ROW_STYLE[r.action]}`}>
                  <span className="text-slate-600">…{r.label_id.slice(-6)}</span>
                  <span className="text-slate-500">{r.account_id}</span>
                  <span className="text-slate-500 truncate">{r.city}</span>
                  <span><span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${ACTION_STYLE[r.action]}`}>{r.action}</span></span>
                  <span className="text-slate-500 text-right">{r.decision_ms} ms</span>
                </div>
              ))}
            </div>
          </div>
          <CodePanel heading="one round trip to a decision" note="Decision time is measured from request received to decision ready, including the trip to the database." code={CODE} highlight="decide(" />
        </section>

        <section className="col-span-7 bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <div className="pb-3 border-b border-slate-100 mb-3 flex items-start gap-4">
            <button
              onClick={() => control({ surge: !status?.surge })}
              className={`shrink-0 font-medium py-2.5 px-4 rounded shadow transition text-white ${status?.surge ? 'bg-slate-600 hover:bg-slate-700' : 'bg-[#DA291C] hover:bg-[#b82217]'}`}
            >
              {status?.surge ? 'Stop surge' : 'Inject counterfeit surge'}
            </button>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                {acct ? `${acct.name} (${acct.mailer_id})` : 'Account exposure'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Postage issued but not yet collected, against this account's own history.</p>
            </div>
          </div>
          <ExposureChart points={points} typical={typical} threshold={typical * 3} />
          <div className="mt-3 text-xs text-slate-600">
            {acct && (
              <span>
                Current exposure <strong className="text-[#004B87]">${Math.round(acct.exposure_usd).toLocaleString('en-US')}</strong>, {(acct.exposure_usd / typical).toFixed(1)}x typical. Account status:{' '}
                <strong className={acct.status === 'IN_GOOD_STANDING' ? 'text-emerald-700' : 'text-[#DA291C]'}>
                  {acct.status.replaceAll('_', ' ').toLowerCase()}
                </strong>.
              </span>
            )}
          </div>
        </section>
      </div>

      <ScaleSlider />
    </div>
  );
}
