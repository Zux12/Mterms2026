'use strict';
const map=L.map('map').setView([3.14,101.69],12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(map);
let routeLayer=null,markers=[],nextPoint='start',routeController=null,requestVersion=0,gpsMarker=null;
// Browser geolocation cannot be aborted. Discard late callbacks after a manual
// coordinate/map/swap decision or a newer location request.
let gpsRequestVersion=0;
function cancelPendingGps(){
 gpsRequestVersion++;
 const button=document.getElementById('gps');
 if(button.disabled)
  document.getElementById('gps-note').textContent='Pending GPS selection cancelled after manual coordinate change.';
 button.disabled=false;
}
function invalidateRoute(){
 document.getElementById('access-review').hidden=true;
 document.getElementById('access-review-text').textContent='';
 document.getElementById('trip-distance').textContent='—';
 document.getElementById('trip-eta').textContent='—';
 document.getElementById('trip-safety').textContent='Not verified for legal driving';
 requestVersion++;
 if(routeController){routeController.abort();routeController=null;}
 if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}
 for(const m of markers)map.removeLayer(m);
 markers=[];
}
const selectionMarkers={start:null,end:null};
for(const id of ['start','end']){
 document.getElementById(id).addEventListener('input',()=>{
  cancelPendingGps();
  invalidateRoute();
  status.textContent='Coordinates changed. Preview route to recalculate.';
 });
}
map.on('click',event=>{
 const id=nextPoint;
 cancelPendingGps();
 invalidateRoute();
 const {lat,lng}=event.latlng;
 document.getElementById(id).value=lat.toFixed(6)+', '+lng.toFixed(6);
 if(selectionMarkers[id])map.removeLayer(selectionMarkers[id]);
 selectionMarkers[id]=L.circleMarker([lat,lng],{radius:7,color:id==='start'?'#17803d':'#c34530',fillOpacity:.8}).addTo(map);
 nextPoint=id==='start'?'end':'start';
 status.textContent=(id==='start'?'Start':'Destination')+' selected. Next map click sets '+nextPoint+'.';
});
const button=document.getElementById('route'),status=document.getElementById('status');
const gpsNote=document.getElementById('gps-note');
document.getElementById('gps').addEventListener('click',()=>{
 const action=document.getElementById('gps');
 if(!navigator.geolocation){gpsNote.textContent='This browser does not support GPS location.';return;}
 const gpsVersion=++gpsRequestVersion;
 action.disabled=true;
 gpsNote.textContent='Requesting one-time location permission…';
 navigator.geolocation.getCurrentPosition(position=>{
  if(gpsVersion!==gpsRequestVersion)return;
  action.disabled=false;
  const {latitude:lat,longitude:lng,accuracy}=position.coords;
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<2.5||lat>3.8||lng<100.8||lng>102.3){
   gpsNote.textContent='Location is outside the current KL experimental coverage. No route requested.';
   return;
  }
  // Do not silently treat missing or implausible GPS accuracy as zero metres.
  // 100 m is a conservative stationary preview threshold, not road-legality proof.
  if(!Number.isFinite(accuracy)||accuracy<0||accuracy>100){
   gpsNote.textContent='GPS accuracy unavailable or exceeds 100 m. Location not used; enter coordinates manually or retry.';
   return;
  }
  invalidateRoute();
  document.getElementById('start').value=lat.toFixed(6)+', '+lng.toFixed(6);
  if(gpsMarker)map.removeLayer(gpsMarker);
  gpsMarker=L.circleMarker([lat,lng],{radius:8,color:'#0369a1',fillOpacity:.8}).addTo(map);
  map.setView([lat,lng],Math.max(map.getZoom(),15));
  gpsNote.textContent='GPS position captured once (accuracy ±'+Math.round(accuracy)+' m). No automatic tracking or rerouting.';
  status.textContent='GPS start selected. Preview a route for stationary testing.';
 },error=>{
  if(gpsVersion!==gpsRequestVersion)return;
  action.disabled=false;
  gpsNote.textContent=error.code===1?'Location permission denied. You can still enter coordinates.':'Could not determine your location. Try again or enter coordinates.';
 },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
document.getElementById('center').addEventListener('click',()=>{
 if(routeLayer){map.fitBounds(routeLayer.getBounds(),{padding:[30,30]});return;}
 try{
  const a=coordinate('start'),b=coordinate('end');
  map.fitBounds([a,b],{padding:[40,40]});
 }catch(error){status.textContent=error.message;}
});
function coordinate(id){
 const parts=document.getElementById(id).value.split(',').map(x=>Number(x.trim()));
 if(parts.length!==2||!parts.every(Number.isFinite)||parts[0]<2.5||parts[0]>3.8||parts[1]<100.8||parts[1]>102.3)
  throw Error('Enter valid KL pilot latitude, longitude.');
 return parts;
}
document.getElementById('check').addEventListener('click',async()=>{
 const check=document.getElementById('check');
 check.disabled=true;status.textContent='Checking isolated KL graph…';
 try{
  const token=document.getElementById('token').value;
  if(!token)throw Error('Enter the local preview token.');
  const response=await fetch('/api/jalan/kl/health',{headers:{'x-jalan-preview-token':token}});
  const data=await response.json();
  if(!response.ok||data.ok!==true||data.readOnly!==true||
     data.liveRouting!==false||data.graphEdges!==168221)
   throw Error(data.error||'Graph not ready or unexpected preview configuration');
  status.textContent='KL graph available: '+data.graphEdges.toLocaleString()+
   ' directed edges.\nRead-only: YES\nLive routing: NO\nGraph cached: '+(data.graphCached?'YES':'NO');
 }catch(error){status.textContent='Connection unavailable: '+error.message;}
 finally{check.disabled=false;}
});
document.getElementById('swap').addEventListener('click',()=>{
 cancelPendingGps();
 invalidateRoute();
 const a=document.getElementById('start'),b=document.getElementById('end');
 const value=a.value;a.value=b.value;b.value=value;
 for(const m of Object.values(selectionMarkers))if(m)map.removeLayer(m);
 selectionMarkers.start=null;selectionMarkers.end=null;
 nextPoint='start';
 if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}
 for(const m of markers)map.removeLayer(m);
 markers=[];
 status.textContent='Start and destination swapped. Preview route to recalculate.';
});
button.addEventListener('click',async()=>{
 invalidateRoute();
 const version=requestVersion;
 routeController=new AbortController();
 const controller=routeController;
 button.disabled=true;status.textContent='Requesting experimental route…';
 try{
  const [startLat,startLng]=coordinate('start'),[endLat,endLng]=coordinate('end');
  const token=document.getElementById('token').value;
  if(!token)throw Error('Enter the local preview token.');
  // Never send a coordinate-bearing GET URL from the new private UI.
  // On POST failure, do not retry the legacy GET transport.
  const response=await fetch('/api/jalan/kl/route',{
   method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','x-jalan-preview-token':token},
   body:JSON.stringify({startLat,startLng,endLat,endLng}),
   cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal
  });
  const data=await response.json();
  if(version!==requestVersion)return;
  if(!response.ok||data.ok!==true)throw Error(data.error||'Route unavailable');
  if(data.mode!=='EXPERIMENTAL_SEGMENT_ROUTE'||data.routingActivated!==false||
     data.legalDrivingRouteVerified!==false||data.turnRestrictionsEnforced!==false||
     data.geometry?.type!=='LineString'||!Array.isArray(data.geometry.coordinates)||
     data.geometry.coordinates.length<2)throw Error('Unexpected or unsafe preview response');
  const coords=data.geometry.coordinates.map(c=>{
   if(!Array.isArray(c)||c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1]))
    throw Error('Invalid route geometry');
   return [c[1],c[0]];
  });
  if(routeLayer)map.removeLayer(routeLayer);
  for(const m of Object.values(selectionMarkers))if(m)map.removeLayer(m);
  selectionMarkers.start=null;selectionMarkers.end=null;
  for(const m of markers)map.removeLayer(m);
  routeLayer=L.polyline(coords,{color:'#155cc1',weight:5}).addTo(map);
  markers=[L.circleMarker(coords[0],{radius:7,color:'#17803d'}).addTo(map),
   L.circleMarker(coords[coords.length-1],{radius:7,color:'#c34530'}).addTo(map)];
  map.fitBounds(routeLayer.getBounds(),{padding:[30,30]});
  document.getElementById('trip-distance').textContent=(data.distanceMeters/1000).toFixed(2)+' km';
  document.getElementById('trip-eta').textContent=data.illustrativeEtaMinutes+' min';
  document.getElementById('trip-safety').textContent='Experimental only · driving legality unverified';
  const accessReview=document.getElementById('access-review');
  const accessReviewText=document.getElementById('access-review-text');
  if(data.potentialAccessReviewEdges>0){
   accessReview.hidden=false;
   const flagged=Array.isArray(data.accessCautionDetails)?data.accessCautionDetails:[];
   const rows=flagged.map((edge,i)=>{
    const id=String(edge.edgeId||'unknown').replace(/[^a-z0-9:_-]/gi,'');
    const tags=['access','vehicle','motorVehicle']
     .filter(k=>typeof edge[k]==='string'&&edge[k])
     .map(k=>k+': '+edge[k]).join(', ');
    return (i+1)+'. '+id+'  '+(tags||'Tag unavailable');
   });
   if(!rows.length)rows.push('Specific imported access tags unavailable; do not assume this route is unrestricted.');
   if(data.accessCautionDetailsTruncated||flagged.length<data.potentialAccessReviewEdges)
    rows.push('Additional flagged directed edges are not shown.');
   accessReviewText.textContent=rows.join('\\n');
  }

  // Already computed by backend road snap, not inferred from route geometry.
  // This is a proximity advisory, never a legal/physical walking approval.
  const safeSnap=value=>Number.isFinite(value)&&value>=0&&value<=200?
   Math.round(value)+' m':'unavailable';
  const endSnapReview=Number.isFinite(data.endSnapMeters)&&data.endSnapMeters>=25;
  const anyAmbiguous=data.startSnapAmbiguous===true||data.endSnapAmbiguous===true;
  status.textContent='Distance: '+(data.distanceMeters/1000).toFixed(2)+' km\n'+
   'Illustrative ETA (not traffic-aware): '+data.illustrativeEtaMinutes+' min\n'+
   'Start-to-road snap: '+safeSnap(data.startSnapMeters)+'\n'+
   'Destination-to-road snap: '+safeSnap(data.endSnapMeters)+'\n'+
   (endSnapReview?'Arrival caution: destination is away from the selected imported road; verify permitted access and final walking route.\n':'')+
   (anyAmbiguous?'Snap caution: multiple nearby graph edges may fit the requested point.\n':'')+
   'Possible turn-restriction warnings: '+(data.potentialTurnRestrictionReviewCount??'unavailable')+'\n'+
   'Access caution edges: '+data.potentialAccessReviewEdges+'\n'+
   'Legal driving route verified: NO';
 }catch(error){if(version===requestVersion&&error.name!=='AbortError')status.textContent='Preview unavailable: '+error.message;}
 finally{if(version===requestVersion){routeController=null;button.disabled=false;}else button.disabled=false;}
});
