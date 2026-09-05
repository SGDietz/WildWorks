import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const home = await fs.readFile("app/pages/Home/page.tsx", "utf8");
const ast = ts.createSourceFile("page.tsx", home, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function callback(name) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, name + " exists");
  return "(() => {" + ts.transpileModule("const callback = " + result + ";", {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText + "\nreturn callback;})()";
}
let wake=3, status="", pending=null;
const requests=[], picker=[];
const context=vm.createContext({
  File, FormData, crypto, CustomEvent,
  document:{querySelector:()=>({contentWindow:{dispatchEvent:event=>picker.push(event.detail)}})},
  window:{location:{pathname:"/pages/Home"},innerWidth:443,innerHeight:816},
  localStorage:{getItem:key=>key==='wildworks.liveAvatarSessionId'?'current-avatar-session':null},
  getAnonymousVisitorId:()=>"test-visitor", getClientSessionId:()=>"test-browser",
  setIScottMediaStatus:value=>{status=value;},setPendingIScottMedia:value=>{pending=value;},
  setAvatarWakeKey:fn=>{wake=fn(wake);},
  fetch:async(url,init)=>{requests.push({url,init});return{ok:true,json:async()=>({ok:true,leadLinked:true,followUpStatus:"sent"})};},
});
const upload=vm.runInContext(callback("handleIScottMediaChange"),context);
const file=new File([new Uint8Array([137,80,78,71])],"56379.png",{type:"image/png"});
await upload({target:{files:[file],value:"file"}});
assert.equal(wake,3,"upload must preserve the current iframe key");
assert.equal(requests[0].init.body.get('liveAvatarSessionId'),'current-avatar-session');
assert.equal(requests[0].init.body.get('anonymousVisitorId'),'test-visitor');
assert.ok(pending?.file===file);
assert.match(status,/Saved with Your Inquiry/);
assert.doesNotMatch(status,/56379|looking at|sent|delivered/i);
assert.equal(picker[0].open,false);
const accepted=vm.runInContext(callback("handleIScottMediaAccepted"),context);
status="Your Photo or Video is Saved. The Follow-Up Notification Could Not Be Completed.";
accepted('56379.png');
assert.equal(pending,null);
assert.match(status,/Could Not Be Completed/,'demo acceptance must not erase a notification failure');
wake=0; await upload({target:{files:[file],value:"file"}});
assert.equal(wake,1,'an upload before the first conversation may mount the frame');

// Execute the actual picker/visibility branch with a controllable clock.
const route=await fs.readFile('app/pages/avatar-iscott/route.ts','utf8');
const begin=route.indexOf('      let pendingStartGate = null;');
const end=route.indexOf('      window.addEventListener("pagehide"',begin);
const listeners={},timers=new Map(); let stopped=0,armed=0,now=100;
const document={visibilityState:'visible',documentElement:{matches:()=>false},addEventListener:(name,fn)=>{listeners[name]=fn;}};
const runtime=vm.createContext({
 document, Date:{now:()=>now}, sessionActive:true, stopping:false,
 idleTimer:null,idleLimitMs:60000,clearIdleTimer:()=>{armed=0;},stopForIdle:()=>{stopped++;},
 window:{addEventListener:(name,fn)=>{listeners[name]=fn;},setTimeout:(fn,ms)=>{const id=timers.size+1;timers.set(id,{fn,ms});armed++;return id;},clearTimeout:id=>{timers.delete(id);}},
});
vm.runInContext(route.slice(begin,end),runtime);
listeners['wildworks:media-picker']({detail:{open:true}});
document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(stopped,0,'native picker hide must preserve the active session');
document.visibilityState='visible';listeners.visibilitychange();
assert.ok(armed>0,'normal idle protection resumes after picker');
document.visibilityState='hidden';listeners.visibilitychange();
assert.equal(stopped,1,'leaving the page still stops normally');
document.visibilityState='visible';listeners['wildworks:media-picker']({detail:{open:true}});
document.visibilityState='hidden';now+=120001;
const expiry=[...timers.values()].find(t=>t.ms===120000);assert.ok(expiry);expiry.fn();
assert.equal(stopped,2,'picker exception is bounded');
console.log('Upload continuity passed: exact Home handler, session ownership, stable iframe, truthful status, native picker, and bounded leave protection. No network.');
