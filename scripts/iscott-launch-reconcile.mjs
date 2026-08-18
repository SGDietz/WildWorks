console.log(JSON.stringify({
  dryRun: true,
  enabled: process.env.ISCOTT_LAUNCH_RECONCILE_ENABLED === "true",
  count: 0,
  note: "Inactive until ISCOTT_LAUNCH_RECONCILE_ENABLED=true. This script never sends email. Classifiers live in src/lib/iscottLaunchReconcile.ts.",
}, null, 2));
