const DATABASE='nosheet-library';
let connection;
export function openLibrary() {
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('videos',{keyPath:'id'});db.createObjectStore('files');};
    request.onerror=()=>{connection=null;reject(request.error);};
    request.onblocked=()=>{connection=null;reject(new Error('Close other NoSheet tabs, then reload to open your library.'));};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
  });
  return connection;
}
function transactionDone(transaction) {return new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error || new Error('Storage operation cancelled.'));transaction.onerror=()=>{};});}
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
