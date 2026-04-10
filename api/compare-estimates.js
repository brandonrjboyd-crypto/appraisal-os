const instructions = `You are extracting and comparing two property damage repair estimates.

Property: ${matter?.address || 'Unknown'}
Claim: ${matter?.claimNo || 'Unknown'}

INSTRUCTIONS:
- Extract EVERY single line item from the carrier estimate with its exact dollar amount
- Extract EVERY single line item from the policyholder estimate with its exact dollar amount  
- Try to match items that describe the same work and show them on the same row
- For items that only appear in one estimate, show them with 0 for the other side
- Do NOT skip any items - include all line items, overhead, profit, tax, subtotals
- Use the exact description from the estimate, do not paraphrase

Respond with JSON only:
{
  "lineItems": [
    {
      "description": "exact item description from estimate",
      "carrierAmount": 0.00,
      "phAmount": 0.00,
      "gap": 0.00,
      "note": ""
    }
  ],
  "carrierTotal": 0.00,
  "phTotal": 0.00,
  "totalGap": 0.00,
  "topDisputes": ["largest gap items"],
  "assessment": "brief summary"
}`;
