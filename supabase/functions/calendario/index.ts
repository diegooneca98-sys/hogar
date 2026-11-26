// Lee los calendarios de iCloud (enlaces .ics guardados en public.calendarios) y
// devuelve sus eventos entre dos fechas. Solo para miembros (RLS de calendarios).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { expandir } from "./ics.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  let body: { desde?: string; hasta?: string } = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }
  const desde = new Date(body.desde ?? Date.now());
  const hasta = new Date(body.hasta ?? Date.now() + 28 * 864e5);
  if (isNaN(+desde) || isNaN(+hasta) || hasta.getTime() - desde.getTime() > 120 * 864e5) return json({ error: "rango no válido" }, 400);

  const { data: cals, error } = await sb.from("calendarios").select("id,persona,nombre,url").eq("activo", true);
  if (error) return json({ error: error.message }, 403);

  const eventos: unknown[] = [], fallos: unknown[] = [];
  await Promise.all((cals ?? []).map(async (c) => {
    try {
      const url = c.url.trim().replace(/^webcals?:\/\//i, "https://");
      const r = await fetch(url, { headers: { "User-Agent": "Hogar/1.0" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      for (const e of expandir(await r.text(), desde, hasta)) eventos.push({ ...e, persona: c.persona, calendario: c.nombre, origen: "icloud" });
    } catch (e) {
      fallos.push({ id: c.id, nombre: c.nombre, error: String((e as Error).message ?? e) });
    }
  }));
  return json({ eventos, fallos });
});
