export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { matter, disputes, awardValues } = req.body;
  if (!matter) return res.status(400).json({ error: 'No matter provided' });

  const disputeLines = (disputes || []).map(d =>
    `- ${d.item || d.description || 'Item'} (${d.cat || ''}): Carrier $${d.cTotal || 0}, PH $${d.pTotal || d.phTotal || 0}, Award $${awardValues?.[d.id] || d.cTotal || 0}`
  ).join('\n');

  const content = `You are a neutral insurance appraisal umpire drafting a binding appraisal award.

Matter details:
- Property: ${matter.address || 'Unknown'}
- Insured: ${matter.insured || 'Unknown'}
- Claim No: ${matter.claimNo || 'Unknown'}
- Loss Date: ${matter.lossDate || 'Unknown'}
- Loss Type: ${matter.lossType || 'Unknown'}

Disputed line items and award values:
${disputeLines || 'No disputes recorded'}

Carrier Appraiser: ${matter.carrier?.name || 'Unknown'}
PH Appraiser: ${matter.ph?.name || 'Unknown'}
Umpire: ${matter.umpire?.name || 'Unknown'}

Write a professional binding appraisal award in formal legal language. Include:
1. A preamble identifying the parties and authority
2. Findings for each disputed item with brief reasoning
3. The total award amount
4. A binding declaration

Write in plain paragraphs, no markdown.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 2000, messages: [{ role: 'user', content }] })
  });

  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data });

  return res.status(200).json({ text: data.content[0].text });
}
