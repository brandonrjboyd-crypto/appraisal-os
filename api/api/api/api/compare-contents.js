export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter } = req.body;
  if (!carrierText && !phText) return res.status(400).json({ error: 'No contents text provided' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are an expert insurance appraisal analyst comparing two contents inventory lists.

Property: ${matter?.address || 'Unknown'}
Claim No: ${matter?.claimNo || 'Unknown'}

CARRIER CONTENTS LIST:
${(carrierText || 'Not provided').substring(0, 4000)}

POLICYHOLDER CONTENTS LIST:
${(phText || 'Not provided').substring(0, 4000)}

Compare these two contents lists and identify:
1. Items that appear in both lists but with different values
2. Items claimed by the policyholder but not in the carrier list
3. Items in the carrier list but not claimed by the policyholder
4. Total value difference

Respond with JSON only in this exact format:
{
  "matchedItems": [
    {"description": "...", "carrierValue": 0, "phValue": 0, "gap": 0}
  ],
  "phOnlyItems": [
    {"description": "...", "phValue": 0, "note": "..."}
  ],
  "carrierOnlyItems": [
    {"description": "...", "carrierValue": 0, "note": "..."}
  ],
  "carrierTotal": 0,
  "phTotal": 0,
  "totalGap": 0,
  "assessment": "..."
}`
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data });

  try {
    const text = data.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);
  } catch(e) {
    return res.status(200).json({ error: 'Could not parse comparison', raw: data.content[0].text });
  }
}
