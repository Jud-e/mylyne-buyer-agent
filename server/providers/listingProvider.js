import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const mockFile = path.join(root, 'data', 'listings.json');

const parseBudgetCeiling = (value = '') => {
  const text = String(value).toLowerCase();
  const millions = text.match(/([0-9.]+)\s*m/);
  if (millions) return Number(millions[1]) * 1_000_000;
  const thousands = [...text.matchAll(/([0-9]{3,4})\s*k/g)].map(m => Number(m[1]) * 1000);
  if (thousands.length) return Math.max(...thousands);
  const raw = [...text.matchAll(/\$?([0-9]{3,7})/g)].map(m => Number(m[1]));
  return raw.length ? Math.max(...raw) : null;
};

const scoreListing = (listing, profile) => {
  let score = 0;
  if (profile.area && profile.area !== 'unknown' && listing.area.toLowerCase() === profile.area.toLowerCase()) score += 5;
  if (profile.propertyType && profile.propertyType !== 'unknown' && profile.propertyType !== 'Show me anything' && listing.propertyType.toLowerCase() === profile.propertyType.toLowerCase()) score += 4;
  if (profile.priority && listing.highlights?.some(h => h.toLowerCase() === profile.priority.toLowerCase())) score += 3;
  const ceiling = parseBudgetCeiling(profile.budget);
  if (ceiling && listing.price <= ceiling) score += 4;
  else if (ceiling && listing.price <= ceiling * 1.08) score += 1;
  return score;
};

export async function searchListings(profile = {}, limit = 3) {
  // PRODUCTION SWAP POINT:
  // Replace this body with an approved IDX/MLS/website-provider API call.
  // Keep the returned normalized shape so the React UI does not need to change.
  const listings = JSON.parse(await fs.readFile(mockFile, 'utf8'));
  return listings
    .filter(x => x.status === 'active')
    .map(x => ({ ...x, matchScore: scoreListing(x, profile) }))
    .filter(x => x.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore || a.price - b.price)
    .slice(0, limit);
}
