export function shortcutAction(event,{playerVisible,dialogOpen,ready}) {
  if(!playerVisible||dialogOpen||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return null;
  const target=event.target;
  const editable=target?.closest?.('textarea,select,[contenteditable]:not([contenteditable="false"])');
  const input=target?.closest?.('input');
  // Space always controls playback, even when a button or timeline has focus.
  if(editable || (input && input.type!=='range'))return null;
  const key=event.key.toLowerCase();
  if(key==='f')return event.repeat?null:'fullscreen';
  if(!ready)return null;
  if(event.code==='Space'||event.key===' ')return 'center';
  if(input)return null; // Preserve the timeline's native arrow-key seeking.
  return key==='arrowleft'?(event.shiftKey?'previous':'replay'):key==='arrowright'?'next':key==='arrowup'?'faster':key==='arrowdown'?'slower':key==='l'?'loop':null;
}
