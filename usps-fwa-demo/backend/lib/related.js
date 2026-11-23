import { performance } from 'perf_hooks';
import { config } from './config.js';
import { col } from './db.js';
import { embed } from './embeddings.js';

// Runs keyword search and search by meaning side by side on the same collection.
export async function searchRelated(queryText, region) {
  const tips = col(config.coll.tips);
  const { text: TEXT_INDEX, vector: VECTOR_INDEX } = config.searchIndexes;

  const vectorPart = (async () => {
    const t0 = performance.now();
    const [queryVector] = await embed([queryText], 'query');
    const embedMs = performance.now() - t0;
    const t1 = performance.now();
    const stage = { index: VECTOR_INDEX, path: 'embedding', queryVector, numCandidates: 100, limit: 8 };
    if (region) stage.filter = { region: { $eq: region } };
    const results = await tips
      .aggregate([
        { $vectorSearch: stage },
        { $project: { text: 1, source: 1, region: 1, received_at: 1, score: { $meta: 'vectorSearchScore' } } },
      ])
      .toArray();
    return { results, ms: Math.round(performance.now() - t1), embed_ms: Math.round(embedMs) };
  })();

  const lexicalPart = (async () => {
    const t0 = performance.now();
    const results = await tips
      .aggregate([
        { $search: { index: TEXT_INDEX, text: { query: queryText, path: 'text' }, highlight: { path: 'text' } } },
        { $limit: 8 },
        { $project: { text: 1, source: 1, region: 1, received_at: 1, score: { $meta: 'searchScore' }, highlights: { $meta: 'searchHighlights' } } },
      ])
      .toArray();
    return { results, ms: Math.round(performance.now() - t0) };
  })();

  const [vector, lexical] = await Promise.all([vectorPart, lexicalPart]);
  return { query: queryText, vector, lexical };
}
