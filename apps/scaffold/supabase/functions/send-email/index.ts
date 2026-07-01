import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { to, template, data } = await req.json().catch(() => ({}));

  // Log-only stub for POC
  console.log("[send-email stub]", { to, template, data });

  return new Response(
    JSON.stringify({ success: true, message: "Email logged (stub mode)" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
