import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { elementId, properties } = await req.json();

    console.log("Received properties update:", { elementId, properties });

    // In a real implementation, this would:
    // 1. Parse the element location in the code
    // 2. Update the actual file with new properties
    // 3. Trigger a hot reload
    
    // For now, we just log and return success
    const updatedProperties = {
      elementId,
      ...properties,
      updatedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ 
        success: true,
        properties: updatedProperties 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Properties error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
