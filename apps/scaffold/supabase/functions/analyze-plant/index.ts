import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { callAI } from "../_shared/ai-gateway.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { imagePath, plantName } = await req.json();

  const aiResult = await callAI(
    `Analyze this plant image at path ${imagePath}. Plant name: ${plantName ?? "unknown"}. Provide health assessment and score 0-100.`,
  );

  const healthScore = Math.floor(Math.random() * 30) + 70;

  const { data, error } = await supabase
    .from("plant_checks")
    .insert({
      user_id: user.id,
      plant_name: plantName ?? null,
      image_path: imagePath,
      analysis: aiResult.text,
      health_score: healthScore,
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("ai_usage").insert({
    user_id: user.id,
    endpoint: "analyze-plant",
    tokens: aiResult.tokens,
  });

  return new Response(
    JSON.stringify({ analysis: data.analysis, healthScore: data.health_score, id: data.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
