import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { searchListings } from './providers/listingProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const leadsFile = path.join(root, 'data', 'leads.json');
const app = express();
app.use(express.json({ limit: '100kb' }));

const clean = (v, max=300) => typeof v === 'string' ? v.trim().slice(0,max) : '';

app.post('/api/listings/search', async (req, res) => {
  try {
    const profile = req.body?.profile || {};
    const listings = await searchListings({
      area: clean(profile.area, 100),
      propertyType: clean(profile.propertyType, 80),
      budget: clean(profile.budget, 80),
      priority: clean(profile.priority, 100)
    });
    res.json({ listings, provider: 'mock', placeholderData: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not search listings.' });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const b = req.body || {};
    const email = clean(b.contact?.email, 200);
    const phone = clean(b.contact?.phone, 40);
    if (!email && !phone) return res.status(400).json({ error: 'Email or phone is required.' });

    const record = {
      id: `lead_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      source: {
        platform: clean(b.source?.platform, 50) || 'direct',
        campaign: clean(b.source?.campaign, 100) || 'general',
        content: clean(b.source?.content, 200) || 'General social landing'
      },
      contact: {
        name: clean(b.contact?.name, 120), email, phone,
        preferredContact: clean(b.contact?.preferredContact, 20) || (phone ? 'text' : 'email')
      },
      buyerProfile: {
        intent: clean(b.buyerProfile?.intent, 80) || 'unknown',
        propertyType: clean(b.buyerProfile?.propertyType, 80) || 'unknown',
        area: clean(b.buyerProfile?.area, 100) || 'unknown',
        budget: clean(b.buyerProfile?.budget, 80) || 'unknown',
        priority: clean(b.buyerProfile?.priority, 100) || 'unknown',
        timeline: clean(b.buyerProfile?.timeline, 80) || 'unknown',
        financing: clean(b.buyerProfile?.financing, 100) || 'unknown'
      },
      qualification: {
        buyingWithinSixMonths: b.qualification?.buyingWithinSixMonths ?? null,
        preApproved: b.qualification?.preApproved ?? null,
        budgetKnown: b.qualification?.budgetKnown ?? null
      },
      listingInterest: Array.isArray(b.listingInterest) ? b.listingInterest.slice(0,10).map(x => ({
        id: clean(x.id, 100), area: clean(x.area, 100), neighbourhood: clean(x.neighbourhood, 100),
        propertyType: clean(x.propertyType, 80), price: Number(x.price) || null,
        action: clean(x.action, 80), detailUrl: clean(x.detailUrl, 500)
      })) : [],
      agent: {
        knownFacts: Array.isArray(b.agent?.knownFacts) ? b.agent.knownFacts.slice(0,20).map(x => clean(x,200)) : [],
        inferredFacts: Array.isArray(b.agent?.inferredFacts) ? b.agent.inferredFacts.slice(0,20).map(x => clean(x,200)) : [],
        unknownFields: Array.isArray(b.agent?.unknownFields) ? b.agent.unknownFields.slice(0,20).map(x => clean(x,80)) : [],
        conversationSummary: clean(b.agent?.conversationSummary, 1600),
        requestedAction: clean(b.agent?.requestedAction, 100) || 'Contact Mylyne'
      },
      consentToContact: b.consentToContact === true
    };

    if (!record.consentToContact) return res.status(400).json({ error: 'Contact consent is required.' });
    let leads = [];
    try { leads = JSON.parse(await fs.readFile(leadsFile, 'utf8')); } catch {}
    if (!Array.isArray(leads)) leads = [];
    leads.push(record);
    await fs.writeFile(leadsFile, JSON.stringify(leads, null, 2));
    res.status(201).json({ ok: true, id: record.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save lead.' });
  }
});

const dist = path.join(root, 'dist');
try {
  await fs.access(dist);
  app.use(express.static(dist));
  app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
} catch {}

app.listen(3001, () => console.log('Lead/listing server: http://localhost:3001'));
