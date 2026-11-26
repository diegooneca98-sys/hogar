// Expande un .ics (incluye repeticiones y excepciones) a eventos entre dos fechas.
import ICAL from "npm:ical.js@2.1.0";

export function expandir(texto, desde, hasta, max = 500) {
  const comp = new ICAL.Component(ICAL.parse(texto));
  for (const tz of comp.getAllSubcomponents("vtimezone")) {
    try { ICAL.TimezoneService.register(tz); } catch { /* ya registrada */ }
  }
  const vevs = comp.getAllSubcomponents("vevent");
  const excepciones = new Map();
  const principales = [];
  for (const v of vevs) {
    if (v.hasProperty("recurrence-id")) {
      const uid = v.getFirstPropertyValue("uid");
      (excepciones.get(uid) || excepciones.set(uid, []).get(uid)).push(v);
    } else principales.push(v);
  }
  const d0 = desde.getTime(), d1 = hasta.getTime(), res = [];
  const meter = (inicio, fin, titulo, todoDia, lugar) => {
    const a = inicio.toJSDate().getTime(), b = fin ? fin.toJSDate().getTime() : a;
    if (b > d0 && a < d1 || (a >= d0 && a < d1)) res.push({ titulo, inicio: new Date(a).toISOString(), fin: new Date(b).toISOString(), todo_dia: todoDia, lugar: lugar || null, dia: todoDia ? inicio.toString().slice(0, 10) : null });
  };
  for (const v of principales) {
    const ev = new ICAL.Event(v);
    if (String(v.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") continue;
    for (const x of excepciones.get(ev.uid) || []) ev.relateException(x);
    const titulo = ev.summary || "(sin título)";
    if (!ev.isRecurring()) {
      meter(ev.startDate, ev.endDate, titulo, ev.startDate.isDate, ev.location);
      continue;
    }
    const it = ev.iterator();
    let n = 0, t;
    while ((t = it.next()) && n++ < 20000) {
      const ms = t.toJSDate().getTime();
      if (ms >= d1) break;
      const o = ev.getOccurrenceDetails(t);
      if (String(o.item.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") continue;
      if (o.endDate.toJSDate().getTime() <= d0) continue;
      meter(o.startDate, o.endDate, o.item.summary || titulo, o.startDate.isDate, o.item.location);
      if (res.length >= max) break;
    }
  }
  return res;
}
