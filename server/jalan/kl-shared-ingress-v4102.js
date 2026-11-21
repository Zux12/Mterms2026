'use strict';
// Draft-only original-Mterms shared-host ingress for the KL preview JSON POST.
// Mounted BEFORE the original 5 MB global parser, on ONE exact JALAN path.
// Not deployed. Requires separate shared-host router-log/retention approval.
const express=require('express');
const {requireSharedPreviewToken}=require('./kl-segment-v4102');
const router=express.Router();

function privacyHeaders(res){
 res.set('Cache-Control','no-store');
 res.set('Referrer-Policy','no-referrer');
 res.set('X-Content-Type-Options','nosniff');
}

router.post('/',
 (req,res,next)=>{
  privacyHeaders(res);
  // Reject disabled and unauthenticated requests before their body is parsed.
  if(process.env.JALAN_SHARED_KL_PREVIEW_ENABLED!=='true')
   return res.status(503).json({ok:false,error:'Experimental KL preview is not enabled'});
  next();
 },
 requireSharedPreviewToken,
 (req,res,next)=>{
  const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(type!=='application/json')return res.status(415).json({ok:false,error:'JSON content type required'});
  if(String(req.headers['content-encoding']||'identity').toLowerCase()!=='identity')
   return res.status(415).json({ok:false,error:'Compressed JSON is not supported'});
  next();
 },
 // Unlike checking Content-Length after app-wide parsing, this truly limits
 // inflated JSON bytes for both chunked and fixed-length requests.
 express.json({limit:'1kb',inflate:false,strict:true}),
 (_req,_res,next)=>next()
);
// Body-parser failures must not fall through to the original global handlers.
router.use((err,req,res,next)=>{
 if(!err)return next();
 privacyHeaders(res);
 if(err.type==='entity.too.large')return res.status(413).json({ok:false,error:'KL route JSON exceeds 1024 bytes'});
 if(err.type==='encoding.unsupported'||err.type==='charset.unsupported')
  return res.status(415).json({ok:false,error:'Unsupported KL route encoding'});
 if(err.type==='entity.parse.failed'||err instanceof SyntaxError)
  return res.status(400).json({ok:false,error:'Malformed KL route JSON'});
 next(err);
});
module.exports=router;
