curl -s -X POST http://localhost:5002/api/v1/compliance-check \
  -H "Content-Type: application/json" \
  -d '{
    "mail_class": "USPS Ground Advantage",
    "contents_declaration": "Organic Cotton T-Shirt",
    "destination_zip": "90210"
  }' | jq .

