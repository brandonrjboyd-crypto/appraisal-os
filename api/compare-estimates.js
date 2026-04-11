export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter, carrierBase64, phBase64, carrierMediaType, phMediaType } = req.body;

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

Respond with JSON only - no explanation text before or after:
{
  "lineItems": [
    {
      "description": "exact item description",
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

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        messages: [{ role: 'user', content }]
      })
    });
  } catch(fetchErr) {
    return res.status(500).json({ error: 'Fetch failed: ' + fetchErr.message });
  }

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    console.error('Anthropic error:', msg);
    return res.status(500).json({ error: msg });
  }

  try {
    const raw = data.content[0].text;
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(200).json({ error: 'No JSON in response', raw: raw.substring(0, 500) });
    }
    return res.status(200).json(JSON.parse(raw.substring(jsonStart, jsonEnd + 1)));
  } catch(e) {
    return res.status(200).json({ error: 'Parse failed: ' + e.message });
  }
}
