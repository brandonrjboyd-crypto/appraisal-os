export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter, carrierBase64, phBase64, carrierMediaType, phMediaType } = req.body;

  const jsonFormat = `{
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
  "topDisputes": ["item with largest gap 1", "item 2", "item 3"],
  "assessment": "brief summary of key differences"
}`;

  let content;

  if (carrierBase64 && phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `You are comparing two insurance repair estimates for property: ${matter?.address || 'Unknown'}, Claim: ${matter?.claimNo || 'Unknown'}.

DOCUMENT 1 = CARRIER ESTIMATE (insurance company's estimate)
DOCUMENT 2 = POLICYHOLDER ESTIMATE (contractor/public adjuster estimate)

Step 1: Extract ALL line items from DOCUMENT 1 (carrier). List every line item with its dollar amount as "carrierAmount".
Step 2: Extract ALL line items from DOCUMENT 2 (policyholder). List every line item with its dollar amount as "phAmount".
Step 3: Match items that represent the same scope of work and put them on the same row.
Step 4: Items that appear in only one estimate get 0.00 for the missing side.
Step 5: Include overhead, profit, tax, and subtotals as separate line items.

CRITICAL: Do NOT put carrier amounts in the phAmount field or vice versa.
CRITICAL: Respond with JSON only — no text before or after the JSON.

${jsonFormat}` }
    ];
  } else if (carrierBase64 && !phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'text', text: `This PDF is the CARRIER estimate. Extract all line items from it and put the amounts in "carrierAmount".

POLICYHOLDER ESTIMATE DATA (put these amounts in "phAmount"):
${(phText || 'Not provided').substring(0, 6000)}

Property: ${matter?.address || 'Unknown'}, Claim: ${matter?.claimNo || 'Unknown'}

Match items where possible. Items only in one estimate get 0.00 for the other side.
Respond with JSON only:
${jsonFormat}` }
    ];
  } else if (!carrierBase64 && phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `This PDF is the POLICYHOLDER estimate. Extract all line items and put amounts in "phAmount".

CARRIER ESTIMATE DATA (put these amounts in "carrierAmount"):
${(carrierText || 'Not provided').substring(0, 6000)}

Property: ${matter?.address || 'Unknown'}, Claim: ${matter?.claimNo || 'Unknown'}

Match items where possible. Items only in one estimate get 0.00 for the other side.
Respond with JSON only:
${jsonFormat}` }
    ];
  } else {
    content = `Compare these two property damage estimates.
Property: ${matter?.address || 'Unknown'}, Claim: ${matter?.claimNo || 'Unknown'}

CARRIER ESTIMATE (put amounts in carrierAmount):
${(carrierText || 'Not provided').substring(0, 5000)}

POLICYHOLDER ESTIMATE (put amounts in phAmount):
${(phText || 'Not provided').substring(0, 5000)}

Respond with JSON only:
${jsonFormat}`;
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
