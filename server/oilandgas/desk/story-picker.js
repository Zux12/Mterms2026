'use strict';

let storySlot, storyLabel, storyPage=0, storyGeneration=0, storyChoice=null, storyBusy=false, storyTimer;
const storyDialog=byId('story-picker');
const storyLimit=6;

function resetStoryChoice(){
  storyChoice=null;
  byId('story-selection').hidden=true;
  byId('story-save').disabled=true;
}

function invalidateStories(){
  clearTimeout(storyTimer);
  ++storyGeneration;
  resetStoryChoice();
  byId('story-results').replaceChildren();
  byId('story-previous').disabled=true;
  byId('story-next').disabled=true;
  byId('story-page').textContent='';
  byId('story-results-status').textContent='Loading published stories…';
}

function openStoryPicker(slot,label,row){
  if(!mayLeave())return;
  closeEntry();
  storySlot=slot;storyLabel=label;storyPage=0;
  byId('story-picker-title').textContent='Change '+label.toLowerCase();
  byId('story-picker-current').textContent=row?'Currently showing “'+row.entry.title+'”.':'This position is currently empty.';
  byId('story-search').value='';
  byId('story-kind').value='articles';
  byId('story-save').textContent='Save as '+label;
  byId('story-picker-message').textContent='';
  storyDialog.showModal();
  byId('story-search').focus();
  loadStoryOptions();
}

async function loadStoryOptions(){
  invalidateStories();
  const generation=storyGeneration;
  const kind=byId('story-kind').value;
  const params=new URLSearchParams({kind,q:byId('story-search').value.trim(),page:String(storyPage),limit:String(storyLimit),includeTotal:'true'});
  try{
    const data=await api('browse?'+params);
    if(generation!==storyGeneration||!storyDialog.open)return;
    const results=byId('story-results');
    for(const entry of data.items){
      const li=document.createElement('li');
      const button=document.createElement('button');
      button.type='button';button.className='story-option';button.setAttribute('aria-pressed','false');
      const title=document.createElement('strong');title.textContent=entry.title;
      const byline=document.createElement('span');byline.textContent=entry.byline;
      button.append(title,byline);
      button.onclick=()=>{
        storyChoice=entry;
        results.querySelectorAll('button').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
        byId('story-selection-title').textContent=entry.title;
        byId('story-selection-byline').textContent=entry.byline;
        byId('story-selection-summary').textContent=entry.summary;
        byId('story-selection').hidden=false;
        byId('story-save').disabled=false;
        byId('story-picker-message').textContent='';
        byId('story-selection').scrollIntoView({block:'nearest'});
      };
      li.append(button);results.append(li);
    }
    const total=Number.isSafeInteger(data.total)?data.total:null;
    // A removal can make the old last page empty while the picker is open.
    if(!data.items.length && storyPage>0){
      storyPage=total===null?storyPage-1:Math.max(0,Math.ceil(total/storyLimit)-1);
      return loadStoryOptions();
    }
    byId('story-results-status').textContent=data.items.length
      ?'Showing '+(storyPage*storyLimit+1)+(data.items.length>1?'–'+(storyPage*storyLimit+data.items.length):'')+(total===null?'':' of '+total)+' '+(total===1?kind.slice(0,-1):kind)+'. Select a story to preview it.'
      :'No published '+kind+' match. Try another search or content type.';
    byId('story-page').textContent=data.items.length?'Page '+(storyPage+1)+(total===null?'':' of '+Math.ceil(total/storyLimit)):'';
    byId('story-previous').disabled=storyPage===0;
    byId('story-next').disabled=!data.more;
  }catch(err){
    if(generation!==storyGeneration||!storyDialog.open)return;
    byId('story-results-status').textContent='Could not load stories. ';
    const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Try again';retry.onclick=loadStoryOptions;
    byId('story-results-status').append(retry);
  }
}

async function saveStory(automatic=false){
  if(storyBusy||(!automatic&&!storyChoice))return;
  storyBusy=true;
  clearTimeout(storyTimer);++storyGeneration;
  const controls=[...storyDialog.querySelectorAll('button,input,select')].map(control=>[control,control.disabled]);
  controls.forEach(([control])=>{control.disabled=true;});
  byId('story-picker-message').textContent='Saving…';
  try{
    if(automatic)await api('highlight/automatic',{slot:storySlot});
    else await api('highlight',{slot:storySlot,kind:storyChoice.kind,reference:storyChoice.reference,image:''});
    storyDialog.close();
    byId('message').textContent=storyLabel+(automatic?' now uses automatic industry news.':' updated. Your selection is now on the homepage.');
    await loadDashboardHighlights();
  }catch(err){
    (storyDialog.open?byId('story-picker-message'):byId('message')).textContent=err.message;
  }finally{
    storyBusy=false;
    controls.forEach(([control,disabled])=>{control.disabled=disabled;});
  }
}

byId('story-picker-close').onclick=()=>storyDialog.close();
storyDialog.addEventListener('cancel',event=>{if(storyBusy)event.preventDefault();});
storyDialog.addEventListener('close',()=>{clearTimeout(storyTimer);++storyGeneration;});
byId('story-search').addEventListener('input',()=>{
  invalidateStories();storyPage=0;
  storyTimer=setTimeout(loadStoryOptions,300);
});
byId('story-kind').onchange=()=>{storyPage=0;loadStoryOptions();};
for(const [id,delta] of [['story-previous',-1],['story-next',1]]){
  byId(id).onclick=()=>{storyPage+=delta;loadStoryOptions();};
}
byId('story-save').onclick=()=>saveStory();
byId('story-automatic').onclick=()=>saveStory(true);
