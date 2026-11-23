import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SCHEMA_VALIDATOR_SCRIPT = JSON.stringify({
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "safety_audit": {
        "bsonType": "object",
        "required": ["api_version", "status"],
        "properties": {
          "api_version": {
            "enum": ["2.0"],
            "description": "Pub 52 Mandate: Audits must strictly follow Safety API v2.0"
          },
          "lithium_battery_spec": {
            "bsonType": "object",
            "properties": {
              "watt_hours": {
                "bsonType": "number",
                "maximum": 100.0,
                "description": "USPS Pub 52 ceiling: Lithium-ion battery packs cannot exceed 100 Wh"
              }
            }
          }
        }
      }
    }
  }
}, null, 2);

export default function App() {
  const [seedingState, setSeedingState] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [manifests, setManifests] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Search tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchMode, setSearchMode] = useState('lexical');

  const handleSeed = async () => {
    setSeedingState('loading');
    try {
      // 1. Trigger backend reset & embeddings generation
      await axios.post('http://localhost:5001/api/seed');

      // 2. Fetch fresh manifests and re-select the first record
      const res = await axios.get('http://localhost:5001/api/manifests');
      setManifests(res.data);
      if (res.data.length > 0) {
        setSelectedId(res.data[0]._id);
      }

      // 3. Reset the rest of the board (Option 4)
      setSearchQuery('');
      setSearchResults([]);
      setSearchMode('lexical'); // Lexical is active by default
      setValidationError(null);
      setShowCode(false); // Collapses the drawer if it was open

      // 4. Success feedback (Option 1)
      setSeedingState('success');
      setTimeout(() => {
        setSeedingState('idle');
      }, 2500);
    } catch (err) {
      console.error(err);
      alert(`Reset failed: ${err.message}`);
      setSeedingState('idle');
    }
  };

  useEffect(() => {
    fetchManifests();
  }, []);

  const fetchManifests = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/manifests');
      setManifests(res.data);
      if (res.data.length > 0 && !selectedId) {
        setSelectedId(res.data[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectedDoc = manifests.find(m => m._id === selectedId);

  const handleVerify = async () => {
    setLoading(true);
    setValidationError(null);
    try {
      const res = await axios.post(`http://localhost:5001/api/manifests/${selectedId}/verify-safety`);
      if (res.data.success) {
        setManifests(prev => prev.map(m => m._id === selectedId ? res.data.document : m));
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.isValidationError) {
        setValidationError(err.response.data);
      } else {
        alert(err.response?.data?.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(SCHEMA_VALIDATOR_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

const executeSearch = async (mode) => {
    if (!searchQuery) return;
    setSearchMode(mode);
    try {
      if (mode === 'lexical') {
        const res = await axios.get(`http://localhost:5001/api/search/lexical?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } else {
        const res = await axios.post('http://localhost:5001/api/search/vector', { queryText: searchQuery });
        setSearchResults(res.data);
      }
    } catch (err) {
      alert(`Search failed: ${err.message}`);
    }
  };

// Formats JSON: starts entirely green, highlights "safety_audit" in amber-400 once present
  const renderFormattedJson = (doc) => {
    if (!doc) return <span className="text-slate-400">// Select a manifest to view</span>;

    const jsonString = JSON.stringify(doc, null, 2);
    const lines = jsonString.split('\n');

    // If no safety_audit exists yet, render all lines in green
    if (!doc.safety_audit) {
      return lines.map((line, index) => (
        <span key={index} className="text-emerald-400 block">
          {line}
        </span>
      ));
    }

    let inSafetyAudit = false;
    let braceDepth = 0;

    return lines.map((line, index) => {
      if (line.includes('"safety_audit":')) {
        inSafetyAudit = true;
      }

      if (inSafetyAudit) {
        const opens = (line.match(/\{/g) || []).length;
        const closes = (line.match(/\}/g) || []).length;
        braceDepth += opens - closes;

        const isLastAuditLine = braceDepth <= 0;
        if (isLastAuditLine) {
          inSafetyAudit = false;
        }

        return (
          <span key={index} className="text-amber-400 font-semibold block">
            {line}
          </span>
        );
      }

      return (
        <span key={index} className="text-emerald-400 block">
          {line}
        </span>
      );
    });
  };


// Reconstructs text using Atlas Search highlights metadata
  const renderHighlightedField = (result, fieldPath) => {
    const originalValue = result[fieldPath] || '';

    // If there are no highlights or none for this path, return raw text
    if (!result.highlights || result.highlights.length === 0) {
      return String(originalValue);
    }

    const matchObj = result.highlights.find(h => h.path === fieldPath);
    if (!matchObj || !matchObj.texts || matchObj.texts.length === 0) {
      return String(originalValue);
    }

    // Atlas returns texts as array of objects: { value: "...", type: "hit" | "text" }
    return matchObj.texts.map((segment, idx) => {
      if (segment.type === 'hit') {
        return (
          <mark
            key={idx}
            className="bg-amber-300 text-slate-900 px-1 py-0.5 rounded font-bold"
          >
            {segment.value}
          </mark>
        );
      }
      return <span key={idx}>{segment.value}</span>;
    });
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* USPS Header */}
      <header className="bg-[#004B87] text-white px-8 py-4 flex items-center justify-between shadow-md border-b-4 border-[#DA291C]">
        <div className="flex items-center space-x-4">
          <div className="bg-white text-[#004B87] font-black text-xl px-2.5 py-1 rounded tracking-tighter">USPS</div>
          <h1 className="text-xl font-bold tracking-tight">eCommerce Data Platform</h1>
        </div>
        <button
          onClick={handleSeed}
          disabled={seedingState === 'loading'}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded transition shadow-sm border ${
            seedingState === 'loading'
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/40 cursor-wait'
              : seedingState === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-white/10 hover:bg-white/20 border-white/30 text-white'
          }`}
        >
          {seedingState === 'loading' && '↻ Resetting Demo State...'}
          {seedingState === 'success' && '✓ Demo State Restored!'}
          {seedingState === 'idle' && 'Reset Demo Data'}        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 flex flex-col space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Section: Side-by-Side 12-Column Grid */}
        <div className="grid grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Manifest Ingestion & Validation Helper (5 cols) */}
          <section className="col-span-5 flex flex-col space-y-4">
            {/* Manifest Ingestion Card */}
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Ingested eCommerce Manifests
                </h2>
                <div className="space-y-3">
                  {manifests.map((m) => (
                    <div
                      key={m._id}
                      onClick={() => setSelectedId(m._id)}
                      className={`p-4 rounded-md border cursor-pointer transition ${
                        selectedId === m._id
                          ? 'border-[#004B87] bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-sm font-bold text-[#004B87]">{m._id}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                          {m.source_platform}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        <strong>Contents:</strong> {m.contents_declaration}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">{m.mail_class}</span>
                        {m.safety_audit && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.safety_audit.status === 'APPROVED' || m.safety_audit.status === 'CLEARED_ALL_MODES'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {m.safety_audit.status} ({m.safety_audit.api_version})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Action Button */}
              <button
                onClick={handleVerify}
                disabled={loading || !selectedId}
                className="w-full bg-[#004B87] hover:bg-[#003660] text-white font-medium py-2.5 px-4 rounded shadow transition disabled:opacity-50"
              >
                {loading ? 'Evaluating Pub 52 Compliance...' : 'Verify Safety & Hazmat Compliance (API Call)'}
              </button>

              {/* Collapsible Code Trigger Bar */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1 px-1 border-t border-slate-100"
                >
                  <span className="flex items-center space-x-1.5">
                    <span className="font-mono text-[#004B87] font-bold">&lt;/&gt;</span>
                    <span>{showCode ? 'Hide database operation' : 'Show code (database operation)'}</span>
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                    {showCode ? '▲ Collapse' : '▼ Expand'}
                  </span>
                </button>

                {/* Collapsible $set Operation Panel */}
                {showCode && (
                  <div className="mt-2 bg-slate-900 text-slate-100 p-4 rounded-md border border-slate-700/80 shadow-inner">
                    <div className="mb-2.5 pb-2 border-b border-slate-800">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block">
                        zero-transform data assembly
                      </span>
                      <p className="text-xs text-slate-400 mt-1 leading-snug">
                        API responses are merged directly into the main document. Schema evolution is automatic.
                      </p>
                    </div>
                    <pre className="font-mono text-xs leading-relaxed text-blue-300 overflow-x-auto">
{`db.collection('shipment_manifests').updateOne(
  { _id: "${selectedId || 'TARGET_MANIFEST_ID'}" },
  {
    $set: {
`}      <span className="text-amber-400">safety_audit: apiResponse.data</span>
{`    }
  }
);`}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Single-line Governance Clipboard Helper */}
            <div className="bg-slate-100 px-4 py-3 rounded-lg border border-slate-200 flex items-center justify-center space-x-2 text-xs">
              <span className="text-slate-600">Looking for Schema Validation?</span>
              <button
                onClick={handleCopyClipboard}
                className="font-semibold text-[#004B87] hover:text-[#003660] underline inline-flex items-center space-x-1"
              >
                <span>{copied ? '✓ Copied! Now apply via Compass!' : 'Copy Pub 52 validator to clipboard'}</span>
              </button>
            </div>
          </section>

          {/* Right Column: JSON Document Viewer (Constrained to match Left Column height with scrollbar) */}
          <section className="col-span-7 relative min-h-0">
            <div className="absolute inset-0 bg-[#1E293B] text-slate-100 rounded-lg p-5 shadow-sm border border-slate-700 flex flex-col">
              <div className="flex justify-between items-center pb-3 border-b border-slate-700 mb-3 flex-shrink-0">
                <span className="text-xs font-mono text-slate-400">Target Collection: shipment_manifests</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">BSON / JSON View</span>
              </div>
              <pre className="font-mono text-xs overflow-y-auto flex-1 leading-relaxed pr-2">
                {renderFormattedJson(selectedDoc)}
              </pre>
            </div>
          </section>
        </div>

        {/* Bottom Section: Full-Width Search Panel (Act V) */}
        <section className="w-full bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Incident Analysis</h3>
            <p className="text-xs text-slate-500 mt-0.5">Fast, accurate, cost-effective information retrieval at scale</p>
          </div>

          {/* Single-Row Input & Action Buttons */}
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="(e.g. UN3481, 07030, smoking power pack, fire hazard)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeSearch(searchMode);
              }}
              className="flex-1 text-sm border border-slate-300 rounded px-4 py-2.5 outline-none focus:border-[#004B87] transition"
            />

            {/* Lexical Search Action Button */}
            <button
              type="button"
              onClick={() => executeSearch('lexical')}
              className={`text-xs uppercase tracking-wider px-5 py-2.5 rounded font-semibold transition shadow-sm whitespace-nowrap ${
                searchMode === 'lexical'
                  ? 'bg-[#004B87] hover:bg-[#003660] text-white border border-black'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Lexical Search
            </button>

            {/* Semantic (Vector) Search Action Button */}
            <button
              type="button"
              onClick={() => executeSearch('vector')}
              className={`text-xs uppercase tracking-wider px-5 py-2.5 rounded font-semibold transition shadow-sm whitespace-nowrap ${
                searchMode === 'vector'
                  ? 'bg-[#004B87] hover:bg-[#003660] text-white border border-black'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Semantic (Vector) Search
            </button>
          </div>

          {/* Search Results Grid (Kept Unchanged) */}
          {searchResults.length > 0 && (
            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((r) => (
                <div
                  key={r._id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-col justify-between shadow-sm hover:border-slate-300 transition"
                >
                  <div className="space-y-2.5">
                    {/* Header: Tracking Number & Score */}
                    <div className="flex justify-between items-start pb-2 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Tracking Identifier
                        </span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {renderHighlightedField(r, 'tracking_number')}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono bg-blue-50 text-[#004B87] border border-blue-200 px-2 py-0.5 rounded font-semibold">
                        Score: {r.score?.toFixed(3)}
                      </span>
                    </div>

                    {/* Meta Fields: UN Code, Facility ZIP, Route */}
                    <div className="grid grid-cols-3 gap-2 py-1 bg-white p-2 rounded border border-slate-100 font-mono text-[11px]">
                      <div>
                        <span className="text-[9px] font-sans font-medium text-slate-400 uppercase block">
                          Hazmat Code
                        </span>
                        <span className="font-semibold text-slate-700">
                          {renderHighlightedField(r, 'un_number')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-sans font-medium text-slate-400 uppercase block">
                          Facility ZIP
                        </span>
                        <span className="font-semibold text-slate-700">
                          {renderHighlightedField(r, 'facility_zip')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-sans font-medium text-slate-400 uppercase block">
                          Carrier Route
                        </span>
                        <span className="font-semibold text-slate-700">
                          {r.carrier_route || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Incident Narrative */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Carrier Exception Log
                      </span>
                      <p className="text-slate-700 leading-relaxed bg-white p-2.5 rounded border border-slate-100">
                        {renderHighlightedField(r, 'log_narrative')}
                      </p>
                    </div>
                  </div>

                  {/* Incident Type Footer Badge */}
                  {r.incident_type && (
                    <div className="mt-3 pt-2 border-t border-slate-200 flex justify-end">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                        {r.incident_type}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>


      {/* Code 121 Schema Validation Error Modal */}
      {validationError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full border-t-8 border-[#DA291C] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-red-100 text-[#DA291C] flex items-center justify-center font-bold">!</div>
                <h3 className="text-lg font-bold text-slate-900">
                  Database Governance Alert: MongoServerError (Code 121)
                </h3>
              </div>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                The atomic <code>$set</code> operation was rejected by the MongoDB Atlas operational engine. 
                Document failed <code>$jsonSchema</code> validation because the API returned a payload not authorized under USPS Publication 52 compliance rules.
              </p>
              <div className="bg-slate-900 text-red-400 p-4 rounded-md font-mono text-xs overflow-auto max-h-56">
                <pre>{JSON.stringify(validationError, null, 2)}</pre>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-3 flex justify-end">
              <button
                onClick={() => setValidationError(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-2 rounded font-medium transition"
              >
                Acknowledge and Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

