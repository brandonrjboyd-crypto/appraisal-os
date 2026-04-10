export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter, carrierBase64, phBase64, carrierMediaType, phMediaType } = req.body;
  if (!carrierText && !phText && !carrierBase64) return res.status(400).json({ error: 'No contents provided' });

  let content;
  if (carrierBase64 && phBase64) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `Compare these two contents inventory lists for ${matter?.address || 'the property'}. First is CARRIER list, second is POLICYHOLDER list. Respond with JSON only: {"matchedItems":[{"description":"...","carrierValue":0,"phValue":0,"gap":0}],"phOnlyItems":[{"description":"...","phValue":0,"note":"..."}],"carrierOnlyItems":[{"description":"...","carrierValue":0,"note":"..."}],"carrierTotal":0,"phTotal":0,"totalGap":0,"assessment":"..."}` }
    ];
  } else {
    content = `Compare these two contents inventory lists.\n\nProperty: ${matter?.address || 'Unknown'}\nClaim: ${matter?.claimNo || 'Unknown'}\n\nCARRIER LIST:\n${(carrierText || 'Not provided').substring(0, 4000)}\n\nPOLICYHOLDER LIST:\n${(phText || 'Not provided').substring(0, 4000)}\n\nRespond with JSON only: {"matchedItems":[{"description":"...","carrierValue":0,"phValue":0,"gap":0}],"phOnlyItems":[{"description":"...","phValue":0,"note":"..."}],"carrierOnlyItems":[{"description":"...","carrierValue":0,"note":"..."}],"carrierTotal":0,"phTotal":0,"totalGap":0,"assessment":"..."}`;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content }] })
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
