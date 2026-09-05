// A visitor name must be something Scott can actually address. This runs the
// direct parser gate and the production capture/send gate with only local fakes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-september5-test");
await fs.mkdir(out, { recursive: true });
const url = (name) => `file:///${path.join(out, `${name}.mjs`).split(path.sep).join("/")}`;
const write = (name, source) => fs.writeFile(path.join(out, `${name}.mjs`), source, "utf8");
async function transpile(sourcePath, name, rewrites = []) {
  let source = ts.transpileModule(await fs.readFile(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of rewrites) source = source.replaceAll(from, to);
  await write(name, source);
}

await transpile("src/lib/iscottSalesCopy.ts", "iscottSalesCopy");
await transpile("src/lib/iscottLeadParsing.ts", "iscottLeadParsing", [
  ['from "./iscottSalesCopy"', 'from "./iscottSalesCopy.mjs"'],
]);
const Parsing = await import(url("iscottLeadParsing"));

await write("stub-ui", `export function visitorChoseContactMethod(text) {
  if (/\\b(?:phone|call|number)\\b/i.test(text)) return "phone";
  if (/\\b(?:email|mail)\\b/i.test(text)) return "email";
  return null;
}
`);
await write("stub-security", `export function truncateUtf8String(value, limit) { return String(value ?? "").slice(0, limit); }
`);
await write("stub-notify", `export const notifyCalls = [];
export async function notifyIScottLeadByEmail(args) {
  notifyCalls.push(args);
  return { ok: true, status: 200, detail: "", outboxId: "outbox-name-test", outboxStatus: "sent", queued: true, delivered: true, deduplicated: false, providerMessageId: "provider-name-test" };
}
`);
await write("stub-supabase", `export function isSupabaseAdminConfigured() { return true; }
export function getSupabaseAdminConfig() { return { url: "https://local.invalid", serviceRoleKey: "local-key" }; }
`);
await write("stub-alerts", "export function queueSupabaseOperationalAlert() {}\n");
await write("stub-traffic", `export async function classifyTraffic() { return { trafficClass: "public", reason: "local", confidence: 1 }; }
export function trafficColumns(value) { return { traffic_class: value.trafficClass, traffic_reason: value.reason, traffic_confidence: value.confidence }; }
`);
await write("stub-resolve", `export const ISCOTT_TEST_HELD_STATUS = "test_held";
export function canDispatchIScottLeadNotification() { return true; }
`);
// The visitor receipt ships disabled; this check is about the owner package.
await write("stub-visitor-confirmation", `export const ISCOTT_VISITOR_CONFIRMATION_ENABLED = false;
export const ISCOTT_VISITOR_CONFIRMATION_DEFAULT_STATUS = "approval_required";
`);
await transpile("src/lib/iscottLeadCapture.ts", "iscottLeadCapture", [
  ['from "./iscottVisitorConfirmation"', 'from "./stub-visitor-confirmation.mjs"'],
  ['from "./iscottLeadCaptureUi"', 'from "./stub-ui.mjs"'],
  ['from "./apiRouteSecurity"', 'from "./stub-security.mjs"'],
  ['from "./voiceEmailNotifications"', 'from "./stub-notify.mjs"'],
  ['from "./supabaseAdmin"', 'from "./stub-supabase.mjs"'],
  ['from "./wildworksOperationalAlerts"', 'from "./stub-alerts.mjs"'],
  ['from "./iscottLeadParsing"', 'from "./iscottLeadParsing.mjs"'],
  ['from "./trafficClassification"', 'from "./stub-traffic.mjs"'],
  ['from "./iscottTrafficResolve"', 'from "./stub-resolve.mjs"'],
]);
await transpile("src/lib/iscottLeadCaptureUi.ts", "stub-ui");
const Capture = await import(url("iscottLeadCapture"));
const Notify = await import(url("stub-notify"));


const SESSION="september5-smoke", VISITOR="smoke-visitor";
const rows=[
 {role:"user",message:"We have some problem areas in my yard that need help.",laAbsoluteTimestamp:10},
 {role:"user",message:"So, you know, I've got an area that just holds water and the grass is just dead.",laAbsoluteTimestamp:15},
 {role:"user",message:"Can't get anything to grow there.",laAbsoluteTimestamp:17},
 {role:"assistant",message:"What's your name, and what's your email address?",laAbsoluteTimestamp:20},
 {role:"user",message:"My name is Morgan and my email is visitor@example.com.",laAbsoluteTimestamp:25},
 {role:"assistant",message:"Your email is visitor@example.com. Did I hear that exactly right?",laAbsoluteTimestamp:30},
 {role:"user",message:"That's correct.",laAbsoluteTimestamp:32},
 {role:"assistant",message:"May Scott contact you at that email address about this project?",laAbsoluteTimestamp:35},
 {role:"user",message:"Yes.",laAbsoluteTimestamp:38},
];
let lead=null;
let media=[];
const requests=[], feedback=[];
const response=(body)=>({ok:true,status:200,json:async()=>body,text:async()=>JSON.stringify(body)});
const realFetch=globalThis.fetch;
globalThis.fetch=async(target,init={})=>{
 const resource=String(target).split('/rest/v1/')[1]??String(target);
 const method=init.method??'GET'; requests.push({resource,method});
 if(resource.startsWith('iscott_leads')) {
  if(method==='POST') lead={created_at:'2026-09-05T12:40:00Z',...lead,...JSON.parse(init.body)[0]};
  return response(lead?[structuredClone(lead)]:[]);
 }
 if(resource.startsWith('conversation_messages')) return response(rows.map(r=>({role:r.role,message:r.message,la_absolute_timestamp:r.laAbsoluteTimestamp})));
 if(resource.startsWith('iscott_media')) return response(structuredClone(media));
 if(resource.includes('/storage/v1/object/sign/')) return response({signedURL:'/object/sign/test/photo.png?token=local-test'});
 if(resource.startsWith('feedback_events')) { if(init.body) feedback.push(...JSON.parse(init.body)); return response([]); }
 if(/^(transcript_events|preference_candidates|voice_email_outbox|app_events)/.test(resource))return response([]);
 throw new Error('Unexpected external operation '+method+' '+resource);
};
try {
 for(const row of rows) await Capture.processIScottTranscriptRows({sessionId:SESSION,anonymousVisitorId:VISITOR,rows:[row]});
 assert.equal(lead.status,'submitted');
 assert.equal(lead.consent_status,'accepted');
 assert.match(lead.project_need,/holds water|problem areas/);
 assert.match(lead.metadata.project_details.join(' '),/holds water.*grass is.*dead/i);
 assert.match(lead.metadata.project_details.join(' '),/grow there/i);
 assert.equal(Notify.notifyCalls.length,1,'one confirmed owner package');
 assert.match(Notify.notifyCalls[0].projectDetails.join(' '),/holds water.*grass is.*dead/i);
 assert.ok(!feedback.some(r=>r.phrase.includes('My name is Morgan')),'normal contact answer is not negative feedback');
 media=[{id:'photo1',session_id:SESSION,anonymous_visitor_id:VISITOR,upload_id:'upload1',bucket:'test',object_path:'photo.png',original_name:'56379.png',mime_type:'image/png',size_bytes:1024,created_at:'2026-09-05T12:44:54Z'}];
 const before=structuredClone(lead);
 const linked=await Capture.refreshIScottLeadMedia({sessionId:SESSION,anonymousVisitorId:VISITOR,uploadId:'upload1'});
 assert.equal(linked.linked,true); assert.equal(linked.followUpStatus,'sent');
 assert.equal(lead.media_snapshot.length,1);
 assert.equal(lead.transcript_text,before.transcript_text,'photo update preserves transcript');
 assert.equal(lead.notification_outbox_id,before.notification_outbox_id,'photo update preserves original receipt');
 const update=Notify.notifyCalls.at(-1);
 assert.equal(update.followUp.kind,'media'); assert.equal(update.media[0].name,'56379.png');
 await Capture.refreshIScottLeadMedia({sessionId:SESSION,anonymousVisitorId:VISITOR,uploadId:'upload1'});
 assert.equal(Notify.notifyCalls.at(-1).eventId,update.eventId,'retries use the same durable idempotency key');
 assert.ok(requests.filter(r=>r.resource.startsWith('iscott_media')).every(r=>r.resource.includes('session_id.is.null')),'fallback excludes photos already linked to another session');
 const n=Notify.notifyCalls.length;
 assert.equal((await Capture.refreshIScottLeadMedia({sessionId:SESSION,anonymousVisitorId:'wrong-owner',uploadId:'upload1'})).linked,false);
 assert.equal(Notify.notifyCalls.length,n);
 lead={...lead,status:'capturing',submitted_at:null,consent_status:'unknown'};
 await Capture.refreshIScottLeadMedia({sessionId:SESSION,anonymousVisitorId:VISITOR,uploadId:'upload1'});
 assert.equal(Notify.notifyCalls.length,n,'unconsented photo does not send an owner update');
 lead=null; Notify.notifyCalls.length=0;
 const restart=[
 "Um, you know, restarted the avatar and it says down below 56379.",
 "should be a follow-up email with the information. If, you know, if there's anything like that says, you know, a picture information was saved to this Lead.",
 "Okay, so the your email box just popped up. Why did that pop up? That should not be there.",
 ];
 for(let i=0;i<restart.length;i++) await Capture.processIScottTranscriptRows({sessionId:'restarted-smoke',anonymousVisitorId:VISITOR,rows:[{role:'user',message:restart[i],laAbsoluteTimestamp:100+i*10}]});
 assert.equal(lead.contact_method,null,'notification commentary must not create a contact-method choice');
 assert.equal(lead.email,null); assert.equal(Notify.notifyCalls.length,0);
 console.log('September 5 replay passed: drainage content, consent, one package, late media link/update, retry key, session isolation, and no unsolicited capture. No external calls.');
}finally{globalThis.fetch=realFetch;}
