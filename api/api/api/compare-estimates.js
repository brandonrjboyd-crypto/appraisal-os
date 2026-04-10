export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter, carrierBase64, phBase64, carrierMediaType, phMediaType } = req.body;
  if (!carrierText && !phText) return res.status(400).json({ error: 'No estimate text provided' });

  // Build message content - use PDFs directly if available
  let content;
  if (carrierBase64 && phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `Compare these two property damage estimates for ${matter?.address || 'the property'} (Claim: ${matter?.claimNo || 'unknown'}).

The first document is the CARRIER estimate. The second is the POLICYHOLDER estimate.

Produce a structured comparison. Respond with JSON only:
{
  "lineItems": [{"description": "...", "carrierAmount": 0, "phAmount": 0, "gap": 0, "note": "..."}],
  "carrierTotal": 0,
  "phTotal": 0,
  "totalGap": 0,
  "topDisputes": ["...", "...", "..."],
  "assessment": "..."
}` }
    ];
  } else {
    content = `Compare these two property damage estimates.

Property: ${matter?.address || 'Unknown'}
Claim: ${matter?.claimNo || 'Unknown'}

CARRIER ESTIMATE:
${(carrierText || 'Not provided').substring(0, 4000)}

POLICYHOLDER ESTIMATE:
${(phText || 'Not provided').substring(0, 4000)}

Respond with JSON only:
{
  "lineItems": [{"description": "...", "carrierAmount": 0, "phAmount": 0, "gap": 0, "note": "..."}],
  "carrierTotal": 0,
  "phTotal": 0,
  "totalGap": 0,
  "topDisputes": ["...", "...", "..."],
  "assessment": "..."
}`;
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
      max_tokens: 4000,
      messages: [{ role: 'user', content }]
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data });

  try {
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(clean));
  } catch(e) {
    return res.status(200).json({ error: 'Could not parse', raw: data.content[0].text });
  }
}
