import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;
const COLL_MANIFESTS = process.env.COLL_MANIFESTS;
const COLL_EXCEPTIONS = process.env.COLL_EXCEPTIONS;
const SAFETY_API_URL = process.env.SAFETY_API_URL || 'http://localhost:5002/api/v1/compliance-check';

let db;
let client;

async function connectToMongo() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`Connected to MongoDB Atlas: Database [${DB_NAME}]`);
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
}


// Seed Route to reset demo state (Manifests + Exceptions with Embeddings)
app.post('/api/seed', async (req, res) => {
  try {
    // 1. Seed shipment_manifests
    const manifestsCol = db.collection(COLL_MANIFESTS);
    await manifestsCol.deleteMany({});

    const seedDocuments = [
      {
        _id: "USPS-MNF-77401",
        source_platform: "Shopify-DTC",
        client_account_id: "SHPFY-9921",
        mail_class: "USPS Ground Advantage",
        origin_zip: "30301",
        destination_zip: "90210-1234",
        package: {
          weight_oz: 14.2,
          declared_value: 45.00,
          dimensions: { length: 8.0, width: 6.0, height: 2.5 }
        },
        contents_declaration: "Organic Cotton T-Shirt",
        created_at: new Date()
      },
      {
        _id: "USPS-MNF-88902",
        source_platform: "Apex-Logistics-3PL",
        client_account_id: "APEX-ENT-441",
        mail_class: "Priority Mail Commercial",
        origin_zip: "60607",
        destination_zip: "07030-4321",
        package: {
          weight_oz: 38.4,
          declared_value: 749.99,
          dimensional_weight: 42.0
        },
        contents_declaration: "Cordless Handheld Diagnostic Scanner",
        warehouse_metadata: {
          distribution_center_id: "DC-MIDWEST-04",
          bay_slot: "K-12-R3",
          carrier_routing_codes: ["SORT-EAST", "HUB-EWR"],
          cross_dock: true
        },
        enterprise_extensions: [
          { key: "EDI_TRANSACTION_ID", value: "856-SHIP-9948210" },
          { key: "BATTERY_INTERNAL_MODEL", value: "LIPO-CELL-4S" },
          { key: "SUSTAINABILITY_AUDIT", carbon_offset_metric_kg: 0.32 }
        ],
        created_at: new Date()
      }
    ];

    await manifestsCol.insertMany(seedDocuments);

    // 2. Seed delivery_exceptions
    const exceptionsCol = db.collection(COLL_EXCEPTIONS);
    await exceptionsCol.deleteMany({});

    const sampleExceptions = [
      {
        _id: "EXC-109923",
        tracking_number: "9400111899562810992301",
        manifest_id: "USPS-MNF-88902",
        un_number: "UN3481",
        carrier_route: "C004",
        facility_zip: "07030",
        incident_type: "HAZMAT_CONTAINMENT",
        log_narrative: "Pouch torn on sorting belt 3. Lithium-ion battery casing exposed with visible scorch marks and faint burning odor. Package isolated per Pub 52 protocol.",
        reported_at: new Date("2026-10-27T14:15:00Z")
      },
      {
        _id: "EXC-109924",
        tracking_number: "9400111899562810992408",
        manifest_id: "USPS-MNF-77401",
        un_number: "NONE",
        carrier_route: "R012",
        facility_zip: "90210",
        incident_type: "WEATHER_DELAY",
        log_narrative: "Flash flooding along canyon delivery route prevented carrier vehicle access. Parcel returned to local postal annex for redelivery attempt.",
        reported_at: new Date("2026-10-27T15:30:00Z")
      },
      {
        _id: "EXC-109925",
        tracking_number: "9400111899562810992515",
        manifest_id: "USPS-MNF-66209",
        un_number: "UN3480",
        carrier_route: "C018",
        facility_zip: "60607",
        incident_type: "IMPROPER_LABELING",
        log_narrative: "Air cargo container manifest mismatch: shipment tagged as Priority Mail Express contained loose secondary cells without surface-only markings.",
        reported_at: new Date("2026-10-27T16:05:00Z")
      }
    ];

    // Compute embeddings via OpenAI for vector search
    for (const exc of sampleExceptions) {
      const embRes = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: 'text-embedding-3-small',
          input: exc.log_narrative
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      exc.embedding = embRes.data.data[0].embedding;
    }

    await exceptionsCol.insertMany(sampleExceptions);

    res.json({
      success: true,
      manifestsCount: seedDocuments.length,
      exceptionsCount: sampleExceptions.length
    });
  } catch (error) {
    console.error("Seed failed:", error);
    res.status(500).json({ error: error.message });
  }
});


// Fetch all manifests
app.get('/api/manifests', async (req, res) => {
  try {
    const docs = await db.collection(COLL_MANIFESTS).find({}).toArray();
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// In-place Real-Time Safety Audit Enrichment ($set)
app.post('/api/manifests/:id/verify-safety', async (req, res) => {
  const { id } = req.params;
  try {
    const manifest = await db.collection(COLL_MANIFESTS).findOne({ _id: id });
    if (!manifest) {
      return res.status(404).json({ error: 'Manifest not found' });
    }

    // Call external Pub 52 Compliance Service
    const complianceResponse = await axios.post(SAFETY_API_URL, manifest);
    const auditData = complianceResponse.data;

    // In-place document update via $set
    await db.collection(COLL_MANIFESTS).updateOne(
      { _id: id },
      { $set: { safety_audit: auditData } }
    );

    const updatedDoc = await db.collection(COLL_MANIFESTS).findOne({ _id: id });
    return res.json({ success: true, document: updatedDoc });

  } catch (error) {
    // Catch MongoDB Schema Validation Failures (Code 121)
    if (error.code === 121 || error.name === 'MongoServerError') {
      return res.status(400).json({
        success: false,
        isValidationError: true,
        code: error.code,
        name: error.name,
        message: error.message,
        errInfo: error.errInfo || null
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
      details: error.response ? error.response.data : null
    });
  }
});


// Atlas Search: Exact Lexical with Multi-Field Highlighting
app.get('/api/search/lexical', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  try {
    const pipeline = [
      {
        $search: {
          index: "default",
          text: {
            query: q,
            path: ["tracking_number", "un_number", "facility_zip", "log_narrative"]
          },
          highlight: {
            path: ["tracking_number", "un_number", "facility_zip", "log_narrative"]
          }
        }
      },
      { $limit: 6 },
      {
        $project: {
          tracking_number: 1,
          un_number: 1,
          facility_zip: 1,
          carrier_route: 1,
          incident_type: 1,
          log_narrative: 1,
          score: { $meta: "searchScore" },
          highlights: { $meta: "searchHighlights" }
        }
      }
    ];

    const results = await db.collection(COLL_EXCEPTIONS).aggregate(pipeline).toArray();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Atlas Search: Semantic Vector Search
app.post('/api/search/vector', async (req, res) => {
  const { queryText } = req.body;
  if (!queryText) return res.json([]);

  try {
    // Generate embedding using OpenAI
    const embeddingResponse = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: 'text-embedding-3-small',
        input: queryText
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const queryVector = embeddingResponse.data.data[0].embedding;

    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 20,
          limit: 5
        }
      },
      {
        $project: {
          tracking_number: 1,
          un_number: 1,
          log_narrative: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];

    const results = await db.collection(COLL_EXCEPTIONS).aggregate(pipeline).toArray();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

connectToMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`USPS eCommerce Backend running on port ${PORT}`);
  });
});

