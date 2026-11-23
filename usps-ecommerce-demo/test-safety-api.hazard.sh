curl -s -X POST http://localhost:5002/api/v1/compliance-check \
  -H "Content-Type: application/json" \
  -d '{
    "mail_class": "Priority Mail Commercial",
    "contents_declaration": "Cordless Handheld Diagnostic Scanner (Lithium Battery)",
    "destination_zip": "07030"
  }' | jq .

