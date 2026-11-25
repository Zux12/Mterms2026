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
    subject: '[PRIVATE TEST ' + (index + 1) + '/4] ' + job.subject,
    html: job.html, text: job.text,
    attachments: [{ filename: 'Recognition-preview-' + (index + 1) + '.pdf', content: job.pdf }]
  };
}

async function scheduleSlot(jobs, index, now, key, fetcher) {
  const id = prefix + (index + 1);
  if (Date.parse(slots[index]) <= now.getTime()) return;
  // A stable provider key also covers a successful submission followed by a lost DB write.
  const job = await jobs.findOneAndUpdate({
    _id: id, scheduledAt: slots[index], state: { $in: ['ready', 'submitting'] },
    $or: [{ lastAttempt: { $exists: false } }, { lastAttempt: { $lt: new Date(now - 5 * minute) } }],
    attempts: { $lt: 8 }
  }, { $set: { state: 'submitting', lastAttempt: now }, $inc: { attempts: 1 } },
  { returnDocument: 'after', includeResultMetadata: false });
  if (!job) return;
  let result;
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': id },
      body: JSON.stringify(mail(job, index))
    });
    const data = await response.json();
    if (response.ok && data.id) {
      result = { state: 'scheduled', providerMessageId: data.id, acceptedAt: new Date() };
    } else {
      const retryable = response.status === 429 || response.status >= 500;
      result = { state: retryable ? 'submitting' : 'rejected', providerStatus: response.status,
        providerError: String(data.name || 'provider-error').slice(0, 100) };
    }
  } catch (error) {
    result = { state: 'submitting', lastError: error.name };
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
