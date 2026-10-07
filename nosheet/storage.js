const DATABASE='nosheet-library';
let connection;
export function openLibrary(timeoutMs=10000) {
  if(connection)return connection;
  const pending=new Promise((resolve,reject)=>{
    let settled=false;
    const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);};
    const timer=setTimeout(()=>fail(new Error('The browser is taking too long to open your library. Close other NoSheet tabs and reload. Your saved videos have not been cleared.')),timeoutMs);
    let request;
    try{request=indexedDB.open(DATABASE,1);}catch(error){fail(error);return;}
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('videos',{keyPath:'id'});db.createObjectStore('files');};
    request.onerror=()=>fail(request.error);
    request.onblocked=()=>fail(new Error('Close other NoSheet tabs, then reload to open your library.'));
    request.onsuccess=()=>{
      const db=request.result;if(settled){db.close();return;}
      settled=true;clearTimeout(timer);
      db.onversionchange=()=>{db.close();if(connection===pending)connection=null;};
      db.onclose=()=>{if(connection===pending)connection=null;};
      resolve(db);
    };
  });
  connection=pending;
  pending.catch(()=>{if(connection===pending)connection=null;});
  return pending;
}
function transactionDone(transaction) {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
    const timer=setTimeout(()=>{finish(new Error('The browser stopped responding while accessing your library. Reload to try again. Your saved library has not been cleared.'));try{transaction.abort();}catch{}},15000);
    transaction.oncomplete=()=>finish();transaction.onabort=()=>finish(transaction.error || new Error('Storage operation cancelled.'));transaction.onerror=()=>{};
  });
}
function result(request) {return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export function storageError(error) {
  if(error?.name==='QuotaExceededError')return 'Not enough browser storage to save this video. Delete some saved videos or free up device space, then try again. Your original file is unchanged.';
  return error?.message || 'Browser storage is unavailable. Use a normal browser window and try again.';
}
export async function listVideos() {
  const db=await openLibrary(),transaction=db.transaction('videos','readonly');
  const [items]=await Promise.all([result(transaction.objectStore('videos').getAll()),transactionDone(transaction)]);
  return items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function saveVideo(file) {
  if(!file.size)throw new Error('The selected file is empty.');
  const item={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').replace(/_/g,' ').slice(0,120)||'Untitled video',originalName:file.name,bytes:file.size,mime:file.type,createdAt:new Date().toISOString()};
  const db=await openLibrary(),transaction=db.transaction(['videos','files'],'readwrite');
  const done=transactionDone(transaction);
  try{transaction.objectStore('videos').add(item);transaction.objectStore('files').add(file,item.id);}catch(error){transaction.abort();await done.catch(()=>{});throw error;}
  await done;return item;
}
export async function getVideoFile(id) {
  const db=await openLibrary(),transaction=db.transaction('files','readonly');
  const [file]=await Promise.all([result(transaction.objectStore('files').get(id)),transactionDone(transaction)]);
  if(!file)throw new Error('This video is no longer saved. Add it to the library again.');
  return file;
}
export async function renameVideo(id,title) {
  title=title.trim();if(!title || title.length>120)throw new Error('Enter a name between 1 and 120 characters.');
  const db=await openLibrary(),transaction=db.transaction('videos','readwrite'),store=transaction.objectStore('videos');
  const done=transactionDone(transaction);let item;
  const request=store.get(id);
  request.onsuccess=()=>{item=request.result;if(!item){transaction.abort();return;}item={...item,title};store.put(item);};
  await done;if(!item)throw new Error('Video not found.');return item;
}
// Update only practice metadata so concurrent renames keep their title.
export async function savePractice(id,practice) {
  const db=await openLibrary(),transaction=db.transaction('videos','readwrite'),store=transaction.objectStore('videos');
  const done=transactionDone(transaction);let item;
  const request=store.get(id);
  request.onsuccess=()=>{item=request.result;if(item)store.put({...item,practice});};
  await done; // A deleted video must never be recreated by a late save.
}
export async function deleteVideo(id) {
  const db=await openLibrary(),transaction=db.transaction(['videos','files'],'readwrite');
  const done=transactionDone(transaction);transaction.objectStore('videos').delete(id);transaction.objectStore('files').delete(id);await done;
}
export async function requestPersistence() {
  try{if(navigator.storage?.persist)return await navigator.storage.persist();}catch{}
  return false;
}
export async function storageInfo() {
  let estimate={},persistent=false;
  try{if(navigator.storage?.estimate)estimate=await navigator.storage.estimate();if(navigator.storage?.persisted)persistent=await navigator.storage.persisted();}catch{}
  return {...estimate,persistent};
}
