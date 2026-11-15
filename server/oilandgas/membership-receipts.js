'use strict';
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const members=()=>mongoose.connection.useDb('oilandgas',{useCache:true}).collection('members');
let working=false;

function message(member){
  const name=String(member.name||'Member').replace(/[\r\n]/g,' ').slice(0,120);
  return [
    'Dear '+name+',',
    'Thank you for applying to join the Oil & Gas Community.',
    'We have received your membership application and it is awaiting editorial review.',
    'This is an acknowledgement of your application, not a membership approval.',
    'We will notify you by email when your membership has been approved.',
    'Visit https://oilandgas.eu.com',
    'Oil & Gas Community Team'
  ].join('\n\n');
}

async function deliverReceipts(){
  if(working||mongoose.connection.readyState!==1||!process.env.OIL_ARTICLE_RESEND_KEY)return;
  working=true;
  try {
    const collection=members();
    for(let i=0;i<10;i++){
      const now=new Date(),lock=crypto.randomUUID();
      const member=await collection.findOneAndUpdate({
        status:'pending',
        'receiptMail.state':{$in:['queued','retry']},
        'receiptMail.nextAttemptAt':{$lte:now},
        'receiptMail.attempts':{$lt:5}
      },{$set:{'receiptMail.state':'sending','receiptMail.lock':lock},
        $inc:{'receiptMail.attempts':1}},
      {returnDocument:'after',sort:{appliedAt:1}});
      if(!member)break;
      const filter={_id:member._id,'receiptMail.lock':lock,'receiptMail.state':'sending'};
      try{
        const transport=nodemailer.createTransport({
          host:'smtp.resend.com',port:465,secure:true,
          auth:{user:'resend',pass:process.env.OIL_ARTICLE_RESEND_KEY},
          connectionTimeout:10000,socketTimeout:20000
        });
        const accepted=await transport.sendMail({
          from:'Oil & Gas Community <receipts@updates.oilandgas.eu.com>',
          to:member.email,
          subject:'Oil & Gas Community — Membership Application Received',
          text:message(member),
          headers:{'Resend-Idempotency-Key':'oilgas-receipt-'+crypto.createHash('sha256').update(member._id).digest('hex')}
        });
        if(!accepted.accepted?.includes(member.email))throw Error('SMTP did not accept recipient');
        await collection.updateOne(filter,{$set:{
          'receiptMail.state':'sent','receiptMail.acceptedAt':new Date(),
          'receiptMail.messageId':String(accepted.messageId||'').slice(0,250)
        },$unset:{'receiptMail.lock':'','receiptMail.nextAttemptAt':'','receiptMail.lastError':''}});
      }catch(err){
        const attempts=Number(member.receiptMail?.attempts||1);
        await collection.updateOne(filter,{$set:{
          'receiptMail.state':attempts>=5?'failed':'retry',
          'receiptMail.lastError':String(err.code||err.message||'SMTP failure').slice(0,120),
          'receiptMail.nextAttemptAt':new Date(Date.now()+Math.min(3600000,300000*attempts))
        },$unset:{'receiptMail.lock':''}});
        console.warn('Oil & Gas application receipt retry',member._id,err.code||err.name);
      }
    }
  }catch(err){console.warn('Oil & Gas application receipt worker',err.code||err.name);}
  finally{working=false;}
}

setInterval(()=>deliverReceipts().catch(()=>{}),60000).unref();
module.exports={deliverReceipts};
