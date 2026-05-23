// supabase/functions/auto-release/index.ts
// Edge Function: Auto-release eligible milestones
// Schedule: cron every 5 minutes
//
// Deployment:
//   supabase functions deploy auto-release --schedule "*/5 * * * *"
//
// This function calls the auto_release_milestones() SECURITY DEFINER
// Postgres function using the service_role key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    // Verify this is a cron invocation or authorized request
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Allow: service_role bearer token OR cron secret header
    if (
      authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` &&
      authHeader !== `Bearer ${cronSecret}`
    ) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("auto_release_milestones");

    if (error) {
      console.error("Auto-release error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const releasedCount = data as number;
    console.log(`Auto-release completed: ${releasedCount} milestone(s) released`);

    return new Response(
      JSON.stringify({
        success: true,
        released: releasedCount,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Auto-release unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
