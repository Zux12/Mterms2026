'use strict';

const slots = ['lead', 'story1', 'story2'];

function uniqueSlots(selection) {
  const result = { ...selection };
  const seen = new Set();
  for (const slot of slots) {
    const item = result[slot];
    if (!item || !item.reference) continue;
    const key = JSON.stringify([item.kind, item.reference]);
    if (seen.has(key)) delete result[slot];
    else seen.add(key);
  }
  return result;
}

async function move(collection, slot, item) {
  if (!slots.includes(slot)) throw new Error('Invalid highlight slot');
  const fields = { [slot]: { $literal: item } };
  for (const other of slots) {
    if (other === slot) continue;
    const existing = '$' + other;
    fields[other] = {
      $cond: [
        { $and: [
          { $eq: [existing + '.reference', { $literal: item.reference }] },
          { $eq: [existing + '.kind', { $literal: item.kind }] }
        ] },
        '$$REMOVE',
        existing
      ]
    };
  }
  return collection.updateOne({ _id: 'highlights' }, [{ $set: fields }], { upsert: true });
}

module.exports = { uniqueSlots, move };
