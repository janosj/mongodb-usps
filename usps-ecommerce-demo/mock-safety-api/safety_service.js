import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(express.json());

const PORT = process.env.SAFETY_API_PORT || 5002;
const isV2 = process.argv.includes('--v2');

console.log(`[USPS Pub 52 Compliance Service] Active Profile: ${isV2 ? 'VERSION 2.0 (Lithium-Ion / 49 CFR Mandate)' : 'VERSION 1.0 (Legacy Standard)'}`);

app.post('/api/v1/compliance-check', (req, res) => {
  const { mail_class, package: pkg, contents_declaration, destination_zip } = req.body;
  const isBattery = /battery|scanner|cordless|phone|laptop|cell/i.test(contents_declaration || '');

  if (!isV2) {
    // API Version 1.0 (Baseline non-HAZMAT check)
    return res.json({
      api_version: "1.0",
      audit_timestamp: new Date().toISOString(),
      status: "CLEARED_ALL_MODES",
      hazard_class: "NONE",
      air_eligible: true,
      surcharge: 0.00,
      authorized_mail_class: mail_class || "USPS Ground Advantage"
    });
  }

  // API Version 2.0 (USPS Pub 52 / 49 CFR enhanced battery compliance)
  if (isBattery) {
    return res.json({
      api_version: "2.0",
      audit_timestamp: new Date().toISOString(),
      status: "RESTRICTED_GROUND_ONLY",
      hazard_class: "CLASS_9_MISCELLANEOUS",
      lithium_battery_spec: {
        un_number: "UN3481",
        proper_shipping_name: "Lithium ion batteries contained in equipment",
        packaging_instruction: "USPS Pub 52 349.242",
        watt_hours: 65.0,
        max_allowed_watt_hours: 100.0,
        surface_transport_only: true,
        required_markings: [
          "DOT-APPROVED-LITHIUM-BATTERY-MARK",
          "SURFACE-TRANSPORTATION-ONLY"
        ]
      },
      service_reroute: {
        requested_service: mail_class,
        authorized_service: "USPS Ground Advantage",
        reason: "Pub 52 Mandate: Equipment containing lithium-ion batteries diverted from air to surface network"
      },
      regulatory_surcharge: 1.25
    });
  }

  return res.json({
    api_version: "2.0",
    audit_timestamp: new Date().toISOString(),
    status: "CLEARED_ALL_MODES",
    hazard_class: "NONE",
    air_eligible: true,
    regulatory_surcharge: 0.00,
    authorized_mail_class: mail_class
  });
});

app.listen(PORT, () => {
  console.log(`USPS Compliance API listening on port ${PORT}`);
});

