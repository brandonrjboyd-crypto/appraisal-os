export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { carrierText, phText, matter, carrierBase64, phBase64, carrierMediaType, phMediaType, mixedMode } = req.body;

  let content;

  if (carrierBase64 && phBase64) {
    // Both PDFs available
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `Compare these two property damage estimates for ${matter?.address || 'the property'} (Claim: ${matter?.claimNo || 'unknown'}). First is CARRIER estimate, second is POLICYHOLDER estimate. Respond with JSON only: {"lineItems":[{"description":"...","carrierAmount":0,"phAmount":0,"gap":0,"note":"..."}],"carrierTotal":0,"phTotal":0,"totalGap":0,"topDisputes":["..."],"assessment":"..."}` }
    ];
  } else if (carrierBase64 && !phBase64) {
    // Carrier is PDF, PH is extracted text
    content = [
      { type: 'document', source: { type: 'base64', media_type: carrierMediaType || 'application/pdf', data: carrierBase64 } },
      { type: 'text', text: `Compare this carrier estimate PDF against the policyholder estimate data below.\n\nProperty: ${matter?.address || 'Unknown'}\nClaim: ${matter?.claimNo || 'Unknown'}\n\nPOLICYHOLDER ESTIMATE DATA:\n${(phText || 'Not provided').substring(0, 4000)}\n\nRespond with JSON only: {"lineItems":[{"description":"...","carrierAmount":0,"phAmount":0,"gap":0,"note":"..."}],"carrierTotal":0,"phTotal":0,"totalGap":0,"topDisputes":["..."],"assessment":"..."}` }
    ];
  } else if (!carrierBase64 && phBase64) {
    // PH is PDF, carrier is extracted text
    content = [
      { type: 'document', source: { type: 'base64', media_type: phMediaType || 'application/pdf', data: phBase64 } },
      { type: 'text', text: `Compare this policyholder estimate PDF against the carrier estimate data below.\n\nProperty: ${matter?.address || 'Unknown'}\nClaim: ${matter?.claimNo || 'Unknown'}\n\nCARRIER ESTIMATE DATA:\n${(carrierText || 'Not provided').substring(0, 4000)}\n\nRespond with JSON only: {"lineItems":[{"description":"...","carrierAmount":0,"phAmount":0,"gap":0,"note":"..."}],"carrierTotal":0,"phTotal":0,"totalGap":0,"topDisputes":["..."],"assessment":"..."}` }
    ];
  } else {
    // Text only
    content = `Compare these two property damage estimates.\n\nProperty: ${matter?.address || 'Unknown'}\nClaim: ${matter?.claimNo || 'Unknown'}\n\nCARRIER ESTIMATE:\n${(carrierText || 'Not provided').substring(0, 4000)}\n\nPOLICYHOLDER ESTIMATE:\n${(phText || 'Not provided').substring(0, 4000)}\n\nRespond with JSON only: {"lineItems":[{"description":"...","carrierAmount":0,"phAmount":0,"gap":0,"note":"..."}],"carrierTotal":0,"phTotal":0,"totalGap":0,"topDisputes":["..."],"assessment":"..."}`;
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
