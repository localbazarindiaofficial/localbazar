// Vercel Serverless Function: Dispatch OneSignal Push Notifications (No CORS issues)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        let payload = req.body;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch {}
        }
        payload = payload || {};

        const appId = payload.app_id || 'cc4cd04b-4cc6-4fcd-ab85-6fee13841b1e';
        const restKey = process.env.ONESIGNAL_REST_KEY || 'os_v2_app_zrgnas2myzh43k4fn7xbhba3d362qjivg6yeg6nyfsynfbgee65f4lqtre2gk5jv4n5psmnifngur347qomjzhjemxtvqviiu7ijwfy';

        payload.app_id = appId;

        const authHeader = restKey.startsWith('os_v2_') ? `Key ${restKey}` : `Basic ${restKey}`;

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': authHeader
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (err) {
        console.error('[API Send-Push Error]:', err);
        return res.status(500).json({ error: err.message || 'Failed to dispatch push' });
    }
}
