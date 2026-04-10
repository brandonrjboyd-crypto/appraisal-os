export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { text, filename } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a property insurance appraisal document classifier.

Classify this document into exactly one category:
- carrier_estimate: insurer Xactimate or repair estimate
- ph_estimate: policyholder contractor estimate or scope
- policy: insurance policy document
- correspondence: letters or emails between parties
- photos: photo documentation
- expert_report: engineer or expert report
- legal: legal notices or appraisal demand letters
- proof_of_loss: sworn proof of loss
- contents_inventory: itemized personal property list
- other: anything else

Filename: ${filename || 'unknown'}

Document text (first 3000 chars):
${text.substring(0, 3000)}

Respond with JSON only, no other text:
{"category": "...", "confidence": "high|medium|low", "reason": "one sentence"}`
      }]
    })
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data });

  try {
    const text2 = data.content[0].text;
    const result = JSON.parse(text2);
    return res.status(200).json(result);
  } catch(e) {
    return res.status(200).json({ category: 'other', confidence: 'low', reason: 'Could not parse response' });
  }
}
