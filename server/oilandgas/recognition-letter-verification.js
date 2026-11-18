'use strict';
// Public QR verification must always fail closed when the parent record is missing.
function currentLetterStatus(letter,recognition){
 if(!letter)return 'not-found';
 if(letter.status==='withdrawn'||recognition?.status==='withdrawn')return 'withdrawn';
 if(letter.status==='valid'&&['active','archived'].includes(recognition?.status))
  return 'valid';
 return 'invalid';
}
function officialVerificationUrl(id){
 if(!/^OG-WRS-[A-Z0-9-]{8,64}$/.test(String(id||'')))throw Error('Invalid recognition letter reference');
 const url=new URL('https://oilandgas.eu.com/verify-letter.html');
 url.searchParams.set('id',id);
 return url.href;
}
module.exports={currentLetterStatus,officialVerificationUrl};
