// A visitor name must be something Scott can actually address. This runs the
// direct parser gate and the production capture/send gate with only local fakes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const out = path.resolve(".next", "iscott-china-followup-test");
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
export let failNext = false; export function failOne() { failNext = true; }
export async function notifyIScottLeadByEmail(args) {
  notifyCalls.push(args);
  if (failNext) { failNext = false; return { queued: false, delivered: false }; }
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
await transpile("src/lib/iscottTrafficResolve.ts", "stub-resolve");
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



const SESSION='china-followup-smoke', VISITOR='human-smoke-visitor';
let lead=null; const history=[];
const response=(body)=>({ok:true,status:200,json:async()=>body,text:async()=>JSON.stringify(body)});
globalThis.fetch=async(target,init={})=>{
 const resource=String(target).split('/rest/v1/')[1]??String(target);
 const method=init.method??'GET';
 if(resource.startsWith('iscott_leads')) {
   if(method==='POST')lead={created_at:new Date().toISOString(),...lead,...JSON.parse(init.body)[0]};
   return response(lead?[structuredClone(lead)]:[]);
 }
 if(resource.startsWith('conversation_messages'))return response(history.map(r=>({role:r.role,message:r.message,la_absolute_timestamp:r.laAbsoluteTimestamp})));
 if(/^(iscott_media|feedback_events|transcript_events|preference_candidates|voice_email_outbox|app_events)/.test(resource))return response([]);
 throw Error('Unexpected network operation '+resource);
};
let timestamp=10;
async function append(turns){
 const rows=turns.map(([role,message])=>({role,message,laAbsoluteTimestamp:timestamp+=5}));
 history.push(...rows);
 await Capture.processIScottTranscriptRows({sessionId:SESSION,anonymousVisitorId:VISITOR,rows});
}
assert.equal(Parsing.extractLocation('Um, okay, so I live in China. Can he travel to China?'),'China');
assert.equal(Parsing.extractLocation('We live in New Zealand.'),'New Zealand');
assert.equal(Parsing.extractLocation('If I say I live in China, what happens?'),null);
assert.equal(Parsing.extractLocation('I live in a house.'),null);
assert.equal(Parsing.extractProjectNeed("Okay, so I'm looking at the site. Um, are you still there?"),null);
assert.equal(Parsing.visitorProjectAreaFromRows(['This patio.','Where is this patio?']),null);
assert.equal(Parsing.visitorProjectAreaFromRows(['I want a patio.']),'patio');
assert.equal(Parsing.visitorProjectAreaFromRows(['The backyard.']),'backyard');
assert.equal(Parsing.visitorProjectAreaFromRows(["I'm looking at the site.",'Patio.']),null);
assert.equal(Parsing.visitorProjectAreaFromRows(["I'm looking at the site.",'Patio.','I want a patio for my house.']),'patio');
assert.equal(Parsing.visitorProjectAreaFromRows(['My backyard needs help.']),'backyard');
assert.equal(Parsing.summariseLeadQualification(['Waterfalls, everything around my house. I have a quarter million dollar budget.']).budget,'250,000 dollars');
assert.match(Parsing.summariseLeadQualification(['I do not have a quarter million dollar budget.']).budget,/not/);
await append([
 ['user','Um, okay, so I live in China. Can he travel to China?'],
 ['assistant','What would you like help with?'],
 ['user','I want beautiful boulders and, well, pool and'],
 ['user','you know, waterfalls, everything around my house. I have a quarter million dollar budget.'],
 ['assistant','When do you want to start?'],
 ['user','As soon as possible.'],
 ['assistant',"What's your name and email address?"],
 ['user','My name is Morgan and my email is visitor@example.com.'],
 ['assistant','Your email is visitor@example.com. Did I hear that exactly right?'],
 ['user',"That's correct."],
 ['assistant','May Scott contact you at that email address about this project?'],
 ['user','Yes.'],
]);
assert.equal(lead.status,'submitted');assert.equal(lead.location,'China');assert.equal(Notify.notifyCalls.length,1);
assert.doesNotMatch(lead.project_need,/well|you know/i);
assert.match(lead.metadata.last_sent_project_facts.join(' '),/250,000 dollars/);
const primary=lead.project_need;
await append([['assistant','Is there anything else?'],['user','No.'],['user',"Okay, so I'm looking at the site. Um, are you still there?"],['user','This patio.'],['user','Where is this patio?']]);
assert.equal(lead.metadata.project_area,null);assert.doesNotMatch(lead.metadata.project_details.join(' '),/at the site/i);assert.equal(Notify.notifyCalls.length,1);
Notify.failOne();
await append([['user',"And this ruins project, I'd love to have ruins. Like, I want"],['user','So I want an outdoor kitchen.']]);
assert.equal(lead.project_need,primary,'additional features do not need to replace the primary project');
assert.equal(Notify.notifyCalls.length,2);
const update=Notify.notifyCalls.at(-1);
assert.match(update.followUp.addedFacts.join(' '),/ruins/i);assert.match(update.followUp.addedFacts.join(' '),/outdoor kitchen/i);
assert.doesNotMatch(lead.metadata.last_sent_project_facts.join(' '),/outdoor kitchen/i,'unsuccessful enqueue must not advance the sent snapshot');
await append([['user','Thank you.']]);
assert.equal(Notify.notifyCalls.length,3);assert.equal(Notify.notifyCalls.at(-1).eventId,update.eventId,'retry keeps the durable idempotency key');
await append([['user','Okay.']]);assert.equal(Notify.notifyCalls.length,3,'unchanged transcript does not send again');
await append([['user','I want an outdoor kitchen with a wood fired pizza oven.']]);
assert.equal(Notify.notifyCalls.length,4);assert.notEqual(Notify.notifyCalls.at(-1).eventId,update.eventId,'common-prefix additions get distinct complete-fact hashes');
lead.traffic_class='test';
await append([['user','I want an outdoor shower.']]);assert.equal(Notify.notifyCalls.length,4,'held automated test cannot trigger followups');
console.log('China smoke replay passed: location, qualification, clean project, browsing exclusion, ruins/kitchen additions, failed enqueue retry, no duplicates, full hash and traffic guard. No external calls.');
