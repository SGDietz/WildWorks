// A visitor name must be something Scott can actually address. This runs the
// direct parser gate and the production capture/send gate with only local fakes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-september6-contact-test");
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



const invalidMethodLines = [
 "You can tell people Scott's phone number.",
 "His personal cell phone, you can reach him directly.",
 "The phone card popped up.",
 "An email.", "Don't phone me.", "Don't email me.",
 "I don't want a phone call.", "What is Scott's email?",
];
const Ui = await import(url("stub-ui"));
for (const text of invalidMethodLines) {
 assert.equal(Ui.visitorChoseContactMethod(text), null, text);
 assert.equal(Parsing.visitorChoseContactMethod(text), null, text);
}
for (const [text,expected] of [
 ["Call me.","phone"], ["Phone. My number is on the screen.","phone"],
 ["Scott can reach out by phone.","phone"], ["Email works for me.","email"],
 ["Uh, email.","email"], ["Don't phone me, email works for me.","email"],
 ["Don't email me, call me.","phone"],
]) assert.equal(Ui.visitorChoseContactMethod(text), expected, text);
for (const name of ["Umberto","Noah","Norman","Sonia","Sol","Yesenia","Wellington"]) {
 assert.equal(Parsing.extractSpokenFullName("My name is " + name), name);
}
assert.equal(Parsing.extractSpokenFullName("My name is Um"),null);
for (const text of ["I need the retaining wall reduced in height by 10%.","I need his help to build a pond."]) {
 assert.ok(Parsing.extractProjectNeed(text),text);
}
for (const text of ["It to be, like the, the entire intro auto opening line","At right now when we're talking, needs to be reduced in height by 10% for sure","His help","At it"]) {
 assert.equal(Parsing.extractProjectNeed(text),null,text);
 assert.equal(Parsing.isSpecificProjectNeed(text),false,text);
}
assert.equal(Parsing.deniesContactReadBack("No, the box did not come up."),false);
assert.equal(Parsing.detectsContactReadBackCorrect("No, the box did not come up."),false);
for(const text of ["No, the box did not come up and that is not correct.","No, the email address you read is not right and the box did not come up.","You read it incorrectly."]) {
 assert.equal(Parsing.deniesContactReadBack(text),true,text);
 assert.equal(Parsing.detectsContactReadBackCorrect(text),false,text);
}
const session="september6-coaching", rows=[];let lead=null;
const reply=(body)=>({ok:true,status:200,json:async()=>body,text:async()=>JSON.stringify(body)});
const originalFetch=globalThis.fetch;
globalThis.fetch=async(target,init={})=>{
 const resource=String(target).split('/rest/v1/')[1]??String(target);
 if(resource.startsWith('iscott_leads')){if(init.method==='POST')lead={created_at:'2026-09-06T17:10:00Z',...lead,...JSON.parse(init.body)[0]};return reply(lead?[structuredClone(lead)]:[]);}
 if(resource.startsWith('conversation_messages'))return reply(rows.map(r=>({role:r.role,message:r.message,la_absolute_timestamp:r.laAbsoluteTimestamp})));
 if(/^(iscott_media|feedback_events|transcript_events|preference_candidates|voice_email_outbox|app_events)/.test(resource))return reply([]);
 throw Error('Unexpected operation '+resource);
};
try {
 const transcript=[
  ['user','I have a backyard hill that I want waterfalls and a pond on.'],
  ['assistant','What size are you envisioning?'],
  ['user',"So we can't have endless talk."],
  ['user','About this. You have to'],
  ['user','move in for the sell.'],
  ['user','How about'],
  ['user','I get Scott to reach out to you.'],
  ['user',"You can tell people Scott's phone number."],
  ['user','His personal cell phone, you can reach him directly.'],
  ['user','hand, I can personally deliver.'],
  ['user','An email.'],
  ['user',"into Scott's email box that will have you Call him."],
 ];
 for(const [role,message]of transcript){const row={role,message,laAbsoluteTimestamp:10+rows.length*4};rows.push(row);await Capture.processIScottTranscriptRows({sessionId:session,anonymousVisitorId:'local-smoke',rows:[row]});assert.equal(lead?.contact_method??null,null,'no empty card for: '+message);}
 const offer={role:'assistant',message:'How should Scott reach out to you, email or phone?',laAbsoluteTimestamp:95};rows.push(offer);
 await Capture.processIScottTranscriptRows({sessionId:session,anonymousVisitorId:'local-smoke',rows:[offer]});
 const row={role:'user',message:'Email works for me.',laAbsoluteTimestamp:100};rows.push(row);await Capture.processIScottTranscriptRows({sessionId:session,anonymousVisitorId:'local-smoke',rows:[row]});
 assert.equal(lead.contact_method,'email','real choice still opens capture during an operator smoke');
 assert.equal(Notify.notifyCalls.length,0,'coaching and method choice never send mail');
 console.log('September 6 intent, names, needs and readback checks passed; real capture pipeline replay; no external calls.');
}finally{globalThis.fetch=originalFetch;}
