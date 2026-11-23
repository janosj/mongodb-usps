import React, { useEffect, useState } from 'react';
import { api, QUERY_CHIPS } from '../api';
import CodePanel from './CodePanel';
import { VolumeChart, GeoMap } from './Visuals';

const VOLUME_CODE = `db.scan_metrics.aggregate([            // MongoDB Time Series collection
  { $match: { ts: { $gte: since }, "meta.mailer_id": mailerId } },
  { $group: {
      _id: { $dateTrunc: { date: "$ts", unit: "second", binSize: 10 } },
      count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
])`;

const GEO_CODE = `// 25 miles around the account's home facility, converted to radians
const circle = { $geoWithin: { $centerSphere: [[lon, lat], 25 / 3963.2] } };
const since = new Date(Date.now() - 30 * 60 * 1000);   // last 30 minutes

db.pieces.countDocuments({
  "scans.where": circle,               // scanned inside the circle
  mailer_id: mailerId,                 // this mailer only
  created_at: { $gte: since }          // last 30 minutes
})`;

const SEARCH_CODE = `// Keyword match (Atlas Search)
{ $search: { index: "tips_text", text: { query, path: "text" } } }

// By meaning (Vector Search)
{ $vectorSearch: { index: "tips_vector", path: "embedding",
    queryVector, numCandidates: 100, limit: 8,
    filter: { region: { $eq: "Midwest" } } } }`;

function Highlighted({ result }) {
  const h = result.highlights?.find((x) => x.path === 'text');
  if (!h) return <>{result.text}</>;
  return h.texts.map((seg, i) =>
    seg.type === 'hit' ? (
      <mark key={i} className="bg-amber-300 text-slate-900 px-1 py-0.5 rounded font-bold">{seg.value}</mark>
    ) : (
      <span key={i}>{seg.value}</span>
    )
  );
}

function ResultColumn({ title, subtitle, data, mode }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h4>
        {data && <span className="text-[11px] font-mono text-slate-500">{data.results.length} found · {data.ms} ms</span>}
      </div>
      <p className="text-[11px] text-slate-500 mb-2">{subtitle}</p>
      <div className="space-y-2">
        {!data && <div className="text-xs text-slate-400">Run a search to compare.</div>}
        {data?.results.length === 0 && <div className="text-xs text-slate-500 italic">No matches.</div>}
        {data?.results.map((r) => (
          <div key={r._id} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
            <div className="flex justify-between mb-1">
              <span className="font-mono font-bold text-[#004B87]">{r._id}</span>
              <span className="font-mono text-[10px] text-slate-500">{r.source} · {r.region} · {r.score?.toFixed(3)}</span>
            </div>
            <p className="text-slate-700 leading-snug">{mode === 'lexical' ? <Highlighted result={r} /> : r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Investigate() {
  const [flagged, setFlagged] = useState([]);
  const [selId, setSelId] = useState(null);
  const [volume, setVolume] = useState(null);
  const [geo, setGeo] = useState(null);
  const [query, setQuery] = useState('');
  const [sameRegion, setSameRegion] = useState(false);
  const [related, setRelated] = useState(null);
  const [searching, setSearching] = useState(false);
  const [lead, setLead] = useState(null);
  const [drafting, setDrafting] = useState(false);

  const sel = flagged.find((f) => f.account_id === selId);

  useEffect(() => {
    const load = () => api.get('/investigate/flagged').then((r) => {
      setFlagged(r.data);
      setSelId((cur) => cur || r.data[0]?.account_id || null);
    }).catch(() => {});
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sel) return undefined;
    const load = () => {
      api.get('/investigate/volume', { params: { mailer_id: sel.mailer_id, minutes: 10 } }).then((r) => setVolume(r.data)).catch(() => {});
      api.get('/investigate/geo', { params: { account_id: sel.account_id, mailer_id: sel.mailer_id } }).then((r) => setGeo(r.data)).catch(() => {});
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [sel?.account_id, sel?.mailer_id]);

  useEffect(() => {
    setLead(null);
  }, [selId]);

  const runSearch = async (text) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setQuery(q);
    setSearching(true);
    try {
      const region = sameRegion && sel ? sel.region : undefined;
      const res = await api.post('/search/related', { queryText: q, region });
      setRelated(res.data);
    } catch (err) {
      alert(`Search failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const draft = async (refresh = false) => {
    if (!sel) return;
    setDrafting(true);
    try {
      const res = await api.post('/leads/draft', { account_id: sel.account_id, refresh });
      setLead(res.data);
    } catch (err) {
      alert(`Lead failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setDrafting(false);
    }
  };

  const approve = async () => {
    const res = await api.post('/leads/approve', { account_id: sel.account_id });
    setLead((cur) => ({ ...cur, ...res.data, cached: true }));
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Flagged accounts</h2>
          {flagged.length === 0 && <p className="text-xs text-slate-400">Nothing flagged yet. Inject the surge on the Live Decisions tab.</p>}
          <div className="space-y-2">
            {flagged.map((f) => (
              <div
                key={f.account_id}
                onClick={() => setSelId(f.account_id)}
                className={`p-3 rounded-md border cursor-pointer transition ${selId === f.account_id ? 'border-[#004B87] bg-blue-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs font-bold text-[#004B87]">{f.account_id}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-[#DA291C]">{f.holds} held</span>
                </div>
                <p className="text-xs text-slate-700 mt-1">{f.name}</p>
                <p className="text-[11px] text-slate-500">{f.flags} flagged · {(f.exposure_usd / f.typical_exposure_usd).toFixed(1)}x typical</p>
              </div>
            ))}
          </div>
        </section>

        <section className="col-span-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Over time</h2>
          <p className="text-[11px] text-slate-500 mb-2">Scans per 10 seconds, last 10 minutes. MongoDB Time Series.</p>
          {volume ? <VolumeChart buckets={volume.buckets} baseline={volume.baseline} /> : <div className="text-xs text-slate-400">Select a flagged account.</div>}
          <div className="mt-auto">
            <CodePanel heading="scans per 10 seconds" code={VOLUME_CODE} highlight="$dateTrunc" />
          </div>
        </section>

        <section className="col-span-5 bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">In place</h2>
          <p className="text-[11px] text-slate-500 mb-2">
            {geo?.cluster ? (
              <>
                <strong className="text-[#DA291C]">{geo.cluster.mailer_count}</strong> of this account's recent scans fall within {geo.cluster.radius_miles} miles of {geo.cluster.city}, against {geo.cluster.all_count - geo.cluster.mailer_count} from every other account.
              </>
            ) : (
              'Geospatial query around the account’s home facility.'
            )}
          </p>
          {geo ? <GeoMap geo={geo} /> : <div className="text-xs text-slate-400">Select a flagged account.</div>}
          <div className="mt-auto pt-2">
            <CodePanel heading="scans inside the circle" code={GEO_CODE} highlight="$geoWithin" />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <section className="col-span-8 bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Reports and Tips</h3>
            <p className="text-xs text-slate-500 mt-0.5">Potentially useful as evidence, if the relevant content can be found.</p>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="(e.g. counterfeit label)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              className="flex-1 text-sm border border-slate-300 rounded px-4 py-2.5 outline-none focus:border-[#004B87] transition"
            />
            <button
              onClick={() => runSearch()}
              disabled={searching}
              className="text-xs uppercase tracking-wider px-5 py-2.5 rounded font-semibold transition shadow-sm whitespace-nowrap bg-[#004B87] hover:bg-[#003660] text-white border border-black disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Compare keyword vs. meaning'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {QUERY_CHIPS.map((c) => (
                <button key={c} onClick={() => runSearch(c)} className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700">
                  {c}
                </button>
              ))}
            </div>
            <label className="text-[11px] text-slate-600 flex items-center space-x-1.5">
              <input type="checkbox" checked={sameRegion} onChange={(e) => setSameRegion(e.target.checked)} />
              <span>Filter to the account's region</span>
            </label>
          </div>
          <div className="flex space-x-5">
            <ResultColumn title="Keyword search" subtitle="Matches the words you typed." data={related?.lexical} mode="lexical" />
            <ResultColumn title="Search by meaning" subtitle="Matches what the report is about." data={related?.vector} mode="vector" />
          </div>
          <CodePanel heading="two ways to search the same collection" code={SEARCH_CODE} highlight={['$search', '$vectorSearch']} />
        </section>

        <section className="col-span-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Lead packet</h3>
            <p className="text-xs text-slate-500 mt-0.5">Drafted from the evidence. A person decides.</p>
          </div>
          <button
            onClick={() => draft(false)}
            disabled={!sel || drafting}
            className="w-full bg-[#004B87] hover:bg-[#003660] text-white font-medium py-2.5 px-4 rounded shadow transition disabled:opacity-50"
          >
            {drafting ? 'Assembling evidence…' : 'Draft lead packet'}
          </button>
          {lead && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lead.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{lead.status}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {lead.cached ? 'generated earlier' : `generated now · ${lead.build_ms} ms`} · {lead.mode}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">{lead.narrative}</p>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Source records</span>
                <div className="flex flex-wrap gap-1.5">
                  {lead.citations.map((c) => (
                    <span key={c} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#004B87]">{c}</span>
                  ))}
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700">{lead.evidence.account.id}</span>
                </div>
              </div>
              {lead.status === 'APPROVED' ? (
                <p className="text-[11px] text-emerald-700">Approved by {lead.approved_by}.</p>
              ) : (
                <div className="flex space-x-2">
                  <button onClick={approve} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded transition">Approve as inspector</button>
                  <button onClick={() => draft(true)} className="px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded text-[11px]">Redraft</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
