// api/analyze.js — Vercel Serverless Function
// Receives a base64 image, sends to OpenAI GPT-4o Vision, returns debris analysis

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const prompt = `You are Debris AI — an expert system for analyzing rubble, debris, and discarded materials to determine their reuse and repurposing potential.

Analyze this image carefully. Respond ONLY in the following JSON format, no markdown, no backticks, no extra text:

{
  "summary": "One sentence describing what you see overall",
  "materials": [
    {
      "name": "Material name (e.g., Concrete, Brick, Metal, Wood, Glass, Plastic, Textile, Tile, Stone, Mixed Rubble)",
      "condition": "Good / Fair / Poor / Severely Damaged",
      "percentage": "Estimated % of visible debris this material makes up",
      "reuse_ideas": [
        {
          "idea": "Specific reuse suggestion",
          "difficulty": "Easy / Medium / Hard",
          "category": "One of: Shelter, Furniture, Tools, Art, Infrastructure, Energy, Agriculture, Other"
        },
        {
          "idea": "Another suggestion",
          "difficulty": "Easy / Medium / Hard",
          "category": "Category"
        },
        {
          "idea": "A creative/unexpected suggestion most people wouldn't think of",
          "difficulty": "Easy / Medium / Hard",
          "category": "Category"
        }
      ],
      "safety_notes": "Any safety considerations for handling this material"
    }
  ],
  "overall_reuse_score": "1-10 rating of how reusable this debris is overall",
  "recommended_action": "The single most impactful thing someone could do with this debris right now",
  "environmental_impact": "Brief note on environmental benefit of reusing vs discarding"
}

Be creative with reuse ideas — not just construction. Think: motors from scrap metal, planters from concrete chunks, insulation from textiles, art installations, water filtration, furniture, energy generation, tools, agricultural uses. The more creative and practical, the better.

If the image doesn't contain debris or materials, still respond in JSON format but set summary to explain what you see and return an empty materials array.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', JSON.stringify(data));
      return res.status(500).json({ error: 'OpenAI API error', details: data });
    }

    const text = data.choices?.[0]?.message?.content || '';

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(200).json({
        summary: text,
        materials: [],
        overall_reuse_score: 'N/A',
        recommended_action: 'Could not parse structured analysis',
        environmental_impact: '',
        raw: true,
      });
    }

    return res.status(200).json(analysis);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
