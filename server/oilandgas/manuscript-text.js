const Zip = require('./vendor/jszip');
const sax = require('./vendor/sax');
const {StringDecoder} = require('string_decoder');
const namespaces = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main']);
const omitted = new Set(['del','moveFrom','drawing','pict','object']);

module.exports = async function manuscriptText(manuscript) {
  if (typeof manuscript?.text === 'string') return manuscript.text.trim();
  if (!manuscript?.bytes) return '';
  const binary = manuscript.bytes;
  const zip = await Zip.loadAsync(Buffer.isBuffer(binary) ? binary : binary.value(true));
  const document = zip.file('word/document.xml');
  if (!document) throw new Error('Missing document body');
  const parser = sax.parser(true, {xmlns:true});
  const parts = [];
  let ignored = 0, reading = false, body = false;
  parser.ondoctype = () => { throw new Error('Unsupported document declaration'); };
  parser.onopentag = tag => {
    if (ignored) { ignored++; return; }
    if (!namespaces.has(tag.uri)) return;
    if (omitted.has(tag.local)) { ignored = 1; return; }
    if (tag.local === 'body') body = true;
    if (!body) return;
    if (tag.local === 't') reading = true;
    if (tag.local === 'tab') parts.push('\t');
    if (tag.local === 'br' || tag.local === 'cr') parts.push('\n');
  };
  parser.ontext = value => { if (reading && !ignored) parts.push(value); };
  parser.oncdata = parser.ontext;
  parser.onclosetag = () => {
    if (ignored) { ignored--; return; }
    const tag = parser.tag;
    if (!body || !namespaces.has(tag.uri)) return;
    if (tag.local === 't') reading = false;
    if (tag.local === 'p') parts.push('\n\n');
    if (tag.local === 'body') body = false;
  };
  const decoder = new StringDecoder('utf8');
  let size = 0;
  const stream = document.internalStream('uint8array');
  await new Promise((resolve,reject)=>{
    stream.on('data',chunk=>{
      try {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) throw new Error('Document body too large');
        parser.write(decoder.write(Buffer.from(chunk)));
      } catch(error) { stream.pause(); reject(error); }
    }).on('error',reject).on('end',resolve).resume();
  });
  parser.write(decoder.end()).close();
  return parts.join('').trim();
};
