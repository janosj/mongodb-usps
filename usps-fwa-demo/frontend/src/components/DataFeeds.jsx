import React, { useEffect, useState } from 'react';
import { api, feed } from '../api';
import CodePanel from './CodePanel';
import JsonView from './JsonView';

const NEW_KEYS = ['device_id', 'label_style'];

const INSERT_CODE = `// The same call as yesterday. Nothing to migrate.
db.pieces.insertOne(payload)

// Yesterday:  { label_id, account_id, scans: [{ event, at, where }] }
// Today:      { label_id, account_id, label_style, scans: [{ event, at, where, device_id }] }

// And you can ask about the new field immediately:
db.pieces.aggregate([
  { $match: { "scans.device_id": { $exists: true } } },
  { $group: { _id: { $arrayElemAt: ["$scans.device_id", 0] }, flagged: { $sum: ... } } }
])`;

const VALIDATOR_CODE = `db.runCommand({
  collMod: "pieces",
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["label_id", "account_id", "scans"]   // new fields are still welcome
  } },
  validationAction: "error"
})`;

export default function DataFeeds() {
  const [status, setStatus] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [sample, setSample] = useState(null);
  const [byDevice, setByDevice] = useState([]);
  const [guard, setGuard] = useState({ enabled: false });
  const [validationError, setValidationError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    const load = () => {
      feed.get('/status').then((r) => setStatus(r.data)).catch(() => setStatus(null));
      api.get('/schema/fields').then((r) => setCoverage(r.data)).catch(() => {});
      api.get('/labels/sample').then((r) => setSample(r.data)).catch(() => {});
      api.get('/schema/by-device').then((r) => setByDevice(r.data)).catch(() => {});
      api.get('/guardrail').then((r) => setGuard(r.data)).catch(() => {});
    };
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const setVersion = (version) => feed.post('/control', { version, running: true }).then((r) => setStatus(r.data));
  const toggleGuard = () => api.post('/guardrail', { enabled: !guard.enabled }).then((r) => setGuard(r.data));
  const sendMalformed = async () => {
    setNote(null);
    try {
      const res = await api.post('/ingest/malformed');
      setNote(res.data.accepted ? 'Accepted: no guardrail is on, so the incomplete record got in (and was removed).' : null);
    } catch (err) {
      if (err.response?.data?.isValidationError) setValidationError(err.response.data);
      else alert(err.response?.data?.error || err.message);
    }
  };

  const newRows = coverage?.rows.filter((r) => r.is_new) || [];
  const v2 = status?.version === 2;

  return (
    <div className="flex flex-col space-y-6">
      <div className="grid grid-cols-12 gap-8 items-stretch">
        <section className="col-span-5 flex flex-col space-y-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Upstream scan system</h2>
              <div className={`p-4 rounded-md border ${v2 ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm font-bold text-[#004B87]">Feed version {status ? status.version : '–'}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">{status?.running ? 'sending' : 'paused'}</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {v2 ? 'The upstream team added two fields: device_id on each scan and label_style on the label.' : 'The original record shape.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVersion(v2 ? 1 : 2)}
              className="w-full bg-[#004B87] hover:bg-[#003660] text-white font-medium py-2.5 px-4 rounded shadow transition"
            >
              {v2 ? 'Roll the upstream system back to v1' : 'Upstream system upgrades to v2 (new fields)'}
            </button>
            <CodePanel heading="zero-transform data assembly" note="New fields in the payload are stored as they arrive. Schema evolution is automatic." code={INSERT_CODE} highlight="insertOne" />
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Flexible, with guardrails</h2>
            <p className="text-xs text-slate-600">New fields are welcome. Required fields are enforced when you want them to be.</p>
            <div className="flex space-x-3">
              <button onClick={toggleGuard} className={`flex-1 text-xs font-semibold px-3 py-2 rounded border transition ${guard.enabled ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}>
                {guard.enabled ? '✓ Guardrail on (click to remove)' : 'Apply required-field guardrail'}
              </button>
              <button onClick={sendMalformed} className="flex-1 text-xs font-semibold px-3 py-2 rounded bg-[#DA291C] hover:bg-[#b82217] text-white transition">
                Send an incomplete record
              </button>
            </div>
            {note && <p className="text-[11px] text-amber-700">{note}</p>}
            <CodePanel heading="schema validation" code={VALIDATOR_CODE} highlight="required" />
          </div>
        </section>

        <section className="col-span-7 flex flex-col space-y-4">
          <div className="relative flex-1 min-h-[22rem]">
            <div className="absolute inset-0 bg-[#1E293B] text-slate-100 rounded-lg p-5 shadow-sm border border-slate-700 flex flex-col">
              <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-3 flex-shrink-0">
                <span className="text-xs font-mono text-slate-400">Newest record · Target collection: pieces</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">BSON / JSON View</span>
              </div>
              <pre className="font-mono text-xs overflow-y-auto flex-1 leading-relaxed pr-2">
                <JsonView doc={sample?.doc && { ...sample.doc }} amberKeys={NEW_KEYS} placeholder="// Start the scan feed, then upgrade it to v2" />
              </pre>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <section className="col-span-7 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Fields in the newest {coverage?.sample ?? 500} records</h3>
            <p className="text-xs text-slate-500 mt-0.5">Share of records carrying each field. New fields appear on their own.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 max-h-72 overflow-y-auto pr-1">
            {(coverage?.rows || []).map((r) => (
              <div key={r.path} className="flex items-center space-x-2 text-xs">
                <span className={`font-mono w-40 truncate ${r.is_new ? 'text-amber-700 font-bold' : 'text-slate-700'}`}>{r.path}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div className={`h-full ${r.is_new ? 'bg-amber-400' : 'bg-[#004B87]'}`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-9 text-right text-slate-500">{r.pct}%</span>
                {r.is_new && <span className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-800">NEW</span>}
              </div>
            ))}
          </div>
          {newRows.length === 0 && <p className="text-xs text-slate-400 mt-3">No new fields yet. Upgrade the upstream system to v2.</p>}
        </section>

        <section className="col-span-5 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Utilize the new field in fraud analysis</h3>
            <p className="text-xs text-slate-500 mt-0.5">Records grouped by device_id, a field that did not exist yesterday.</p>
          </div>
          {byDevice.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing yet. This fills in as v2 records arrive.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="pb-1">Device</th><th className="pb-1 text-right">Labels</th><th className="pb-1 text-right">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {byDevice.map((d) => (
                  <tr key={d.device_id} className="border-t border-slate-100">
                    <td className="py-1.5 font-mono font-semibold text-slate-700">{d.device_id}</td>
                    <td className="py-1.5 text-right text-slate-600">{d.labels}</td>
                    <td className={`py-1.5 text-right font-bold ${d.flagged ? 'text-[#DA291C]' : 'text-slate-400'}`}>{d.flagged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {validationError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full border-t-8 border-[#DA291C] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-red-100 text-[#DA291C] flex items-center justify-center font-bold">!</div>
                <h3 className="text-lg font-bold text-slate-900">Database Governance Alert: MongoServerError (Code 121)</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                The insert was rejected by the database. The record failed <code>$jsonSchema</code> validation because a required field is missing. Flexible means new fields are welcome, not that anything goes.
              </p>
              <div className="bg-slate-900 text-red-400 p-4 rounded-md font-mono text-xs overflow-auto max-h-56">
                <pre>{JSON.stringify(validationError, null, 2)}</pre>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-3 flex justify-end">
              <button onClick={() => setValidationError(null)} className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded font-medium transition">
                Acknowledge and Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
