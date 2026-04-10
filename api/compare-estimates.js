export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter, carrierBase64, phBase64, carrierMediaType, phMediaType } = req.body;

  const instructions = `You are comparing two property damage repair estimates.

Property: ${matter?.address || 'Unknown'}
Claim: ${matter?.claimNo || 'Unknown'}

INSTRUCTIONS:
1. Extract EVERY line item from BOTH estimates
2. Match items that appear in both (same or similar work)
3. For items only in one estimate, still include them with 0 for the missing side
4. Do NOT summarize - list every individual line item
5. Include overhead, profit, tax as separate line items

Respond with JSON only - no other text:
{
  "lineItems": [
    {
      "description": "exact item description",
      "carrierAmount": 0.00,
      "phAmount": 0.00,
      "gap": 0.00,
      "note": "brief note if relevant"
    }
  ],
  "carrierTotal": 0.00,
  "phTotal": 0.00,
  "totalGap": 0.00,
  "topDisputes": ["top 3 largest gap items"],
  "assessment": "brief overall assessment"
}`;

  let content;

  if (carrierBase64 && phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `First document is the CARRIER estimate. Second document is the POLICYHOLDER estimate.\n\n${instructions}` }
    ];
  } else if (carrierBase64 && !phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'text', text: `This document is the CARRIER estimate.\n\nPOLICYHOLDER ESTIMATE DATA:\n${(phText || 'Not provided').substring(0, 6000)}\n\n${instructions}` }
    ];
  } else if (!carrierBase64 && phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `This document is the POLICYHOLDER estimate.\n\nCARRIER ESTIMATE DATA:\n${(carrierText || 'Not provided').substring(0, 6000)}\n\n${instructions}` }
    ];
  } else {
    content = `CARRIER ESTIMATE:\n${(carrierText || 'Not provided').substring(0, 5000)}\n\nPOLICYHOLDER ESTIMATE:\n${(phText || 'Not provided').substring(0, 5000)}\n\n${instructions}`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content }]
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data });

  try {
    const clean = data.content[0].text.replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(clean));
  } catch(e) {
    return res.status(200).json({ error: 'Parse failed', raw: data.content[0].text });
  }
}
