import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const load = (file) => {
  const module = {exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports:module.exports});return module.exports;
};
const {iscottAutoCloseFactory}=load('src/lib/iscottAutoClose.ts');
const create=vm.runInNewContext('('+iscottAutoCloseFactory+')');
const {bridgeIScottAvatarSpeechEvents:bridge,versionIScottSpeechAssetReferences:version}=load('src/lib/iscottAvatarSpeechBridge.ts');
const reference='/pages/avatar-iscott-assets/_next/static/chunks/app/page-30ca92a503a28b1a.js';
assert.equal(version(reference+'"'),reference+'?ww-speech=1"');
assert.equal(version(version(reference+'"')),version(reference+'"'),'asset versioning is idempotent');
const anchor='if(i){let[e,...t]=i;this.emit(e,...t)}';
const sdk='/* AVATAR_SPEAK_ENDED="avatar.speak_ended" USER_TRANSCRIPTION="user.transcription" */\n'+anchor;
assert.equal(bridge('unrelated asset'), 'unrelated asset');
assert.equal(bridge(sdk+anchor),sdk+anchor,'ambiguous upstream stays unchanged');
assert.equal(bridge(bridge(sdk)),bridge(sdk),'no duplicate injection');
const emitted=[],observed=[];
vm.runInNewContext(bridge(sdk),{i:['avatar.speak_ended',{event_id:'end'}],window:{__wildworksAvatarSpeechEvent:(...v)=>observed.push(v)},sessionClient:{sessionToken:'fake-current-token'},emit:(...v)=>emitted.push(v)});
assert.equal(emitted.length,1);assert.equal(observed.length,1);assert.equal(observed[0][0],'fake-current-token');
const closure=fs.readFileSync('app/pages/avatar-iscott/route.ts','utf8');
const start=closure.indexOf('window.__wildworksAvatarSpeechSession =');
const finish=closure.indexOf('\n      const safeRandomId',start);
assert.ok(start>0&&finish>start);
const delivered=[];const sandbox={state:{sessionLive:true,sessionToken:'fake-current-token',liveAvatarSessionId:'current'},window:{dispatchEvent:e=>delivered.push(e)},CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail;}}};
vm.runInNewContext(closure.slice(start,finish),sandbox);
sandbox.window.__wildworksAvatarSpeechEvent('old-token','avatar.speak_ended',{event_id:'old'});
assert.equal(delivered.length,0,'old SDK instance cannot act on new session');
sandbox.window.__wildworksAvatarSpeechEvent('fake-current-token','unknown',{text:'ignored'});
assert.equal(delivered.length,0);
sandbox.window.__wildworksAvatarSpeechEvent('fake-current-token','avatar.speak_ended',{event_id:'current'});
assert.equal(delivered.length,1);assert.equal(JSON.stringify(delivered).includes('fake-current-token'),false,'token never enters the event');
sandbox.state.sessionLive=false;sandbox.window.__wildworksAvatarSpeechEvent('fake-current-token','avatar.speak_ended',{});assert.equal(delivered.length,1);
let cases=0;
function harness(){let current='one',canClose=true,seq=0;const timers=new Map(),stops=[];const c=create({currentSessionId:()=>current,canClose:()=>canClose,setTimer:fn=>{timers.set(++seq,fn);return seq;},clearTimer:id=>timers.delete(id),stop:r=>stops.push(r)});return{c,stops,timers,setSession:s=>current=s,setDelivered:v=>canClose=v,event:(type,text='',id)=>c.event({sessionId:current,type,text,eventId:id||'event-'+(++seq)}),flush:()=>{for(const[id,fn]of [...timers]){timers.delete(id);fn();}}};}
const question=h=>h.event('avatar.transcription','Thank you. Is there anything else I can help you with today?');
const decline=(h,text="No, I'm good, thank you.")=>{h.event('user.speak_started');h.event('user.transcription',text);h.event('user.speak_ended');};
const closeText="You're welcome! Feel free to look around the site and the beautiful work. Come back here with any questions anytime.";
const closing=h=>{h.event('avatar.speak_started');h.event('avatar.transcription',closeText);};
for(const text of ["No, I'm good, thank you.","No, I’m good.","No.","No thanks.","I'm all set."]){const h=harness();question(h);decline(h,text);h.flush();assert.equal(h.stops.length,0);closing(h);h.flush();assert.equal(h.stops.length,0,'speech must finish');h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,1);h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,1,'stop once');cases++;}
for(const text of ["No, I'm good, but I have another question.","No, that email is wrong.","No, I want a pond instead."]){const h=harness();question(h);decline(h,text);closing(h);h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,0,text);cases++;}
{const h=harness();h.event('avatar.transcription','Did I hear your email correctly?');decline(h,'No.');closing(h);h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,0);cases++;}
{const h=harness();question(h);decline(h);closing(h);h.event('avatar.speak_ended');h.event('user.speak_started');h.flush();assert.equal(h.stops.length,0,'continuation cancels immediately');cases++;}
{const h=harness();question(h);decline(h);closing(h);h.event('avatar.speak_ended');h.setSession('two');h.flush();assert.equal(h.stops.length,0,'remint invalidates callback');cases++;}
{const h=harness();question(h);decline(h);closing(h);h.event('avatar.speak_ended');h.c.reset();h.flush();assert.equal(h.stops.length,0);cases++;}
{const h=harness();h.setDelivered(false);question(h);decline(h);closing(h);h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,0,'pending or failed send stays visible');h.setDelivered(true);h.c.leadChanged();h.flush();assert.equal(h.stops.length,1,'delivery may arrive after goodbye');cases++;}
{const h=harness();question(h);decline(h);h.event('avatar.transcription',closeText);h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,0,'stale end without new start cannot close');h.event('avatar.speak_started');h.event('avatar.speak_ended');h.flush();assert.equal(h.stops.length,1);cases++;}
console.log(`iScott goodbye close: ${cases} lifecycle cases and SDK/token bridge passed. No network calls.`);
