'use strict';

const { FROM, TO, readiness } = require('./recognition-resend-owner-test');

// Only these four explicitly requested MYT delivery times belong to this rehearsal.
const slots = [
  '2026-11-25T15:00:00.000Z',
  '2026-11-26T00:00:00.000Z',
  '2026-11-26T04:00:00.000Z',
  '2026-11-27T00:00:00.000Z'
];
const prefix = 'WRRP-owner-20261125-';
const collection = 'recognition_owner_rehearsals';
const minute = 60000;

function mail(job, index) {
  if (!job.subject || !job.html || !job.text || !/^JVBERi0/.test(job.pdf || '')) {
    throw new Error('invalid-rehearsal-content');
  }
  return {
    from: FROM, to: [TO], scheduled_at: slots[index],
    subject: job.subject,
    html: job.html, text: job.text,
    attachments: [{ filename: 'Letter of Recognition.pdf', content: job.pdf }]
  };
}

// A scheduled message's content is immutable in Resend. Confirm cancellation
// of the old provider ID before submitting replacement content for the same time.
async function cancelOriginal(job, key, fetcher) {
  if (!job.providerMessageId || job.providerMessageId !== job.originalProviderMessageId) {
    return { state: 'cancellation-rejected', providerError: 'original-message-mismatch' };
  }
  const url = 'https://api.resend.com/emails/' + encodeURIComponent(job.providerMessageId);
  const headers = { Authorization: 'Bearer ' + key };
  const response = await fetcher(url + '/cancel', {
    method: 'POST', headers, signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  let canceled = response.ok && data.id === job.providerMessageId;
  if (!canceled && (response.status === 400 || response.status === 409 || response.status === 422)) {
    // A previous cancellation may have succeeded before its database write.
    const status = await fetcher(url, { headers, signal: AbortSignal.timeout(15000) });
    const original = await status.json();
    canceled = status.ok && original.id === job.providerMessageId && original.last_event === 'canceled';
  }
  if (canceled) return { state: 'replacement-ready', originalCanceledAt: new Date(), attempts: 0 };
  const retryable = response.status === 429 || response.status >= 500;
  return { state: retryable ? 'cancel-pending' : 'cancellation-rejected',
    providerStatus: response.status, providerError: String(data.name || 'cancel-error').slice(0, 100) };
}

async function scheduleSlot(jobs, index, now, key, fetcher) {
  const id = prefix + (index + 1);
  if (Date.parse(slots[index]) <= now.getTime()) return;
  // A stable provider key also covers a successful submission followed by a lost DB write.
  const job = await jobs.findOneAndUpdate({
    _id: id, scheduledAt: slots[index], state: { $in: ['ready', 'submitting', 'cancel-pending', 'replacement-ready'] },
    $or: [{ lastAttempt: { $exists: false } }, { lastAttempt: { $lt: new Date(now - 5 * minute) } }],
    attempts: { $lt: 8 }
  }, { $set: { lastAttempt: now }, $inc: { attempts: 1 } },
  { returnDocument: 'after', includeResultMetadata: false });
  if (!job) return;
  let result;
  if (job.state === 'cancel-pending') {
    try {
      result = await cancelOriginal(job, key, fetcher);
    } catch (error) {
      result = { state: 'cancel-pending', lastError: error.name };
    }
    const update = { $set: result };
    if (result.state === 'replacement-ready') update.$unset = { lastAttempt: '' };
    await jobs.updateOne({ _id: id, lastAttempt: now, state: 'cancel-pending' }, update);
    return;
  }
  const replacement = job.state === 'replacement-ready';
  const retryState = replacement ? 'replacement-ready' : 'submitting';
  const idempotencyKey = replacement ? id + '-editorial-v2' : id;
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(mail(job, index))
    });
    const data = await response.json();
    if (response.ok && data.id) {
      result = { state: 'scheduled', providerMessageId: data.id, acceptedAt: new Date() };
    } else {
      const retryable = response.status === 429 || response.status >= 500;
      result = { state: retryable ? retryState : 'rejected', providerStatus: response.status,
        providerError: String(data.name || 'provider-error').slice(0, 100) };
    }
  } catch (error) {
    result = { state: retryState, lastError: error.name };
  }
  await jobs.updateOne({ _id: id, lastAttempt: now }, { $set: result });
}

function start(getDb) {
  let busy = false;
  const lastSlot = Date.parse(slots[slots.length - 1]);
  if (Date.now() >= lastSlot) return;
  const timer = setInterval(async () => {
    const now = new Date();
    if (now.getTime() >= lastSlot) return clearInterval(timer);
    if (busy || !readiness().configured) return;
    const db = getDb();
    if (!db) return;
    busy = true;
    try {
      for (let index = 0; index < slots.length; index++) {
        await scheduleSlot(db.collection(collection), index, now, process.env.OIL_RECOGNITION_RESEND_API_KEY, fetch);
        // Stay inside the provider's default rate limit, including on the first run.
        if (index < slots.length - 1) await new Promise(resolve => setTimeout(resolve, 650));
      }
    } catch (error) {
      console.error('Recognition owner rehearsal:', error.name);
    } finally {
      busy = false;
    }
  }, minute);
  timer.unref();
}

module.exports = { start, mail, scheduleSlot, slots };
