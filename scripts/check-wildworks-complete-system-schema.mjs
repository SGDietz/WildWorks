import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relative) => fs.readFileSync(path.resolve(relative), "utf8");
const migrations = fs.readdirSync(path.resolve("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => read(path.join("supabase/migrations", name)))
  .join("\n");
const leadMigration = read("supabase/migrations/202608100001_iscott_lead_capture.sql");
const visitorMigration = read("supabase/migrations/202608290001_iscott_visitor_confirmation_prep.sql");
const outboxMigration = read("supabase/migrations/202608010002_voice_email_outbox.sql");
const retentionMigration = read("supabase/migrations/202608010004_voice_retention.sql");
const capture = read("src/lib/iscottLeadCapture.ts");
const visitor = read("src/lib/iscottVisitorConfirmation.ts");
const notifications = read("src/lib/voiceEmailNotifications.ts");

for (const table of ["iscott_leads", "iscott_media", "voice_email_outbox", "conversation_messages", "app_events"]) {
  assert.match(migrations, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} is server-only behind RLS`);
}
assert.match(outboxMigration, /unique index[^;]+voice_email_outbox_idempotency_key/is);
assert.match(outboxMigration, /unique index[^;]+voice_email_outbox_provider_message_id/is);
assert.match(retentionMigration, /lease_token|lease_expires_at|next_attempt_at|dead_lettered_at/g);
assert.match(visitorMigration, /iscott_visitor_confirmation/);
assert.match(visitorMigration, /provider_accepted means provider API acceptance, not inbox delivery/i);
assert.match(visitorMigration, /visitor_confirmation_inbox_delivered_at is null or[\s\S]+provider_accepted_at is not null/i);
assert.match(leadMigration, /object_path text not null unique/);
assert.match(leadMigration, /upload_id text not null unique/);
assert.match(capture, /project_details: projectDetails/);
assert.match(capture, /expiresIn:\s*(?:43_200|12\s*\*\s*60\s*\*\s*60)/);
assert.match(visitor, /mediaTypes/);
assert.doesNotMatch(visitor, /leadDashboardUrl|transcriptDashboardUrl|signedUrl/,
  "visitor receipt module cannot expose internal lead, transcript, or storage URLs");
assert.match(notifications, /UPLOADED PHOTOS, VIDEOS, AND FILES/);
assert.doesNotMatch(notifications, /attachments\s*:/,
  "WildWorks owner notifications never attach uploaded customer files");
assert.doesNotMatch(notifications, /<img[^>]+signedUrl/i,
  "WildWorks owner notifications never inline uploaded customer media");

console.log("WildWorks complete-system source/schema alignment checks passed.");
