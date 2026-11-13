'use strict';
// KL pilot import invariant. An OSM directed edge ID identifies one graph arc;
// reusing it for another record makes path diagnostics ambiguous. Fail closed.
// This is per-load, read-only validation, not a database index or migration.
function createEdgeIdGuard(){
 const seen=new Set();
 return {
  record(id){
   if(typeof id!=='string'||!id.trim())throw Error('Invalid directed edge ID');
   if(seen.has(id))throw Error('Duplicate directed edge ID');
   seen.add(id);
  },
  get checked(){return seen.size;}
 };
}
module.exports={createEdgeIdGuard};
