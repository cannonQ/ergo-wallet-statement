import type { VercelRequest, VercelResponse } from '@vercel/node';

const CRUX_API_URL = 'https://api.cruxfinance.io';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token_id, time_point } = req.query;

  // Validate required parameters
  if (!token_id || !time_point) {
    return res.status(400).json({ error: 'Missing required parameters: token_id, time_point' });
  }

  // Validate token_id format (64 character hex string)
  if (typeof token_id !== 'string' || !/^[a-fA-F0-9]{64}$/.test(token_id)) {
    return res.status(400).json({ error: 'Invalid token_id format' });
  }

  // Validate time_point is a number (milliseconds timestamp)
  const timePointMs = Number(time_point);
  if (isNaN(timePointMs)) {
    return res.status(400).json({ error: 'time_point must be a number' });
  }

  try {
    const url = `${CRUX_API_URL}/spectrum/price?token_id=${token_id}&time_point=${timePointMs}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      // Forward the status from Crux API
      return res.status(response.status).json({
        error: `Crux API error: ${response.status}`,
      });
    }

    const data = await response.json();

    // Cache historical data for 1 hour (it doesn't change)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching from Crux API:', error);
    return res.status(500).json({ error: 'Failed to fetch historical price data' });
  }
}
