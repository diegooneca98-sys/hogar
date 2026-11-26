const cfg = window.HOGAR;
const sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = n => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

const CATEGORIAS = {
  comun: ["Hipoteca", "Gastos comunes", "Compra", "Aparatos", "Muebles", "Otros", "Coche"],
  diego: ["Casa", "Deporte", "Bares-Restaurantes", "Ocio", "Salud", "Ropa", "Otros", "Inversiones"],
  leire: ["Casa", "Otros"]
};
const TURNOS = { M: "Mañana", T: "Tarde", N: "Noche", L: "Libre" };
let yo = null, vista = "inicio", relojTimer = null, canales = [];

/* ---------- sesión ---------- */
async function arrancar() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const { data: { session } } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((_e, s) => { if (!s) mostrarLogin(); });
  session ? entrar(session) : mostrarLogin();
}
function mostrarLogin() { $("#principal").classList.add("oculto"); $("#login").classList.remove("oculto"); }
async function entrar(session) {
  const email = session.user.email.toLowerCase();
  const { data } = await sb.from("miembros").select("*");
  yo = (data || []).find(m => m.email.toLowerCase() === email);
  if (!yo) { $("#login-msg").textContent = "Esta cuenta no tiene acceso a Hogar."; await sb.auth.signOut(); return; }
  yo.clave = yo.nombre.toLowerCase();
  $("#login").classList.add("oculto"); $("#principal").classList.remove("oculto");
  ir(vista);
}
$("#form-login").addEventListener("submit", async e => {
  e.preventDefault(); $("#login-msg").textContent = "Entrando...";
  const { data, error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#pass").value });
  if (error) { $("#login-msg").textContent = "No se pudo entrar: revisa correo y contraseña."; return; }
  entrar(data.session);
});
$("#btn-registro").addEventListener("click", async () => {
  const email = $("#email").value.trim(), password = $("#pass").value;
  if (!email || password.length < 6) { $("#login-msg").textContent = "Pon tu correo y una contraseña de al menos 6 caracteres."; return; }
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href } });
  if (error) { $("#login-msg").textContent = "Error: " + error.message; return; }
  if (data.session) entrar(data.session);
  else $("#login-msg").textContent = "Cuenta creada. Revisa tu correo y pulsa el enlace para confirmarla; luego entra aquí.";
});

/* ---------- navegación ---------- */
document.querySelectorAll("#menu button").forEach(b => b.addEventListener("click", () => ir(b.dataset.v)));
function ir(v) {
  vista = v;
  document.querySelectorAll("#menu button").forEach(b => b.classList.toggle("activo", b.dataset.v === v));
  clearInterval(relojTimer); canales.forEach(c => sb.removeChannel(c)); canales = [];
  ({ inicio: verInicio, compra: verCompra, tareas: verTareas, gastos: verGastos, mas: verMas })[v]();
}

/* ---------- inicio (dashboard) ---------- */
async function verInicio() {
  $("#contenido").innerHTML = `
  <div class="dash">
    <div>
      <div class="tarjeta"><div class="reloj" id="reloj"></div><div class="fecha" id="fecha"></div>
        <div class="tiempo" id="tiempo"><span class="vacio">Cargando el tiempo...</span></div></div>
      <div class="tarjeta"><h2>Hoy</h2><div id="hoy"><span class="vacio">Cargando...</span></div></div>
      <div class="tarjeta"><h2>Próximos 7 días</h2><div id="semana"><span class="vacio">Cargando...</span></div></div>
      <div class="tarjeta"><h2>Más adelante · 3 semanas</h2><div id="luego"><span class="vacio">Cargando...</span></div></div>
    </div>
    <div>
      <div class="tarjeta"><h2>Entrenos de Diego · 7 días</h2><div id="entreno"><span class="vacio">Cargando...</span></div></div>
      <div class="tarjeta"><h2>Próximos recibos</h2><div id="recibos"></div></div>
    </div>
  </div>`;
  const tic = () => {
    const d = new Date();
    $("#reloj").textContent = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    $("#fecha").textContent = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  };
  tic(); relojTimer = setInterval(tic, 10000);
  cargarTiempo(); cargarHoy(); cargarEntreno(); cargarRecibos();
}
const ICONOS = { 0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌦️", 61: "🌧️", 63: "🌧️", 65: "🌧️", 71: "🌨️", 73: "🌨️", 75: "❄️", 80: "🌦️", 81: "🌧️", 82: "⛈️", 95: "⛈️" };
async function cargarTiempo() {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FMadrid&forecast_days=1`;
    const r = await (await fetch(u)).json();
    $("#tiempo").innerHTML = `<span style="font-size:40px">${ICONOS[r.current.weather_code] || "🌡️"}</span><b>${Math.round(r.current.temperature_2m)}°</b>
      <span class="vacio">máx ${Math.round(r.daily.temperature_2m_max[0])}° · mín ${Math.round(r.daily.temperature_2m_min[0])}° · lluvia ${r.daily.precipitation_probability_max[0] ?? 0}%</span>`;
  } catch { $("#tiempo").innerHTML = `<span class="vacio">Sin datos del tiempo</span>`; }
}
const COLOR_P = { diego: "var(--diego)", leire: "var(--leire)", comun: "var(--comun)" };
const NOMBRE_P = { diego: "Diego", leire: "Leire", comun: "Los dos" };
const horaDe = t => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const diaDe = e => e.todo_dia && e.dia ? new Date(e.dia + "T12:00:00") : new Date(e.inicio);
const filaEvento = (e, conDia) => {
  const dia = conDia ? diaDe(e).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", ...(conDia === "mes" ? { month: "short" } : {}), timeZone: "Europe/Madrid" }) + " · " : "";
  return `<div class="fila"><span class="punto" style="background:${COLOR_P[e.persona] || "var(--comun)"}"></span>
  <span class="txt">${esc(NOMBRE_P[e.persona] || "")}: ${esc(e.titulo)}</span><span class="etq">${dia}${e.todo_dia ? "todo el día" : horaDe(e.inicio)}</span></div>`;
};
// Eventos de iCloud (función «calendario») para los próximos 29 días; se piden una vez por carga del inicio.
let calCache = null;
async function eventosCalendario(desde, hasta) {
  if (!calCache || calCache.t < Date.now() - 5 * 60e3) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const d29 = new Date(d0); d29.setDate(d29.getDate() + 29);
    calCache = { t: Date.now(), p: sb.functions.invoke("calendario", { body: { desde: d0.toISOString(), hasta: d29.toISOString() } })
      .then(({ data, error }) => error ? { eventos: [], fallos: [{ nombre: "calendarios", error: error.message }] } : data)
      .catch(e => ({ eventos: [], fallos: [{ nombre: "calendarios", error: String(e) }] })) };
  }
  const r = await calCache.p;
  // Un evento de varios días que ya empezó cuenta desde el primer día del rango.
  return (r.eventos || []).filter(e => new Date(e.fin) > desde && new Date(e.inicio) < hasta)
    .map(e => new Date(e.inicio) < desde ? { ...e, sigue: true } : e);
}
async function eventosEntre(desde, hasta) {
  const [{ data }, cal] = await Promise.all([
    sb.from("eventos").select("*").gte("inicio", desde.toISOString()).lt("inicio", hasta.toISOString()).order("inicio"),
    eventosCalendario(desde, hasta)]);
  const orden = e => e.sigue ? desde.getTime() : (e.todo_dia && e.dia ? new Date(e.dia + "T00:00:00").getTime() : new Date(e.inicio).getTime());
  return [...(data || []), ...cal].sort((a, b) => orden(a) - orden(b) || (b.todo_dia ? 1 : 0) - (a.todo_dia ? 1 : 0));
}
async function cargarHoy() {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const d8 = new Date(d0); d8.setDate(d8.getDate() + 8);
  const d29 = new Date(d0); d29.setDate(d29.getDate() + 29);
  const [evHoy, evSemana, evLuego] = await Promise.all([eventosEntre(d0, d1), eventosEntre(d1, d8).then(l => l.filter(e => !e.sigue)), eventosEntre(d8, d29).then(l => l.filter(e => !e.sigue))]);
  $("#semana").innerHTML = evSemana.length ? evSemana.map(e => filaEvento(e, true)).join("") : `<span class="vacio">Nada apuntado en los próximos 7 días.</span>`;
  const { fallos = [] } = await calCache.p;
  const aviso = fallos.length ? `<p class="vacio">⚠️ No se pudo leer: ${fallos.map(f => esc(f.nombre || "calendario")).join(", ")}</p>` : "";
  const { count: nCal } = await sb.from("calendarios").select("*", { count: "exact", head: true }).eq("activo", true);
  $("#luego").innerHTML = (evLuego.length ? evLuego.map(e => filaEvento(e, "mes")).join("")
    : `<span class="vacio">${nCal ? "Nada apuntado más adelante." : "Aún no hay calendarios de iCloud vinculados. Añádelos en ⋯ Más › Calendarios."}</span>`) + aviso;
  const { data: turno } = await sb.rpc("turno_del_dia", { dia: hoyISO() });
  const { count: compra } = await sb.from("compra").select("*", { count: "exact", head: true }).eq("hecho", false);
  const hoy = hoyISO();
  const { count: tareas } = await sb.from("tareas").select("*", { count: "exact", head: true }).eq("hecho", false).or(`fecha.is.null,fecha.lte.${hoy}`);
  const { data: tHoy } = await sb.from("tareas").select("texto,fecha").eq("hecho", false).lte("fecha", hoy).order("fecha");
  $("#hoy").innerHTML = `
    <div class="fila"><span class="punto" style="background:var(--diego)"></span><span class="txt">Diego: turno</span><span class="etq">${esc(TURNOS[turno] || "—")}</span></div>
    ${evHoy.map(e => filaEvento(e)).join("")}
    ${(tHoy || []).map(t => `<div class="fila"><span class="txt">📌 ${esc(t.texto)}</span><span class="etq">${t.fecha === hoy ? "hoy" : "atrasada"}</span></div>`).join("")}
    <div class="fila"><span class="txt">🛒 Por comprar</span><span class="etq">${compra ?? 0}</span></div>
    <div class="fila"><span class="txt">✅ Tareas pendientes</span><span class="etq">${tareas ?? 0}</span></div>`;
}
const isoMas = n => { const d = new Date(); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
async function cargarEntreno() {
  const dias = [0, 1, 2, 3, 4, 5, 6].map(isoMas);
  const res = await Promise.all(dias.map(dia => sb.rpc("entreno_del_dia", { dia })));
  const filas = dias.map((dia, i) => ({ dia, i, e: res[i].error ? null : res[i].data })).filter(x => x.e);
  if (!filas.length) { $("#entreno").innerHTML = `<span class="vacio">No hay entrenos programados en los próximos 7 días.</span>`; return; }
  const nombreDia = (dia, i) => i === 0 ? "hoy" : i === 1 ? "mañana" : new Date(dia + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
  $("#entreno").innerHTML = filas.map(({ dia, i, e }) => `<div class="fila" style="cursor:pointer" data-ent="${i}"><span class="txt">${i === 0 ? `<b>${esc(e.titulo)}</b>` : esc(e.titulo)}</span><span class="etq">${nombreDia(dia, i)}</span></div>
    <div class="entreno-detalle" id="ent-d${i}">${esc(e.detalle)}</div>`).join("");
  $("#entreno").querySelectorAll("[data-ent]").forEach(f => f.onclick = () => $("#ent-d" + f.dataset.ent).classList.toggle("abierto"));
}
function proximosRecibos(recibos, dias = 10) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0); const res = [];
  for (let i = 0; i <= dias; i++) {
    const d = new Date(hoy); d.setDate(d.getDate() + i);
    recibos.filter(r => r.activo && r.meses.includes(d.getMonth() + 1) && r.dia === d.getDate()).forEach(r => res.push({ ...r, cuando: d, en: i }));
  }
  return res;
}
async function cargarRecibos() {
  const { data } = await sb.from("recibos").select("*");
  const prox = proximosRecibos(data || []);
  $("#recibos").innerHTML = prox.length ? prox.map(r => `<div class="fila"><span class="txt">${esc(r.nombre)}<br><small class="vacio">${r.en === 0 ? "hoy" : r.en === 1 ? "mañana" : r.cuando.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}</small></span><span class="importe">${r.importe_aprox ? "~" + eur(r.importe_aprox) : ""}</span></div>`).join("")
    : `<span class="vacio">Ningún recibo en los próximos 10 días.</span>`;
}

/* ---------- lista genérica (compra / tareas) ---------- */
async function verLista(tabla, titulo, placeholder) {
  $("#contenido").innerHTML = `<div class="tarjeta"><h2>${titulo}</h2>
    <div class="add" id="f-add"><textarea id="nuevo" rows="1" placeholder="${placeholder}"
      autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" enterkeyhint="done"
      data-1p-ignore data-lpignore="true" data-form-type="other"></textarea><button type="button" id="b-add">Añadir</button></div>
    ${tabla === "tareas" ? `<div class="fecha-bar"><label class="mini">📅 Para el día <input type="date" id="f-fecha" min="${hoyISO()}"></label>
      <button type="button" class="mini" id="b-rep">🔁 <span id="rep-txt">No se repite</span></button>
      <span class="sug-tit">opcional: no saldrá en la lista hasta ese día</span></div>${HTML_REP}` : ""}
    <div id="sugerencias" class="sug-lista"></div>
    ${tabla === "compra" ? `<div class="ticket-bar"><label class="mini">📷 Añadir ticket<input type="file" id="f-ticket" accept="image/*" hidden></label>
      <span id="ticket-msg" class="sug-tit"></span></div><div id="tickets"></div>` : ""}</div>
    <div class="tarjeta ${tabla === "compra" ? "compacta" : ""}" id="lista"></div>`;
  const pintar = async () => {
    const { data } = await sb.from(tabla).select("*").order("hecho").order("creado", { ascending: false });
    const hoy = hoyISO();
    const pendTodas = (data || []).filter(x => !x.hecho);
    const prog = pendTodas.filter(x => x.fecha && x.fecha > hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pend = pendTodas.filter(x => !prog.includes(x));
    const vistos = new Set(pend.map(x => sinTildes(x.texto)));
    const hechos = (data || []).filter(x => x.hecho && !vistos.has(sinTildes(x.texto)) && vistos.add(sinTildes(x.texto))).slice(0, 15);
    const fila = x => `
      <div class="fila ${x.hecho ? "tachado" : ""}" data-id="${x.id}">
        <button class="check ${x.hecho ? "hecho" : ""}" data-acc="toggle"></button>
        <span class="txt">${esc(x.texto)}${x.coste ? ` <span class="etq">${eur(x.coste)}</span>` : ""}${x.fecha && !x.hecho ? ` <span class="etq">${fechaCorta(x.fecha)}</span>` : ""}${x.repetir && !x.hecho ? ` <span class="etq">🔁 ${esc(descRep(x.repetir))}</span>` : ""}</span>
        ${tabla === "tareas" && !x.hecho ? `<button type="button" class="rep-btn ${x.repetir ? "activo" : ""}" data-acc="rep" title="Repetir" aria-label="Repetir">🔁</button>` : ""}
        ${tabla === "tareas" && !x.hecho ? `<label class="cat-btn" title="Cambiar fecha">📅<input type="date" class="cambiar-fecha" value="${x.fecha || ""}" aria-label="Cambiar fecha"></label>` : ""}
        ${tabla === "compra" ? `<label class="cat-btn" title="Cambiar categoría">🏷️<select class="cambiar-cat" data-acc="cat" aria-label="Cambiar categoría">${CATS_COMPRA.map(([id, n]) =>
          `<option value="${id}" ${id === catDe(x) ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}
        <button class="borrar" data-acc="borrar">×</button></div>`;
    let html = pend.length ? "" : `<p class="vacio">Nada pendiente 🎉</p>`;
    if (tabla === "compra") {
      for (const [id, nombre] of CATS_COMPRA) {
        const g = pend.filter(x => catDe(x) === id);
        if (g.length) html += `<h3 class="cat">${nombre}</h3>` + g.map(fila).join("");
      }
    } else html += pend.map(fila).join("");
    if (prog.length) html += `<h3 class="cat">Programadas</h3>` + prog.map(fila).join("");
    if (hechos.length) html += `<h3 class="cat">${tabla === "compra" ? "Ya cogido" : "Hechas"}</h3>` + hechos.map(fila).join("");
    $("#lista").innerHTML = html;
    pendientes = pendTodas;
    porId = new Map((data || []).map(x => [String(x.id), x]));
  };
  let sugs = null, pendientes = [], aprendidas = {}, porId = new Map(), repNuevo = null;
  const catDe = x => x.categoria || categoriaDe(x.texto, aprendidas);
  if (tabla === "compra") sb.from("compra_categorias").select("*").then(({ data }) => {
    (data || []).forEach(r => aprendidas[r.nombre] = r.categoria); pintar(); });
  const sinTildes = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const mayus = t => t.charAt(0).toLocaleUpperCase("es-ES") + t.slice(1);
  const cargarSugs = async () => {
    if (sugs) return sugs;
    const peticiones = [sb.from(tabla).select("texto").order("creado", { ascending: false }).limit(300)];
    if (tabla === "compra") peticiones.push(sb.rpc("sugerencias_compra"));
    const [{ data: c }, r2] = await Promise.all(peticiones);
    const peso = new Map();
    const sumar = (n, v) => { if (!n) return; const k = sinTildes(n.trim()); const x = peso.get(k);
      peso.set(k, { nombre: x ? x.nombre : mayus(n.trim()), v: (x ? x.v : 0) + v }); };
    (c || []).forEach(x => sumar(x.texto, 3));
    (r2?.data || []).forEach(x => sumar(x.nombre, 1 + x.veces));
    if (tabla === "compra") {
      const { data: f } = await sb.rpc("fotos_alimentos");
      (f || []).forEach(x => { const e = peso.get(sinTildes(x.nombre.trim())); if (e) e.foto = x.foto; });
    }
    sugs = [...peso.values()].sort((a, b) => b.v - a.v);
    return sugs;
  };
  const anadir = async t => {
    t = mayus((t || "").trim()); if (!t) return;
    $("#nuevo").value = ""; $("#sugerencias").innerHTML = "";
    const k = sinTildes(t);
    if (!pendientes.some(x => sinTildes(x.texto) === k)) {
      const { data: prev } = await sb.from(tabla).select("id,texto").eq("hecho", true).order("creado", { ascending: false }).limit(500);
      const viejo = (prev || []).find(x => sinTildes(x.texto) === k);
      let fecha = tabla === "tareas" ? ($("#f-fecha").value || null) : undefined, repetir = null;
      if (tabla === "tareas" && repNuevo) {
        fecha = primeraFecha(repNuevo, fecha || hoyISO());
        repetir = { ...repNuevo, desde: fecha };
      }
      const extra = tabla === "tareas" ? { fecha, repetir } : {};
      if (viejo) await sb.from(tabla).update({ hecho: false, hecho_en: null, coste: null, ...extra }).eq("id", viejo.id);
      else await sb.from(tabla).insert(tabla === "compra" ? { texto: t, categoria: categoriaDe(t, aprendidas) } : { texto: t, ...extra });
    }
    if (tabla === "tareas") { $("#f-fecha").value = ""; repNuevo = null; $("#rep-txt").textContent = "No se repite"; }
    sugs = null; pintar(); $("#nuevo").focus();
  };
  $("#nuevo").oninput = async () => {
    const q = sinTildes($("#nuevo").value.trim());
    if (!q) { $("#sugerencias").innerHTML = ""; return; }
    const ya = new Set(pendientes.map(x => sinTildes(x.texto)));
    const lista = (await cargarSugs()).filter(x => !ya.has(sinTildes(x.nombre)));
    const k = x => sinTildes(x.nombre);
    const empieza = lista.filter(x => k(x).startsWith(q) || k(x).split(" ").some(w => w.startsWith(q)));
    const contiene = q.length < 2 ? [] : lista.filter(x => !empieza.includes(x) && k(x).includes(q));
    const res = [...empieza, ...contiene].slice(0, 6);
    $("#sugerencias").innerHTML = res.map(x => `<button type="button" class="sug" data-n="${esc(x.nombre)}">
      ${x.foto ? `<img class="mini-foto" data-foto="${esc(x.foto)}" alt="">` : `<span class="mini-foto"></span>`}<span>${esc(x.nombre)}</span></button>`).join("");
    document.querySelectorAll("#sugerencias img[data-foto]").forEach(async img => { const u = await miniatura(img.dataset.foto); if (u) img.src = u; });
  };
  $("#nuevo").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); anadir($("#nuevo").value); } };
  $("#b-add").onclick = () => anadir($("#nuevo").value);
  $("#sugerencias").onclick = e => { const b = e.target.closest(".sug"); if (b) anadir(b.dataset.n); };
  $("#lista").onchange = async e => {
    const fi = e.target.closest("input.cambiar-fecha");
    if (fi) { await sb.from("tareas").update({ fecha: fi.value || null }).eq("id", fi.closest(".fila").dataset.id); pintar(); return; }
    const s = e.target.closest("select.cambiar-cat"); if (!s) return;
    const f = s.closest(".fila"), texto = f.querySelector(".txt").childNodes[0].textContent.trim();
    aprendidas[sinTildes(texto)] = s.value;
    await sb.from("compra").update({ categoria: s.value }).eq("id", f.dataset.id);
    await sb.from("compra_categorias").upsert({ nombre: sinTildes(texto), categoria: s.value, actualizado: new Date().toISOString() });
    pintar();
  };
  $("#lista").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    const id = b.closest(".fila").dataset.id, x = porId.get(id);
    if (b.dataset.acc === "borrar") await sb.from(tabla).delete().eq("id", id);
    else if (b.dataset.acc === "rep") {
      const r = await abrirRep(x?.repetir, x?.fecha); if (r === undefined) return;
      if (!r) await sb.from("tareas").update({ repetir: null }).eq("id", id);
      else { const fecha = primeraFecha(r, x?.fecha || hoyISO()); await sb.from("tareas").update({ repetir: { ...r, desde: fecha }, fecha }).eq("id", id); }
    } else {
      const hecho = !b.classList.contains("hecho");
      if (hecho && x?.repetir) {
        const sig = siguienteTrasHoy(x.repetir, x.fecha);
        await sb.from(tabla).update({ fecha: sig, hecho_en: new Date().toISOString() }).eq("id", id);
        aviso(`Hecha ✓ La próxima vez: ${fechaCorta(sig)}`);
      } else await sb.from(tabla).update({ hecho, hecho_en: hecho ? new Date().toISOString() : null }).eq("id", id);
    }
    pintar();
  };
  if (tabla === "compra") { pintarTickets(); $("#f-ticket").onchange = subirTicket; }
  if (tabla === "tareas") $("#b-rep").onclick = async () => {
    const r = await abrirRep(repNuevo, $("#f-fecha").value || null); if (r === undefined) return;
    repNuevo = r; $("#rep-txt").textContent = r ? descRep(r) : "No se repite";
  };
  const ch = sb.channel("rt-" + tabla).on("postgres_changes", { event: "*", schema: "public", table: tabla }, pintar).subscribe();
  canales.push(ch); pintar();
}
/* miniaturas de las fotos de alimentos: se piden una vez y se guardan pequeñas en el móvil */
const minis = {};
async function miniatura(id) {
  if (minis[id]) return minis[id];
  try { const g = localStorage.getItem("mini:" + id); if (g) return (minis[id] = g); } catch {}
  minis[id] = (async () => {
    const { data } = await sb.rpc("foto_alimento", { id });
    const f = data?.[0]; if (!f?.base64) return null;
    const img = new Image(); img.src = `data:${f.tipo || "image/jpeg"};base64,${f.base64}`;
    await img.decode();
    const c = document.createElement("canvas"), t = 96, k = Math.max(t / img.width, t / img.height);
    c.width = c.height = t;
    c.getContext("2d").drawImage(img, (t - img.width * k) / 2, (t - img.height * k) / 2, img.width * k, img.height * k);
    const u = c.toDataURL("image/jpeg", 0.7);
    try { localStorage.setItem("mini:" + id, u); } catch {}
    return (minis[id] = u);
  })().catch(() => null);
  return minis[id];
}
async function subirTicket(e) {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const msg = $("#ticket-msg");
  const t = prompt("Total del ticket en € (opcional, se apunta en gastos comunes > Compra)");
  const total = parseFloat(String(t || "").replace(",", ".")) || null;
  const tienda = total ? (prompt("¿Tienda? (opcional)", "") || "").trim() || null : null;
  msg.textContent = "Subiendo…";
  const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `${hoyISO().slice(0, 7)}/${Date.now()}.${ext}`;
  const up = await sb.storage.from("tickets").upload(ruta, f, { contentType: f.type || "image/jpeg" });
  if (up.error) { msg.textContent = "No se pudo subir: " + up.error.message; return; }
  let gasto_id = null;
  if (total) {
    const { data } = await sb.from("gastos").insert({ cuenta: "comun", categoria: "Compra", concepto: "Ticket" + (tienda ? " " + tienda : ""), importe: total }).select("id").single();
    gasto_id = data?.id || null;
  }
  await sb.from("tickets").insert({ ruta, total, tienda, gasto_id });
  msg.textContent = "Ticket guardado ✓"; pintarTickets();
}
async function pintarTickets() {
  const { data } = await sb.from("tickets").select("*").order("creado", { ascending: false }).limit(5);
  if (!data?.length) { $("#tickets").innerHTML = ""; return; }
  const { data: urls } = await sb.storage.from("tickets").createSignedUrls(data.map(x => x.ruta), 3600);
  $("#tickets").innerHTML = `<p class="sug-tit">Últimos tickets</p>` + data.map((x, i) => `
    <a class="fila ticket" href="${urls?.[i]?.signedUrl || "#"}" target="_blank" rel="noopener">
      <span class="txt">${new Date(x.creado).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}${x.tienda ? " · " + esc(x.tienda) : ""}</span>
      ${x.total ? `<span class="etq">${eur(x.total)}</span>` : ""}</a>`).join("");
}
const fechaCorta = f => {
  const d = new Date(f + "T12:00:00"), hoy = hoyISO();
  if (f === hoy) return "hoy";
  if (f < hoy) return "atrasada · " + d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
};
/* ---------- tareas que se repiten ----------
   repetir = { u: "dia"|"semana"|"mes", n: cada cuántos, dias: [0-6] (0 = domingo, solo semana), dia: día del mes (solo mes), desde: fecha ancla } */
const DIAS_SEM = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const ORDEN_SEM = [1, 2, 3, 4, 5, 6, 0];
const aFecha = s => new Date(s + "T00:00:00Z");
const aISO = d => d.toISOString().slice(0, 10);
const sumarDias = (s, n) => { const d = aFecha(s); d.setUTCDate(d.getUTCDate() + n); return aISO(d); };
const semanaN = s => Math.floor((aFecha(s).getTime() / 864e5 + 3) / 7); // semanas de lunes a domingo
const diaMes = (y, m, dia) => aISO(new Date(Date.UTC(y, m, Math.min(dia, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()))));
function descRep(r) {
  const n = r.n || 1;
  if (r.u === "dia") return n === 1 ? "cada día" : `cada ${n} días`;
  if (r.u === "mes") return n === 1 ? `el día ${r.dia} de cada mes` : `el día ${r.dia} cada ${n} meses`;
  const ds = ORDEN_SEM.filter(d => (r.dias || []).includes(d)).map(d => DIAS_SEM[d]);
  const lista = ds.length > 1 ? ds.slice(0, -1).join(", ") + " y " + ds.at(-1) : ds[0] || "";
  if (n === 1) return ds.length === 7 ? "cada día" : `cada ${lista}`;
  return `cada ${n} semanas: ${lista}`;
}
function primeraFecha(r, desde) { // primera fecha >= desde que encaja
  if (r.u === "dia") return desde;
  if (r.u === "mes") {
    const d = aFecha(desde), f = diaMes(d.getUTCFullYear(), d.getUTCMonth(), r.dia);
    return f >= desde ? f : diaMes(d.getUTCFullYear(), d.getUTCMonth() + 1, r.dia);
  }
  for (let i = 0, f = desde; i < 7; i++, f = sumarDias(f, 1)) if (r.dias.includes(aFecha(f).getUTCDay())) return f;
  return desde;
}
function siguiente(r, f) { // siguiente fecha estrictamente después de f
  const n = r.n || 1;
  if (r.u === "dia") return sumarDias(f, n);
  if (r.u === "mes") { const d = aFecha(f); return diaMes(d.getUTCFullYear(), d.getUTCMonth() + n, r.dia); }
  const ancla = semanaN(r.desde || f);
  for (let i = 1, g = sumarDias(f, 1); i <= 7 * n + 7; i++, g = sumarDias(g, 1))
    if (r.dias.includes(aFecha(g).getUTCDay()) && (semanaN(g) - ancla) % n === 0) return g;
  return sumarDias(f, 7 * n);
}
function siguienteTrasHoy(r, f) { // al completar: la próxima que toque después de hoy
  const hoy = hoyISO(); let g = siguiente(r, f || hoy);
  for (let i = 0; g <= hoy && i < 1000; i++) g = siguiente(r, g);
  return g;
}
const HTML_REP = `<dialog id="dlg-rep" class="dlg"><h3>🔁 Repetir</h3>
  <select id="r-u" aria-label="Cómo se repite"><option value="">No se repite</option><option value="dia">Cada X días</option>
    <option value="semana">Ciertos días de la semana</option><option value="mes">Un día del mes</option></select>
  <div id="r-cada" class="r-linea">Cada <input type="number" id="r-n" min="1" max="99" value="1" inputmode="numeric" autocomplete="off"> <span id="r-uni">días</span></div>
  <div id="r-sem" class="r-dias">${ORDEN_SEM.map(d => `<button type="button" data-d="${d}">${"DLMXJVS"[d]}</button>`).join("")}</div>
  <div id="r-mes" class="r-linea">El día <input type="number" id="r-dia" min="1" max="31" value="1" inputmode="numeric" autocomplete="off"> del mes</div>
  <p id="r-desc" class="r-desc"></p>
  <div class="grid2"><button type="button" class="secundario" id="r-cancel">Cancelar</button><button type="button" id="r-ok">Listo</button></div></dialog>`;
function abrirRep(actual, fechaBase) { // devuelve la regla, null (no se repite) o undefined (cancelado)
  const dlg = $("#dlg-rep"), base = aFecha(fechaBase || hoyISO());
  let dias = actual?.dias?.slice() || [base.getUTCDay()];
  $("#r-u").value = actual?.u || "semana";
  $("#r-n").value = actual?.n || 1;
  $("#r-dia").value = actual?.dia || base.getUTCDate();
  const leer = () => {
    const u = $("#r-u").value; if (!u) return null;
    const n = Math.max(1, Math.min(99, parseInt($("#r-n").value) || 1));
    if (u === "dia") return { u, n };
    if (u === "mes") return { u, n, dia: Math.max(1, Math.min(31, parseInt($("#r-dia").value) || 1)) };
    return { u, n, dias: dias.slice() };
  };
  const pintarR = () => {
    const u = $("#r-u").value, n = parseInt($("#r-n").value) || 1;
    $("#r-cada").classList.toggle("oculto", !u);
    $("#r-sem").classList.toggle("oculto", u !== "semana");
    $("#r-mes").classList.toggle("oculto", u !== "mes");
    $("#r-uni").textContent = { dia: n === 1 ? "día" : "días", semana: n === 1 ? "semana" : "semanas", mes: n === 1 ? "mes" : "meses" }[u] || "";
    document.querySelectorAll("#r-sem button").forEach(b => b.classList.toggle("activo", dias.includes(+b.dataset.d)));
    const r = leer();
    $("#r-ok").disabled = !!r && r.u === "semana" && !r.dias.length;
    $("#r-desc").textContent = !r ? "Tarea normal, sin repetición." : r.u === "semana" && !r.dias.length ? "Elige al menos un día."
      : `Se repetirá ${descRep(r)}. Primera vez: ${fechaCorta(primeraFecha(r, fechaBase || hoyISO()))}.`;
  };
  $("#r-u").onchange = $("#r-n").oninput = $("#r-dia").oninput = pintarR;
  $("#r-sem").onclick = e => { const b = e.target.closest("button"); if (!b) return; const d = +b.dataset.d;
    dias = dias.includes(d) ? dias.filter(x => x !== d) : [...dias, d]; pintarR(); };
  pintarR();
  return new Promise(res => {
    let valor;
    $("#r-ok").onclick = () => { valor = leer(); dlg.close(); };
    $("#r-cancel").onclick = () => dlg.close();
    dlg.onclose = () => res(valor);
    dlg.showModal();
  });
}
function aviso(t) {
  let a = $("#aviso"); if (!a) { a = document.createElement("div"); a.id = "aviso"; document.body.appendChild(a); }
  a.textContent = t; a.classList.add("ver"); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove("ver"), 2800);
}
const verCompra = () => verLista("compra", "Lista de la compra", "Leche, pan, huevos...");
const verTareas = () => verLista("tareas", "Tareas de casa", "Limpiar baño, poner lavadora...");

/* ---------- gastos ---------- */
async function verGastos(cuenta = "comun", mes = hoyISO().slice(0, 7)) {
  const ops = c => CATEGORIAS[c].map(x => `<option>${x}</option>`).join("");
  $("#contenido").innerHTML = `
  <div class="tarjeta"><h2>Gastos</h2>
    <div class="grid2"><select id="g-cuenta"><option value="comun">Cuenta conjunta</option><option value="diego">Diego</option><option value="leire">Leire</option></select>
    <input type="month" id="g-mes" value="${mes}"></div>
    <div class="resumen" id="g-res"></div>
    <form id="g-form"><div class="grid2"><input id="g-concepto" placeholder="Concepto" required><input id="g-importe" inputmode="decimal" placeholder="Importe €" required></div>
      <div class="grid2"><select id="g-cat">${ops(cuenta)}</select><input type="date" id="g-fecha" value="${hoyISO()}"></div>
      <div class="grid2"><select id="g-tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select><button>Apuntar</button></div></form>
  </div>
  <div class="tarjeta" id="g-lista"></div>`;
  $("#g-cuenta").value = cuenta;
  $("#g-cuenta").onchange = () => verGastos($("#g-cuenta").value, $("#g-mes").value);
  $("#g-mes").onchange = () => verGastos($("#g-cuenta").value, $("#g-mes").value);
  const [a, m] = mes.split("-").map(Number), ini = `${mes}-01`, fin = new Date(a, m, 1).toISOString().slice(0, 10);
  const pintar = async () => {
    const { data: g } = await sb.from("gastos").select("*").eq("cuenta", cuenta).gte("fecha", ini).lt("fecha", fin).order("fecha", { ascending: false });
    const { data: i } = await sb.from("ingresos").select("*").eq("cuenta", cuenta).gte("fecha", ini).lt("fecha", fin).order("fecha", { ascending: false });
    const tg = (g || []).reduce((s, x) => s + +x.importe, 0), ti = (i || []).reduce((s, x) => s + +x.importe, 0);
    $("#g-res").innerHTML = `<div><small>Ingresos</small><b>${eur(ti)}</b></div><div><small>Gastos</small><b>${eur(tg)}</b></div><div><small>Ahorro</small><b style="color:${ti - tg >= 0 ? "var(--ok)" : "var(--mal)"}">${eur(ti - tg)}</b></div>`;
    const filas = [...(i || []).map(x => ({ ...x, tipo: "ingreso" })), ...(g || []).map(x => ({ ...x, tipo: "gasto" }))].sort((x, y) => y.fecha.localeCompare(x.fecha));
    $("#g-lista").innerHTML = filas.length ? filas.map(x => `<div class="fila" data-id="${x.id}" data-t="${x.tipo}">
      <span class="txt">${esc(x.concepto)}<br><small class="vacio">${x.fecha.slice(8)}/${x.fecha.slice(5, 7)} · ${esc(x.categoria || (x.persona === "leire" ? "Ingreso Leire" : "Ingreso Diego"))}</small></span>
      <span class="importe" style="color:${x.tipo === "ingreso" ? "var(--ok)" : "inherit"}">${x.tipo === "ingreso" ? "+" : "-"}${eur(x.importe)}</span>
      <button class="borrar">×</button></div>`).join("") : `<p class="vacio">Sin movimientos este mes.</p>`;
  };
  $("#g-lista").onclick = async e => {
    const b = e.target.closest(".borrar"); if (!b || !confirm("¿Borrar este movimiento?")) return;
    const f = b.closest(".fila"); await sb.from(f.dataset.t === "ingreso" ? "ingresos" : "gastos").delete().eq("id", f.dataset.id); pintar();
  };
  $("#g-form").onsubmit = async e => {
    e.preventDefault();
    const importe = parseFloat($("#g-importe").value.replace(",", ".")); if (!(importe > 0)) return;
    const base = { fecha: $("#g-fecha").value, concepto: $("#g-concepto").value.trim(), importe };
    if ($("#g-tipo").value === "ingreso") {
      await sb.from("ingresos").insert({ ...base, cuenta, persona: cuenta === "comun" ? yo.clave : cuenta });
    } else {
      await sb.from("gastos").insert({ ...base, cuenta, categoria: $("#g-cat").value });
      // Regla: un gasto "Casa" en una cuenta personal es un ingreso de esa persona en la conjunta
      if (cuenta !== "comun" && $("#g-cat").value === "Casa")
        await sb.from("ingresos").insert({ ...base, cuenta: "comun", persona: cuenta });
    }
    $("#g-concepto").value = ""; $("#g-importe").value = ""; pintar();
  };
  pintar();
}

/* ---------- más ---------- */
async function verMas() {
  const { data } = await sb.from("recibos").select("*").order("dia");
  const M = ["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  $("#contenido").innerHTML = `
  <div class="tarjeta"><h2>Hola, ${esc(yo.nombre)}</h2><p class="vacio">${esc(yo.email)}</p>
    <button class="secundario" id="salir">Cerrar sesión</button></div>
  <div class="tarjeta"><h2>Calendarios de iCloud</h2><div id="cals"></div>
    <details class="ayuda"><summary>¿Cómo saco el enlace?</summary>
      <p>En el iPhone: app <b>Calendario</b> › <b>Calendarios</b> (abajo) › toca la ⓘ del calendario › activa <b>Calendario público</b> › <b>Compartir enlace</b> › <b>Copiar</b>. Pégalo aquí. El enlace solo lo ve la app (no aparece en la web) y podéis quitarlo cuando queráis desactivando «Calendario público».</p>
      <p>Hazlo con cada calendario que quieras ver: el tuyo y el compartido (azul).</p></details>
    <div class="add-cal">
      <select id="cal-persona"><option value="${esc(yo.clave)}">${esc(yo.nombre)}</option><option value="comun">Los dos (compartido)</option>${["diego", "leire"].filter(p => p !== yo.clave).map(p => `<option value="${p}">${NOMBRE_P[p]}</option>`).join("")}</select>
      <input id="cal-nombre" placeholder="Nombre (p. ej. Personal)" autocomplete="off" data-1p-ignore data-lpignore="true">
      <input id="cal-url" placeholder="Enlace webcal://... o https://..." autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-1p-ignore data-lpignore="true">
      <button type="button" id="cal-add">Añadir calendario</button><p id="cal-msg" class="vacio"></p></div></div>
  <div class="tarjeta"><h2>Recibos</h2>${(data || []).map(r => `<div class="fila"><span class="txt">${esc(r.nombre)}<br><small class="vacio">día ${r.dia} · ${r.meses.length === 12 ? "cada mes" : r.meses.map(m => M[m]).join(", ")}${r.nota ? " · " + esc(r.nota) : ""}</small></span><span class="importe">${r.importe_aprox ? "~" + eur(r.importe_aprox) : ""}</span></div>`).join("")}</div>`;
  $("#salir").onclick = () => sb.auth.signOut();
  pintarCalendarios();
  $("#cal-add").onclick = async () => {
    const url = $("#cal-url").value.trim(), msg = $("#cal-msg");
    if (!/^(webcals?|https?):\/\/\S+$/i.test(url)) { msg.textContent = "Pega el enlace completo (empieza por webcal:// o https://)."; return; }
    msg.textContent = "Guardando...";
    const { error } = await sb.from("calendarios").insert({ persona: $("#cal-persona").value, nombre: $("#cal-nombre").value.trim() || "Calendario", url });
    if (error) { msg.textContent = "No se pudo guardar: " + error.message; return; }
    $("#cal-url").value = ""; $("#cal-nombre").value = ""; calCache = null;
    msg.textContent = "Comprobando...";
    const { data, error: e2 } = await sb.functions.invoke("calendario", { body: { desde: new Date().toISOString(), hasta: new Date(Date.now() + 28 * 864e5).toISOString() } });
    msg.textContent = e2 ? "Guardado, pero no se pudo comprobar ahora." : (data.fallos || []).length
      ? "⚠️ Guardado, pero hay un calendario que no se puede leer: revisa el enlace." : `✅ Leído: ${(data.eventos || []).length} eventos en las próximas 4 semanas.`;
    pintarCalendarios();
  };
}
async function pintarCalendarios() {
  const { data } = await sb.from("calendarios").select("*").order("creado");
  $("#cals").innerHTML = (data || []).length ? data.map(c => `<div class="fila"><span class="punto" style="background:${COLOR_P[c.persona]}"></span>
    <span class="txt">${esc(NOMBRE_P[c.persona])}: ${esc(c.nombre)}</span><button class="borrar" data-cal="${c.id}" title="Quitar">×</button></div>`).join("")
    : `<p class="vacio">Ninguno todavía.</p>`;
  $("#cals").querySelectorAll("[data-cal]").forEach(b => b.onclick = async () => {
    if (!confirm("¿Quitar este calendario de la app?")) return;
    await sb.from("calendarios").delete().eq("id", b.dataset.cal); calCache = null; pintarCalendarios();
  });
}

arrancar();
