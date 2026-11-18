'use strict';
// Public QR verification must always fail closed when the parent record is missing.
// The QR confirms a historical editorial event: recognition remains on record
// after the seven-day spotlight and after any later integrity notice.
// A notice is disclosed separately; the original recognition is never erased.
function currentLetterStatus(letter,recognition){
 if(!letter)return 'not-found';
 if(!recognition||!['active','archived','withdrawn'].includes(recognition.status))
  return 'invalid';
 if(!['valid','withdrawn'].includes(letter.status))return 'invalid';
 if(recognition.status==='withdrawn'||letter.status==='withdrawn')
  return 'recognized-with-notice';
 return 'recognized';
}
function officialVerificationUrl(id){
 if(!/^OG-WRS-[A-Z0-9-]{8,64}$/.test(String(id||'')))throw Error('Invalid recognition letter reference');
 const url=new URL('https://oilandgas.eu.com/verify-letter.html');
 url.searchParams.set('id',id);
 return url.href;
}
module.exports={currentLetterStatus,officialVerificationUrl};
