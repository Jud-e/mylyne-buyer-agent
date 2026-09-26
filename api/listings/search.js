import { searchListings } from '../../server/providers/listingProvider.js';

const clean = (v, max = 300) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        const profile = req.body?.profile || {};

        const listings = await searchListings({
            area: clean(profile.area, 100),
            propertyType: clean(profile.propertyType, 80),
            budget: clean(profile.budget, 80),
            priority: clean(profile.priority, 100)
        });

        return res.status(200).json({
            listings,
            provider: 'mock',
            placeholderData: true
        });

    } catch (error) {
        console.error('Listing search error:', error);

        return res.status(500).json({
            error: 'Could not search listings.'
        });
    }
}