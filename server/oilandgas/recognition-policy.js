'use strict';

// Deterministic eligibility gate for WRRP-001. Does not attempt to infer scientific merit.
const categories = ['editors-pick','industry-impact','emerging-research'];
function normalizedName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}
function validHttpsUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' && !u.username && !u.password &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
      !/(\.local|\.localhost|\.internal)$/i.test(u.hostname);
  } catch { return false; }
}
function publicationEligibility(p) {
  const reasons = [];
  if (p.kind !== 'publications') reasons.push('not-a-research-publication');
  if (!/^OG-P-(?:[A-F0-9]{16}|MY[A-F0-9]{8})$/.test(String(p.reference || ''))) reasons.push('invalid-reference');
  if (String(p.title || '').trim().length < 15) reasons.push('missing-title');
  if (String(p.byline || '').trim().length < 3) reasons.push('missing-byline');
  if (!validHttpsUrl(p.source)) reasons.push('no-verifiable-original-source');
  if (p.integrityStatus === 'retracted' || p.integrityStatus === 'withdrawn' ||
      p.integrityStatus === 'disputed') reasons.push('integrity-hold');
  if (p.publishedAt && !Number.isFinite(new Date(p.publishedAt).getTime())) reasons.push('invalid-publication-date');
  return {eligible:reasons.length === 0,reasons};
}
function authorTokens(p) {
  // Only used for strict certificate identity matching, not for deciding co-author identity automatically.
  return String(p.byline || '').split(/[;,]/).map(s=>s.trim()).filter(Boolean);
}
function verifiedBylineAuthor(p, name) {
  return authorTokens(p).some(x=>normalizedName(x) === normalizedName(name));
}
const THRESHOLD_VERSION = 'directory-thresholds-v2-2026-11-18';
const MINIMUM_SCORE = Object.freeze({'editors-pick':70,'industry-impact':60,'emerging-research':60});
function thresholdFor(category) {
  if (!categories.includes(category)) throw new Error('Invalid category');
  return MINIMUM_SCORE[category];
}
module.exports = {categories,normalizedName,validHttpsUrl,publicationEligibility,authorTokens,verifiedBylineAuthor,thresholdFor,THRESHOLD_VERSION,MINIMUM_SCORE};
