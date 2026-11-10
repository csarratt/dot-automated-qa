'use strict';

// Cross-session, same-browser-and-viewport evidence comparison. A difference
// is not automatically a defect, nor proof an intended experiment change worked.
function compareDomInventories(before, after) {
  if (!before || !after || !Array.isArray(before.entries) || !Array.isArray(after.entries))
    return {status:'NOT_TESTED',reason:'One or both DOM inventories unavailable',changes:[],counts:{}};
  const signature = e=>JSON.stringify([e.kind,e.tag,e.label,e.type||'',e.resourceFingerprint||'']);
  const counts = entries=>{
    const map=new Map();
    for(const entry of entries) {
      const k=signature(entry);
      const old=map.get(k);
      if(old)old.count++;
      else map.set(k,{entry,count:1});
    }
    return map;
  };
  const a=counts(before.entries),b=counts(after.entries);
  const changes=[];
  for(const [key,obj] of a) {
    const n=b.get(key)?.count||0;
    if(obj.count>n) changes.push({type:'removed',kind:obj.entry.kind,
      tag:obj.entry.tag,label:obj.entry.label,count:obj.count-n});
  }
  for(const [key,obj] of b) {
    const n=a.get(key)?.count||0;
    if(obj.count>n) changes.push({type:'added',kind:obj.entry.kind,
      tag:obj.entry.tag,label:obj.entry.label,count:obj.count-n});
  }
  // Compare positions only for exactly one matching semantic element.
  const moved=[];
  for(const [key,obj] of a) {
    const newer=b.get(key);
    if(!newer || obj.count!==1 || newer.count!==1) continue;
    const oldR=obj.entry.geometry||{},newR=newer.entry.geometry||{};
    const dx=Math.abs((oldR.x||0)-(newR.x||0));
    const dy=Math.abs((oldR.y||0)-(newR.y||0));
    const dw=Math.abs((oldR.width||0)-(newR.width||0));
    const dh=Math.abs((oldR.height||0)-(newR.height||0));
    const signedDx=(newR.x||0)-(oldR.x||0);
    const signedDy=(newR.y||0)-(oldR.y||0);
    if(dx>=24 || dy>=48 || dw>=24 || dh>=24) moved.push({
      type:'geometry',kind:obj.entry.kind,tag:obj.entry.tag,
      label:obj.entry.label,dx,dy,dw,dh,signedDx,signedDy
    });
  }
  // Shared displacement is usually a single upstream structural change,
  // not dozens of unrelated element failures. Group only vertical movements
  // with stable horizontal position and dimensions.
  const buckets=new Map();
  for(const entry of moved) {
    if(entry.dx>4 || entry.dw>4 || entry.dh>4 || entry.dy<48) continue;
    const displacement=Math.round(entry.signedDy/4)*4;
    const group=buckets.get(displacement)||{
      displacementY:displacement,elementCount:0,examples:[]
    };
    group.elementCount++;
    if(group.examples.length<5)group.examples.push(entry.label);
    buckets.set(displacement,group);
  }
  const structuralShifts=[...buckets.values()].filter(group=>group.elementCount>=5)
    .sort((a,b)=>b.elementCount-a.elementCount);
  const grouped=new Set(structuralShifts.map(g=>g.displacementY));
  const ungrouped=moved.filter(entry=>
    !(entry.dx<=4 && entry.dw<=4 && entry.dh<=4 && entry.dy>=48 &&
      grouped.has(Math.round(entry.signedDy/4)*4)));
  const rawChanges=[...changes,...ungrouped];
  return {
    status:'COMPARED',
    limitations:['Changes are findings for human review, not an automatic defect',
      'Dynamic content and layout changes may occur without an experiment',
      'A matching inventory does not verify the expected experiment executed',
      'Image/link resource path changes use opaque fingerprints; pixel differences are not evaluated'],
    counts:{
      baseline:before.entries.length,variation:after.entries.length,
      added:changes.filter(c=>c.type==='added').reduce((n,c)=>n+c.count,0),
      removed:changes.filter(c=>c.type==='removed').reduce((n,c)=>n+c.count,0),
      repositioned:moved.length,
      structuralShiftGroups:structuralShifts.length
    },
    truncated:!!before.truncated||!!after.truncated,
    structuralShifts,
    changes:rawChanges.slice(0,100),
    omitted:Math.max(0,rawChanges.length-100)
  };
}
module.exports={compareDomInventories};
