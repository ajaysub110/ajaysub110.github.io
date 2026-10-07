import {listVideos,saveVideo,getVideoFile,renameVideo,deleteVideo,savePractice,requestPersistence,storageInfo,storageError} from './storage.js?v=20261006-3';
import {shortcutAction} from './shortcuts.js?v=20261006-3';
import {fixedBoundaries, segmentAt, editBoundary, addBoundary, restorePractice, Countdown} from './segments.js?v=20261006-3';
const $ = id => document.getElementById(id);
const video = $('video');
const state = {boundaries:[], index:0, size:5, speed:1, loop:false, pause:2, status:'paused', custom:false, url:null, operation:0, waitingUntil:0, buffering:false};
const countdown = new Countdown();
let toastTimer, frameId;
const iconPaths = {
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  play:'<path d="m9 5 10 7-10 7Z"/>',pause:'<path d="M9 5v14M15 5v14"/>',
  back:'<path d="m14 6-6 6 6 6M8 12h12"/>',next:'<path d="m9 6 6 6-6 6"/>',previous:'<path d="m15 6-6 6 6 6"/>',
  replay:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',loop:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  fullscreen:'<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',collapse:'<path d="M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m16 3 5 5-12 12H4v-5ZM13 6l5 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  video:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>'
};
function icon(name) {return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.video}</svg>`;}
for(const element of document.querySelectorAll('[data-icon]')) element.innerHTML=icon(element.dataset.icon);
let guideShown=false;
try{guideShown=localStorage.getItem('nosheet-guide-shown')==='true';}catch{}

let lastPractice='', practiceWrites=Promise.resolve();
function rememberPractice() {
  if(!currentVideo || !state.boundaries.length)return;
  const id=currentVideo.id;
  const practice={start:state.boundaries[state.index],index:state.index,size:state.size,custom:state.custom,boundaries:state.custom?[...state.boundaries]:undefined,speed:state.speed,pause:state.pause};
  const fingerprint=JSON.stringify([id,practice]);if(fingerprint===lastPractice)return;
  lastPractice=fingerprint;
  currentVideo={...currentVideo,practice};
  library=library.map(item=>item.id===id?{...item,practice}:item);
  // Save each segment transition immediately, rather than waiting for a tab to close.
  practiceWrites=practiceWrites.then(()=>savePractice(id,practice)).catch(e=>{lastPractice='';error(`Could not save your progress. ${storageError(e)}`);});
}
let library = [], currentVideo = null, renameTarget = null, deleteTarget = null;
const time = seconds => {const minutes = Math.floor(seconds/60); return `${minutes}:${(seconds % 60).toFixed(2).padStart(5,'0')}`;};
function feedback(message, action) {
  $('toast').textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').textContent='',1500);
  const zone = document.querySelector(`[data-action="${action}"]`); if (zone) {zone.classList.add('flash');setTimeout(() => zone.classList.remove('flash'),350);}
}
function error(message) {$('error').textContent = message; $('error').hidden = !message;}
function setReady(ready) {for(const element of document.querySelectorAll('.zone,#play,#replay,#previous,#next,#timeline,#loop,#settingsButton,#editButton,#speedSlider,[data-speed]')) element.disabled=!ready;}
function cancel() {state.operation++;countdown.cancel();state.waitingUntil=0;state.buffering=false;video.pause();state.status='paused';render();}
function render() {
  if (!state.boundaries.length) return;
  rememberPractice();
  const end = state.boundaries[state.index+1];
  $('segmentLabel').textContent = `Segment ${state.index+1} of ${state.boundaries.length-1}`;
  $('timeRange').textContent = `${time(state.boundaries[state.index])} — ${time(end)}`;
  $('speedLabel').textContent = `${state.speed}×`;
  $('speedSlider').value=state.speed;$('speedSlider').setAttribute('aria-valuetext',`${state.speed} times normal speed`);
  for(const button of document.querySelectorAll('[data-speed]'))button.setAttribute('aria-pressed',Number(button.dataset.speed)===state.speed);
  $('loop').innerHTML = `${icon('loop')}Loop`; $('loop').setAttribute('aria-label',`Loop ${state.loop?'on':'off'}`); $('loop').setAttribute('aria-pressed',state.loop);
  $('previous').disabled = state.index === 0;
  $('next').disabled = state.index >= state.boundaries.length-2;
  document.querySelector('[data-action="next"]').disabled = $('next').disabled;
  const active = state.status === 'playing' || state.status === 'waiting';
  $('play').innerHTML = icon(active?'pause':'play');$('play').setAttribute('aria-label',active?'Pause playback':'Play segment');
  $('centerIcon').innerHTML = `${icon(active?'pause':'play')}<small>${active?'Pause':'Play'}</small>`;
  $('stage').classList.toggle('paused',!active);
  if(!active)$('app').classList.remove('controls-idle');
  $('waiting').hidden = state.status !== 'waiting' && !state.buffering;
  if (state.buffering) $('waiting').textContent = 'Buffering…';
}
function progress() {
  if (state.boundaries.length) {
    $('timeline').value = video.currentTime;
    $('position').textContent = time(video.currentTime);
    if (state.status === 'waiting') {$('waiting').hidden=false;$('waiting').textContent = `Next repeat in ${Math.max(0,(state.waitingUntil-performance.now())/1000).toFixed(1)}s`;}
    if (state.status === 'playing' && !video.seeking && video.currentTime >= state.boundaries[state.index+1]) finish();
  }
  requestAnimationFrame(progress);
}
function finish() {
  if (state.status !== 'playing') return;
  video.pause();video.currentTime = state.boundaries[state.index+1];state.status='paused';state.buffering=false;
  if (state.loop) {
    state.status='waiting';state.waitingUntil=performance.now()+state.pause*1000;
    countdown.start(state.pause,() => {if (state.loop && state.status === 'waiting') playSegment();});
  }
  render();
}
async function playSegment() {
  if (!state.boundaries.length) return;
  cancel();const operation=state.operation;video.currentTime=state.boundaries[state.index];video.playbackRate=state.speed;state.status='playing';render();
  try {await video.play(); if (operation === state.operation && state.status==='playing') render();}
  catch (e) {if (operation === state.operation) {cancel();error(`Could not play this video. ${e.name === 'NotSupportedError' ? 'Try an MP4 (H.264) or WebM file.' : 'Press Play to try again.'}`);}}
}
function center() {if (['playing','waiting','buffering'].includes(state.status)) {cancel();feedback('Paused','center');} else {playSegment();feedback('Play phrase','center');}}
function navigate(delta) {const index=state.index+delta;if(index<0 || index>=state.boundaries.length-1)return;cancel();state.index=index;playSegment();feedback(delta>0?'Next phrase':'Previous phrase',delta>0?'next':null);}
function setSpeed(value) {if(!state.boundaries.length)return;state.speed=Math.round(Math.min(2,Math.max(.25,value))*4)/4;video.playbackRate=state.speed;render();}
function speed(delta) {setSpeed(state.speed+delta);feedback(`Speed: ${state.speed}×`,delta>0?'faster':'slower');}
function toggleLoop() {if(!state.boundaries.length)return;state.loop=!state.loop;if(!state.loop && state.status==='waiting') cancel();render();feedback(`Loop ${state.loop?'on':'off'}`);}
const actions = {center,replay:()=>{playSegment();feedback('Replay','replay');},next:()=>navigate(1),previous:()=>navigate(-1),faster:()=>speed(.25),slower:()=>speed(-.25)};
for (const zone of document.querySelectorAll('[data-action]')) zone.addEventListener('click',()=>actions[zone.dataset.action]());
$('play').onclick=center;$('replay').onclick=actions.replay;$('previous').onclick=actions.previous;$('next').onclick=actions.next;$('loop').onclick=toggleLoop;
$('speedSlider').oninput=()=>setSpeed(Number($('speedSlider').value));
for(const button of document.querySelectorAll('[data-speed]'))button.onclick=()=>setSpeed(Number(button.dataset.speed));
function redrawBoundaries() {
  $('markers').replaceChildren();
  // Cap the visual ticks for long tutorials; every actual boundary remains editable.
  const stride=Math.max(1,Math.ceil(state.boundaries.length/300));
  state.boundaries.forEach((t,i)=>{if(i===0 || i===state.boundaries.length-1 || i%stride)return;const tick=document.createElement('i');tick.style.left=`${t/video.duration*100}%`;$('markers').append(tick);});
  $('boundaryList').replaceChildren();
  state.boundaries.forEach((t,i)=>{
    const row=document.createElement('div');row.className='boundary-row';
    const label=document.createElement('label');label.textContent=i===0?'Start':i===state.boundaries.length-1?'End':`Boundary ${i}`;
    const input=document.createElement('input');input.type='number';input.step='.01';input.value=t.toFixed(2);input.setAttribute('aria-label',`Boundary ${i} time in seconds`);
    input.disabled=i===0 || i===state.boundaries.length-1;label.append(input);row.append(label);
    input.onchange=()=>{try {const next=editBoundary(state.boundaries,i,Number(input.value));updateBoundaries(next,true);}catch(e){$('editorError').textContent=e.message;input.value=t.toFixed(2);}};
    if (!input.disabled) {const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Remove boundary ${i}`);remove.onclick=()=>updateBoundaries(state.boundaries.filter((_,j)=>j!==i),true);row.append(remove);}
    $('boundaryList').append(row);
  });
  $('editorError').textContent='';render();
}
function updateBoundaries(boundaries, custom) {cancel();state.boundaries=boundaries;state.custom=custom;state.index=segmentAt(boundaries,video.currentTime);redrawBoundaries();}
$('timeline').addEventListener('input',()=>{cancel();video.currentTime=Number($('timeline').value);state.index=segmentAt(state.boundaries,video.currentTime);render();});
$('addBoundary').onclick=()=>{try {updateBoundaries(addBoundary(state.boundaries,video.currentTime),true);}catch(e){$('editorError').textContent=e.message;}};
$('resetBoundaries').onclick=()=>{if(state.custom && !confirm('Replace custom boundaries with fixed segments?'))return;updateBoundaries(fixedBoundaries(video.duration,state.size),false);};
$('editButton').onclick=()=>{cancel();applySegmentSize();applyLoopPause();$('settings').close();$('editor').hidden=!$('editor').hidden;$('editButton').setAttribute('aria-expanded',!$('editor').hidden);if(!$('editor').hidden)$('editor').scrollIntoView({block:'nearest'});};
$('settingsButton').onclick=()=>{cancel();$('settings').showModal();};
$('helpButton').onclick=()=>{cancel();$('help').showModal();};
function applySegmentSize(){
  const value=Number($('segmentSize').value);
  if(!Number.isFinite(value)||value<1||value>30||!Number.isInteger(value)){$('segmentSize').value=state.size;return;}
  if(value===state.size)return;
  if(state.custom && !confirm('Changing segment length will replace your custom boundaries. Continue?')){$('segmentSize').value=state.size;return;}
  state.size=value;updateBoundaries(fixedBoundaries(video.duration,value),false);
};
$('segmentSize').onchange=applySegmentSize;
function applyLoopPause(){const value=Number($('loopPause').value);if(!Number.isFinite(value)||value<0||value>10){$('loopPause').value=state.pause;return;}state.pause=value;rememberPractice();}
$('loopPause').onchange=applyLoopPause;
$('settings').querySelector('form').addEventListener('submit',()=>{applySegmentSize();applyLoopPause();});
function isFullscreen(){return !!document.fullscreenElement || $('app').classList.contains('page-fullscreen');}
function fullscreenChanged(){const active=isFullscreen();$('fullscreen').innerHTML=icon(active?'collapse':'fullscreen');$('fullscreen').setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');revealControls();}
function pageFullscreen(active){$('app').classList.toggle('page-fullscreen',active);document.body.classList.toggle('page-fullscreen-active',active);fullscreenChanged();}
async function toggleFullscreen(){
  if($('app').classList.contains('page-fullscreen')){pageFullscreen(false);return;}
  if(document.fullscreenElement){try{await document.exitFullscreen();}catch{feedback('Could not exit fullscreen. Try Escape.');}return;}
  try{if($('app').requestFullscreen){await $('app').requestFullscreen();return;}}catch{}
  pageFullscreen(true);feedback('Expanded player · tap collapse to exit');
}
$('fullscreen').onclick=toggleFullscreen;
document.addEventListener('fullscreenchange',fullscreenChanged);
document.addEventListener('keydown',e=>{if(e.key==='Escape' && $('app').classList.contains('page-fullscreen') && !document.querySelector('dialog[open]'))pageFullscreen(false);});
let idleTimer;
function revealControls(){clearTimeout(idleTimer);$('app').classList.remove('controls-idle');idleTimer=setTimeout(()=>{if(isFullscreen() && state.status==='playing' && !document.querySelector('dialog[open]'))$('app').classList.add('controls-idle');},2500);}
for(const event of ['pointermove','pointerdown','keydown'])document.addEventListener(event,revealControls);
video.addEventListener('playing',revealControls);
for (const button of document.querySelectorAll('.upload')) button.onclick=()=>$('file').click();
async function loadVideo(item) {
  cancel();const operation=state.operation;error('');state.boundaries=[];
  if(frameId!==undefined && video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);
  frameId=undefined;
  if(state.url){video.removeAttribute('src');video.load();URL.revokeObjectURL(state.url);}
  state.url=null;lastPractice='';
  await practiceWrites;if(operation!==state.operation)return;
  currentVideo=library.find(entry=>entry.id===item.id)||item;
  let file;
  try{file=await getVideoFile(item.id);if(operation!==state.operation)return;}catch(e){error(storageError(e));return;}
  Object.assign(state,{index:0,size:5,speed:1,loop:false,pause:2,custom:false});
  $('segmentSize').value=5;$('loopPause').value=2;$('editor').hidden=true;$('editButton').setAttribute('aria-expanded','false');
  $('filename').textContent=item.title;state.url=URL.createObjectURL(file);video.src=state.url;video.load();
  $('library').hidden=true;$('player').hidden=false;$('app').classList.add('in-player');
  setReady(false);$('toast').textContent='';$('waiting').hidden=true;
  $('segmentLabel').textContent='Loading video…';$('timeRange').textContent='';$('play').disabled=true;
  $('timeline').value=0;$('position').textContent='0:00.00';$('total').textContent='';
}
const thumbnailCache=new Map();
function thumbnailFor(item) {
  if(thumbnailCache.has(item.id))return thumbnailCache.get(item.id);
  const promise=new Promise(resolve=>{
    const preview=document.createElement('video');preview.muted=true;preview.playsInline=true;preview.preload='metadata';
    let finished=false;
    let objectURL;
    const finish=result=>{if(finished)return;finished=true;clearTimeout(timeout);preview.removeAttribute('src');preview.load();if(objectURL)URL.revokeObjectURL(objectURL);resolve(result);};
    const timeout=setTimeout(()=>finish(null),8000);
    preview.onerror=()=>finish(null);
    preview.onloadedmetadata=()=>{if(preview.duration>0)preview.currentTime=Math.min(1,preview.duration/2);else finish(null);};
    preview.onseeked=()=>{try{if(!preview.videoWidth)return finish(null);const canvas=document.createElement('canvas');canvas.width=480;canvas.height=Math.min(720,Math.round(480*preview.videoHeight/preview.videoWidth));canvas.getContext('2d').drawImage(preview,0,0,canvas.width,canvas.height);finish(canvas.toDataURL('image/jpeg',.8));}catch{finish(null);}};
    getVideoFile(item.id).then(file=>{if(finished)return;objectURL=URL.createObjectURL(file);preview.src=objectURL;}).catch(()=>finish(null));
  });
  thumbnailCache.set(item.id,promise);return promise;
}
const previewObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const image=entry.target;previewObserver.unobserve(image);const item=library.find(item=>item.id===image.dataset.videoId);if(item)thumbnailFor(item).then(src=>{if(src && image.isConnected)image.src=src;});}},{rootMargin:'100px'});
function closeMenus(except) {for(const menu of document.querySelectorAll('.song-menu[open]'))if(menu!==except)menu.open=false;}
function renderLibrary() {
  $('retryLibrary').hidden=true;previewObserver.disconnect();$('videoList').replaceChildren();
  $('libraryCount').textContent=library.length?String(library.length):'';$('libraryStatus').textContent='';$('emptyLibrary').hidden=library.length>0;updateStorage();
  library.forEach(item=>{
    const card=document.createElement('article');card.className='song-card';
    const play=document.createElement('button');play.className='song-open';play.setAttribute('aria-label',`Open ${item.title}`);play.onclick=()=>loadVideo(item);
    const image=document.createElement('img');image.className='song-thumbnail';image.alt='';image.dataset.videoId=item.id;
    // A local, neutral poster until the video frame is available.
    image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#191b1f"/><path d="m226 115 30 20-30 20Z" fill="#565c65"/></svg>');
    const content=document.createElement('div');content.className='song-info';
    const heading=document.createElement('h2');heading.textContent=item.title;
    const meta=document.createElement('div');meta.className='song-meta';meta.textContent=item.practice?`Resume segment ${item.practice.index+1} · ${time(item.practice.start)}`:`${(item.bytes/1024/1024).toFixed(1)} MB`;
    content.append(heading,meta);play.append(image,content);
    const menu=document.createElement('details');menu.className='song-menu';
    const summary=document.createElement('summary');summary.innerHTML=icon('more');summary.setAttribute('aria-label',`Options for ${item.title}`);summary.title='Video options';
    menu.addEventListener('toggle',()=>{if(menu.open)closeMenus(menu);});
    const options=document.createElement('div');options.className='menu-options';
    const rename=document.createElement('button');rename.innerHTML=icon('edit')+'Rename';rename.setAttribute('aria-label',`Rename ${item.title}`);rename.onclick=()=>{menu.open=false;openRename(item);};
    const remove=document.createElement('button');remove.className='delete-option';remove.innerHTML=icon('trash')+'Delete';remove.setAttribute('aria-label',`Delete ${item.title}`);remove.onclick=()=>{menu.open=false;openDelete(item);};
    options.append(rename,remove);menu.append(summary,options);card.append(play,menu);$('videoList').append(card);previewObserver.observe(image);
  });
}
document.addEventListener('click',e=>{if(!e.target.closest('.song-menu'))closeMenus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
function openDelete(item){cancel();deleteTarget=item;$('deleteName').textContent=item.title;$('deleteError').textContent='';$('deleteDialog').showModal();$('cancelDelete').focus();}
$('cancelDelete').onclick=()=>$('deleteDialog').close();$('closeDelete').onclick=()=>$('deleteDialog').close();
$('deleteForm').onsubmit=async e=>{
  e.preventDefault();$('confirmDelete').disabled=true;$('cancelDelete').disabled=true;$('closeDelete').disabled=true;$('deleteError').textContent='';
  try{
    await deleteVideo(deleteTarget.id);
    library=library.filter(item=>item.id!==deleteTarget.id);thumbnailCache.delete(deleteTarget.id);
    if(currentVideo?.id===deleteTarget.id){cancel();state.boundaries=[];currentVideo=null;if(frameId!==undefined&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);frameId=undefined;video.removeAttribute('src');video.load();if(state.url)URL.revokeObjectURL(state.url);state.url=null;}
    renderLibrary();$('deleteDialog').close();
  }catch(e){$('deleteError').textContent=e.message;}finally{$('confirmDelete').disabled=false;$('cancelDelete').disabled=false;$('closeDelete').disabled=false;}
};
$('deleteDialog').addEventListener('cancel',e=>{if($('confirmDelete').disabled)e.preventDefault();});
async function showLibrary() {
  cancel();if($('app').classList.contains('page-fullscreen'))pageFullscreen(false);error('');$('player').hidden=true;$('library').hidden=false;$('app').classList.remove('in-player');
  $('libraryStatus').textContent='Opening your library…';
  try{await practiceWrites;library=await listVideos();renderLibrary();}catch(e){$('libraryStatus').textContent=e.message;}
}
$('libraryButton').onclick=showLibrary;
document.querySelector('.brand').onclick=e=>{e.preventDefault();showLibrary();};
function openRename(item) {cancel();renameTarget=item;$('songName').value=item.title;$('renameError').textContent='';$('renameDialog').showModal();$('songName').focus();$('songName').select();}
$('cancelRename').onclick=()=>$('renameDialog').close();
$('renameForm').onsubmit=async e=>{
  e.preventDefault();$('saveRename').disabled=true;$('renameError').textContent='';
  try{
    const item=await renameVideo(renameTarget.id,$('songName').value);
    library=library.map(entry=>entry.id===item.id?item:entry);
    if(currentVideo?.id===item.id){currentVideo=item;$('filename').textContent=item.title;}
    renderLibrary();$('renameDialog').close();
  }catch(e){$('renameError').textContent=e.message;}finally{$('saveRename').disabled=false;}
};
$('file').onchange=async()=>{
  const file=$('file').files[0];$('file').value='';if(!file)return;
  cancel();error('');$('importFilename').textContent=file.name;$('importProgress').removeAttribute('value');$('importStatus').textContent='Saving on this device…';$('importDialog').showModal();
  try{const item=await saveVideo(file);library=[item,...library];await requestPersistence();await updateStorage();await loadVideo(item);}catch(e){error(storageError(e));}finally{$('importDialog').close();}
};
$('importDialog').addEventListener('cancel',e=>e.preventDefault());
async function initializeLibrary() {try{library=await listVideos();renderLibrary();$('library').hidden=false;}catch(e){$('libraryStatus').textContent='Library unavailable.';$('retryLibrary').hidden=false;error(storageError(e));}}
initializeLibrary();
video.addEventListener('loadedmetadata',()=>{
  if(!Number.isFinite(video.duration)||video.duration<=0){error('This video has no usable duration. Try another file.');return;}
  $('stage').style.setProperty('--video-ratio',video.videoWidth/video.videoHeight || 16/9);
  Object.assign(state,restorePractice(video.duration,currentVideo?.practice));
  video.playbackRate=state.speed;video.currentTime=state.boundaries[state.index];
  $('segmentSize').value=state.size;$('loopPause').value=state.pause;
  if(currentVideo?.practice)feedback(`Resumed segment ${state.index+1}`);
  $('timeline').max=video.duration;$('total').textContent=time(video.duration);$('play').disabled=false;
  setReady(true);redrawBoundaries();
  if(video.requestVideoFrameCallback){const frame=()=>{if(state.status==='playing'&&!video.seeking&&video.currentTime>=state.boundaries[state.index+1])finish();frameId=video.requestVideoFrameCallback(frame);};frameId=video.requestVideoFrameCallback(frame);}
  if(!guideShown && !$('player').hidden){guideShown=true;try{localStorage.setItem('nosheet-guide-shown','true');}catch{}$('help').showModal();}
});
video.addEventListener('error',()=>{cancel();setReady(false);state.boundaries=[];$('play').disabled=true;$('segmentLabel').textContent='Unable to load video';error('This file could not be decoded. Try an MP4 (H.264) or WebM video, or choose another file.');});
video.addEventListener('ended',finish);
video.addEventListener('waiting',()=>{if(state.status==='playing'){state.buffering=true;render();}});
video.addEventListener('playing',()=>{state.buffering=false;render();});
document.addEventListener('keydown',e=>{
  const action=shortcutAction(e,{playerVisible:!$('player').hidden,dialogOpen:!!document.querySelector('dialog[open]'),ready:!!state.boundaries.length});
  if(!action)return;
  e.preventDefault();e.stopPropagation();
  if(e.repeat && ['center','loop','fullscreen'].includes(action))return;
  if(action==='fullscreen')toggleFullscreen();else if(action==='loop')toggleLoop();else actions[action]();
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
window.addEventListener('pagehide',()=>{cancel();});
requestAnimationFrame(progress);

function bytesLabel(bytes){return bytes>=1024**3?`${(bytes/1024**3).toFixed(1)} GB`:`${(bytes/1024**2).toFixed(1)} MB`;}
async function updateStorage(){
  const info=await storageInfo(),bytes=library.reduce((total,item)=>total+item.bytes,0);
  $('storageSummary').textContent=`${bytesLabel(bytes)} saved on this device`;
  $('storageUsage').textContent=bytesLabel(bytes);
  $('storageQuota').textContent=info.quota?bytesLabel(info.quota):'Not reported';
  $('storagePersistence').textContent=info.persistent?'Persistent storage granted':'Standard browser storage';
}
$('storageButton').onclick=()=>{$('storageDialog').showModal();updateStorage();};
$('persistStorage').onclick=async()=>{await requestPersistence();await updateStorage();};
