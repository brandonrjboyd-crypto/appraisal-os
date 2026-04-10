export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter } = req.body;
  if (!carrierText && !phText) return res.status(400).json({ error: 'No estimate text provided' });

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
        content: `You are an expert insurance appraisal analyst comparing two property damage estimates.

Property: ${matter?.address || 'Unknown'}
Claim No: ${matter?.claimNo || 'Unknown'}

CARRIER ESTIMATE:
${(carrierText || 'Not provided').substring(0, 4000)}

POLICYHOLDER ESTIMATE:
${(phText || 'Not provided').substring(0, 4000)}

Analyze these two estimates and produce a structured comparison. For each line item or category where there is a difference:
1. Identify the item/category
2. Show the carrier amount
3. Show the policyholder amount
4. Calculate the gap
5. Note likely reason for the discrepancy

Then provide:
- Total carrier estimate
- Total policyholder estimate  
- Total gap
- Top 3 largest disputes by dollar amount
- Brief overall assessment

Respond with JSON only in this exact format:
{
  "lineItems": [
    {"description": "...", "carrierAmount": 0, "phAmount": 0, "gap": 0, "note": "..."}
  ],
  "carrierTotal": 0,
  "phTotal": 0,
  "totalGap": 0,
  "topDisputes": ["...", "...", "..."],
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
