import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowLeft, Check, Home, MessageCircle, Sparkles, BedDouble, Bath, Maximize2, ExternalLink, Search, RotateCcw } from 'lucide-react';
import './styles.css';

const CAMPAIGNS = {
  'surrey-townhomes': { platform: 'instagram', content: 'Surrey townhomes under $800K', area: 'Surrey', propertyType: 'Townhome', budget: 'Under $800K', hook: 'Saw the Surrey townhomes?', title: 'Let’s find the kind that actually fits you.', first: 'priority' },
  'surrey-750': { platform: 'instagram', content: 'What $750K buys in Surrey', area: 'Surrey', budget: 'Around $750K', hook: 'Curious what $750K can do in Surrey?', title: 'Pick what matters most and I’ll narrow the options.', first: 'propertyType' },
  'first-home': { platform: 'instagram', content: 'First-time buyer guide', intent: 'Buy my first home', hook: 'Thinking about your first home?', title: 'Give me one signal and I’ll make the next step useful.', first: 'timeline' },
  general: { platform: 'social', content: 'General social landing', hook: 'What are you trying to figure out?', title: 'One tap at a time. No long form.', first: 'intent' }
};

const OPTIONS = {
  intent: ['Buy my first home', 'Move to a bigger home', 'Invest', 'Just exploring'],
  propertyType: ['Townhome', 'Condo', 'Detached', 'Show me anything'],
  priority: ['More space', 'Better commute', 'Newer home', 'Family-friendly area'],
  timeline: ['Soon', '3–6 months', 'Later this year', 'Just curious']
};
const NEXT = { intent: 'priority', propertyType: 'priority', priority: 'timeline', timeline: null };
const LABELS = { intent: 'What are you looking to do?', propertyType: 'What would you rather come home to?', priority: 'What matters most?', timeline: 'How soon are you thinking?' };

function campaignFromUrl() {
  const params = new URLSearchParams(location.search);
  const key = params.get('campaign') || location.pathname.split('/').filter(Boolean)[0] || 'general';
  const base = CAMPAIGNS[key] || CAMPAIGNS.general;
  return { key, ...base, platform: params.get('utm_source') || base.platform };
}

function App() {
  const campaign = useMemo(campaignFromUrl, []);
  const [answers, setAnswers] = useState({ intent: campaign.intent || '', propertyType: campaign.propertyType || '', area: campaign.area || '', budget: campaign.budget || '', priority: '', timeline: '', financing: 'unknown' });
  const [screen, setScreen] = useState('start');
  const [question, setQuestion] = useState(campaign.first);
  const [history, setHistory] = useState([]);
  const [listings, setListings] = useState([]);
  const [listingStatus, setListingStatus] = useState('');
  const [listingInterest, setListingInterest] = useState([]);
  const [contact, setContact] = useState({ name: '', email: '', phone: '', preferredContact: 'email' });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('');

  const track = (name, props = {}) => {
    console.log('[analytics]', name, props);
    // Never pass name/email/phone to this function.
    if (typeof window.gtag === 'function') window.gtag('event', name, props);
  };

  const choose = (value) => {
    const nextAnswers = { ...answers, [question]: value }; setAnswers(nextAnswers); setHistory(h => [...h, question]);
    track('concierge_answer', { campaign: campaign.key, field: question, value });
    const next = NEXT[question];
    if (next) { setQuestion(next); } else { setScreen('result'); track('concierge_result_viewed', { campaign: campaign.key }); }
  };

  const goBack = () => {
    if (!history.length) { setScreen('start'); return; }
    const h = [...history]; const previous = h.pop(); setHistory(h); setQuestion(previous);
  };

  const resultText = answers.priority === 'More space'
    ? `I’d start by comparing where ${answers.budget || 'your budget'} stretches furthest${answers.area ? ` around ${answers.area}` : ''}, then look at actual homes that fit.`
    : answers.priority === 'Better commute'
      ? 'I’d narrow around the commute first, then compare the housing trade-offs inside that radius.'
      : answers.priority === 'Newer home'
        ? 'I’d compare newer condo and townhome pockets before expanding the search.'
        : 'I’d start with neighbourhood fit, then compare property types inside the budget instead of searching the whole market.';

  const findListings = async () => {
    setListingStatus('Finding matches…'); setScreen('listings');
    track('listing_search_started', { campaign: campaign.key, area: answers.area || 'unknown', property_type: answers.propertyType || 'unknown' });
    try {
      const r = await fetch('/api/listings/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: answers }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not search listings');
      setListings(j.listings || []); setListingStatus('');
      track('listing_results_viewed', { campaign: campaign.key, result_count: (j.listings || []).length, provider: j.provider });
    } catch (e) { setListingStatus(e.message); }
  };

  const noteListing = (listing, action = 'viewed') => {
    setListingInterest(current => {
      const exists = current.find(x => x.id === listing.id);
      if (exists) return current.map(x => x.id === listing.id ? { ...x, action } : x);
      return [...current, { id: listing.id, area: listing.area, neighbourhood: listing.neighbourhood, propertyType: listing.propertyType, price: listing.price, detailUrl: listing.detailUrl, action }];
    });
    track('listing_interest', { campaign: campaign.key, listing_id: listing.id, action });
  };

  const openContact = (requestedAction = 'Contact Mylyne') => {
    setScreen('contact');
    track('contact_opened', { campaign: campaign.key, requested_action: requestedAction });
  };

  const buildPayload = () => {
    const known = []; const inferred = [];
    if (campaign.area) inferred.push(`Area interest inferred from campaign: ${campaign.area}`);
    if (campaign.propertyType) inferred.push(`Property type inferred from campaign: ${campaign.propertyType}`);
    if (campaign.budget) inferred.push(`Budget interest inferred from campaign: ${campaign.budget}`);
    Object.entries(answers).forEach(([k, v]) => { if (v && v !== 'unknown' && !['area', 'propertyType', 'budget'].some(x => x === k && campaign[x])) known.push(`${k}: ${v}`); });
    const within6 = ['Soon', '3–6 months'].includes(answers.timeline) ? true : answers.timeline ? false : null;
    const listingSentence = listingInterest.length ? ` They interacted with ${listingInterest.length} listing(s): ${listingInterest.map(x => `${x.neighbourhood || x.area} ${x.propertyType} (${x.action})`).join(', ')}.` : '';
    return {
      source: { platform: campaign.platform, campaign: campaign.key, content: campaign.content }, contact, buyerProfile: answers,
      qualification: { buyingWithinSixMonths: within6, preApproved: null, budgetKnown: answers.budget ? true : null },
      listingInterest,
      agent: { knownFacts: known, inferredFacts: inferred, unknownFields: ['occupation', ...(answers.financing === 'unknown' ? ['financing'] : []), ...(!answers.budget ? ['budget'] : [])], conversationSummary: `Visitor came from “${campaign.content}”. They selected ${known.join('; ') || 'no additional profile details'}. ${resultText}${listingSentence}`, requestedAction: listingInterest.length ? 'Find/contact about matching homes' : 'Contact Mylyne' },
      consentToContact: consent
    };
  };

  const submit = async () => {
    if ((!contact.email && !contact.phone) || !consent) { setStatus('Add an email or phone number and confirm contact permission.'); return; }
    setStatus('Sending…');
    try {
      const r = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload()) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Could not save');
      track('contact_mylyne', { campaign: campaign.key, preferred_contact: contact.preferredContact, listing_interest_count: listingInterest.length });
      setScreen('done'); setStatus('');
    } catch (e) { setStatus(e.message); }
  };

  return <main>
    <header><div className="brand"><div className="mark">M</div><div><b>MYLYNE & ASSOCIATES</b><span>BUYER CONCIERGE</span></div></div><span className="tiny">From social post to useful next step.</span></header>

    {screen === 'start' && <section className="shell intro"><div className="pill"><Sparkles size={15} /> 30-second buyer concierge</div><p className="kicker">{campaign.hook}</p><h1>{campaign.title}</h1><p className="lede">No account. No giant questionnaire. I’ll use the post that brought you here and only ask what unlocks something useful.</p><button className="primary" onClick={() => { setScreen('questions'); track('concierge_started', { campaign: campaign.key, platform: campaign.platform }) }}>Show me my next move <ArrowRight size={18} /></button><div className="context"><span>Already know:</span><b>{[campaign.area, campaign.propertyType, campaign.budget].filter(Boolean).join(' · ') || 'Nothing yet — that’s okay'}</b></div></section>}

    {screen === 'questions' && <section className="shell questionScreen"><button className="back" onClick={goBack}><ArrowLeft size={17} /> Back</button><div className="progress"><span style={{ width: `${Math.min(92, 30 + history.length * 22)}%` }} /></div><p className="kicker">ONE QUICK THING</p><h2>{LABELS[question]}</h2><p className="hint">Tap one. You can keep moving immediately.</p><div className="options">{OPTIONS[question].map(v => <button key={v} onClick={() => choose(v)}><span>{v}</span><ArrowRight size={18} /></button>)}</div><p className="micro">We don’t ask what the social post already told us.</p></section>}

    {screen === 'result' && <section className="shell result"><div className="pill"><Check size={15} /> Direction found</div><p className="kicker">HERE’S WHERE I’D START</p><h1>{answers.area ? `${answers.area}, with your priorities.` : 'A narrower search, not more scrolling.'}</h1><p className="resultCopy">{resultText}</p><div className="chips">{[answers.propertyType, answers.area, answers.budget, answers.priority, answers.timeline].filter(Boolean).map(x => <span key={x}>{x}</span>)}</div><div className="actionGrid"><div className="actionCard"><Search size={26} /><div><b>See matching homes</b><p>Use the profile above to pull a small shortlist. Demo data is clearly marked until an approved listing feed is connected.</p></div><button className="primary" onClick={findListings}>Show me homes <ArrowRight size={18} /></button></div><div className="actionCard"><MessageCircle size={26} /><div><b>Rather ask Mylyne?</b><p>She’ll receive this context so you don’t have to start over.</p></div><button className="secondary" onClick={() => openContact()}>Contact Mylyne</button></div></div><button className="ghost" onClick={() => { setScreen('questions'); setQuestion(campaign.first); setHistory([]) }}><RotateCcw size={16} /> Try different answers</button></section>}

    {screen === 'listings' && <section className="shell listingsScreen"><button className="back" onClick={() => setScreen('result')}><ArrowLeft size={17} /> Back</button><p className="kicker">MATCHING HOMES</p><h1>A few places to start.</h1><p className="lede small">These are <b>placeholder demo listings</b>. The project is already structured so an approved Mylyne/IDX/MLS listing API can replace them later.</p>{listingStatus && <p className="notice">{listingStatus}</p>}<div className="listingGrid">{listings.map(l => <article className="listingCard" key={l.id}><div className="listingImage"><img src={l.image} alt={`${l.neighbourhood} ${l.propertyType}`} />{l.isPlaceholder && <span>DEMO LISTING</span>}</div><div className="listingBody"><div className="price">${Number(l.price).toLocaleString()}</div><h3>{l.neighbourhood}, {l.area}</h3><p>{l.propertyType}</p><div className="listingFacts"><span><BedDouble size={16} />{l.beds} beds</span><span><Bath size={16} />{l.baths} baths</span><span><Maximize2 size={16} />{Number(l.sqft).toLocaleString()} sqft</span></div><div className="chips mini">{l.highlights?.map(h => <span key={h}>{h}</span>)}</div><div className="listingActions"><a href={l.detailUrl} target="_blank" rel="noreferrer" onClick={() => noteListing(l, 'opened_listing')} className="secondary">View home <ExternalLink size={15} /></a><button className="primary" onClick={() => { noteListing(l, 'requested_more_like_this'); openContact('More homes like this') }}>More like this</button></div></div></article>)}</div>{!listingStatus && !listings.length && <div className="empty"><Home size={28} /><h3>No close demo match yet.</h3><p>Mylyne can still search the live market once the real listing feed is connected.</p><button className="primary" onClick={() => openContact('Find matching homes')}>Ask Mylyne to look</button></div>}<div className="listingFooter"><div><b>Want Mylyne to refine this?</b><p>She’ll receive your preferences plus any homes you interacted with.</p></div><button className="primary" onClick={() => openContact('Refine matching homes')}>Contact Mylyne <ArrowRight size={18} /></button></div></section>}

    {screen === 'contact' && <section className="shell contactScreen"><button className="back" onClick={() => setScreen(listings.length ? 'listings' : 'result')}><ArrowLeft size={17} /> Back</button><p className="kicker">HANDOFF TO MYLYNE</p><h2>Where should she reach you?</h2><p className="lede small">This is the only point where we ask who you are. Your campaign context, taps and listing interest go with the request.</p><div className="contactMethods"><button className={contact.preferredContact === 'email' ? 'active' : ''} onClick={() => setContact({ ...contact, preferredContact: 'email' })}>Email me</button><button className={contact.preferredContact === 'text' ? 'active' : ''} onClick={() => setContact({ ...contact, preferredContact: 'text' })}>Text me</button></div><div className="fields"><label>Name <span>optional</span><input value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} placeholder="Your name" /></label>{contact.preferredContact === 'email' ? <label>Email<input type="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} placeholder="you@example.com" /></label> : <label>Phone<input type="tel" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} placeholder="604 555 0123" /></label>}</div><label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Mylyne & Associates may contact me about this request.</span></label>{status && <p className="error">{status}</p>}<button className="primary wide" onClick={submit}>Contact Mylyne <MessageCircle size={18} /></button><p className="micro">Contact details are saved with the lead, but this app does not send them to Google Analytics.</p></section>}

    {screen === 'done' && <section className="shell done"><div className="success"><Check size={28} /></div><p className="kicker">REQUEST SAVED</p><h1>Mylyne has the context.</h1><p className="lede">The lead JSON now includes the social source, explicit answers, campaign inferences and the listings that caught your attention.</p><button className="secondary" onClick={() => location.reload()}>Start over</button></section>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
