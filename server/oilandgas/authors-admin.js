'use strict';
// Private author directory API. Mount only AFTER the Editor's Desk authentication middleware.
const express = require('express');

const keyOf = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
const splitAuthors = line => String(line || '').split(/\s*[,;]\s*|\s+(?:and|&)\s+/i).map(s => s.trim()).filter(Boolean);
const validName = name => name.length > 1 && name.length <= 160 && !name.includes('@') &&
  !/^(oil\s*(?:&|and)\s*gas editorial|editorial team|et al\.?|anonymous|unknown|various authors)$/i.test(name);
const validEmail = email => !email || (email.length <= 180 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email));

function createAuthorsRouter(database) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const db = database();
      const docs = (await Promise.all(['articles','publications'].map(kind =>
        db.collection(kind).find({status:'published',publication:{$exists:true}},
          {projection:{reference:1,publication:1,authors:1,source:1}}).toArray()
          .then(rows => rows.map(record => ({...record,kind})))))).flat();
      const authors = new Map();
      for (const record of docs) {
        const byline = record.publication?.byline || '';
        const names = splitAuthors(byline).filter(validName);
        for (const name of names) {
          const id = keyOf(name);
          if (!authors.has(id)) authors.set(id, {id,name,email:'',affiliation:'',emailSource:'',publications:[]});
          const author = authors.get(id);
          // Never infer correspondence details from a paper recommender or submitter.
          const submitted = Array.isArray(record.authors) ?
            record.authors.find(a => keyOf(a.name) === id && validEmail(a.email)) : null;
          if (submitted?.email && !author.email) {
            author.email = submitted.email;
            author.emailSource = 'Provided with article submission';
          }
          if (!author.publications.some(p=>p.reference===record.reference)) {
            author.publications.push({kind:record.kind,reference:record.reference,
              title:String(record.publication?.title||'').slice(0,350)});
          }
        }
      }
      const overrides = await db.collection('author_admin_details').find({},
        {projection:{_id:1,email:1,affiliation:1}}).toArray();
      for (const row of overrides) {
        const author = authors.get(row._id);
        if (!author) continue;
        if (typeof row.email === 'string') { author.email = row.email; author.emailSource = row.email ? 'Admin verified/entered' : ''; }
        if (typeof row.affiliation === 'string') author.affiliation = row.affiliation;
      }
      const items = [...authors.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
      res.json({items,total:items.length,
        notice:'Emails are shown only when supplied with a submission or saved by the editor. Affiliation is not inferred from publisher names.'});
    } catch (err) { next(err); }
  });
  router.post('/details', express.json({limit:'8kb'}), async (req,res,next) => {
    try {
      const {id,email,affiliation} = req.body || {};
      if (typeof id !== 'string' || id.length < 2 || id.length > 160 ||
          keyOf(id) !== id || typeof email !== 'string' || typeof affiliation !== 'string' ||
          !validEmail(email.trim()) || affiliation.length > 240 ||
          /[\u0000-\u001f]/.test(affiliation)) {
        return res.status(400).json({error:'Check author, email and affiliation details.'});
      }
      const db=database();
      // Only permit editing an author who appears in a published byline.
      const literal=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const docs=await Promise.all(['articles','publications'].map(k=>db.collection(k)
        .find({status:'published',publication:{$exists:true},
          'publication.byline':{$regex:literal,$options:'i'}},{projection:{'publication.byline':1}})
        .limit(100).toArray()));
      const exists=docs.flat().some(r=>splitAuthors(r.publication?.byline).some(n=>keyOf(n)===id));
      if (!exists) return res.status(404).json({error:'Author was not found in published records.'});
      await db.collection('author_admin_details').updateOne({_id:id},
        {$set:{email:email.trim().toLowerCase(),affiliation:affiliation.trim(),updatedAt:new Date()}},
        {upsert:true});
      res.json({ok:true});
    } catch(err){next(err);}
  });
  return router;
}
module.exports=createAuthorsRouter;
