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
      <div class="tarjeta"><h2>Esta semana</h2><div id="semana"><span class="vacio">Cargando...</span></div></div>
    </div>
    <div>
      <div class="tarjeta"><h2>Entreno de Diego</h2><div id="entreno"><span class="vacio">Cargando...</span></div></div>
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
const filaEvento = e => `<div class="fila"><span class="punto" style="background:${COLOR_P[e.persona]}"></span>
  <span class="txt">${esc(NOMBRE_P[e.persona])}: ${esc(e.titulo)}</span><span class="etq">${horaDe(e.inicio)}</span></div>`;
async function eventosEntre(desde, hasta) {
  const { data } = await sb.from("eventos").select("*").gte("inicio", desde.toISOString()).lt("inicio", hasta.toISOString()).order("inicio");
  return data || [];
}
async function cargarHoy() {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  const d8 = new Date(d0); d8.setDate(d8.getDate() + 8);
  const [evHoy, evSemana] = await Promise.all([eventosEntre(d0, d1), eventosEntre(d1, d8)]);
  $("#semana").innerHTML = evSemana.length ? evSemana.map(e => {
    const dia = new Date(e.inicio).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", timeZone: "Europe/Madrid" });
    return filaEvento(e).replace('<span class="etq">', `<span class="etq">${dia} · `);
  }).join("") : `<span class="vacio">Nada apuntado esta semana.</span>`;
  const { data: turno } = await sb.rpc("turno_del_dia", { dia: hoyISO() });
  const { count: compra } = await sb.from("compra").select("*", { count: "exact", head: true }).eq("hecho", false);
  const { count: tareas } = await sb.from("tareas").select("*", { count: "exact", head: true }).eq("hecho", false);
  $("#hoy").innerHTML = `
    <div class="fila"><span class="punto" style="background:var(--diego)"></span><span class="txt">Diego: turno</span><span class="etq">${esc(TURNOS[turno] || "—")}</span></div>
    ${evHoy.map(filaEvento).join("")}
    <div class="fila"><span class="txt">🛒 Por comprar</span><span class="etq">${compra ?? 0}</span></div>
    <div class="fila"><span class="txt">✅ Tareas pendientes</span><span class="etq">${tareas ?? 0}</span></div>`;
}
async function cargarEntreno() {
  const { data, error } = await sb.rpc("entreno_del_dia", { dia: hoyISO() });
  if (error || !data) { $("#entreno").innerHTML = `<span class="vacio">Hoy no hay entreno programado.</span>`; return; }
  $("#entreno").innerHTML = `<div class="fila" style="cursor:pointer" id="ent-t"><span class="txt"><b>${esc(data.titulo)}</b></span><span class="etq">ver</span></div>
    <div class="entreno-detalle" id="ent-d">${esc(data.detalle)}</div>`;
  $("#ent-t").onclick = () => $("#ent-d").classList.toggle("abierto");
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
    <div class="add" id="f-add"><input id="nuevo" name="articulo" type="text" placeholder="${placeholder}"
      autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" enterkeyhint="done"
      data-1p-ignore data-lpignore="true" data-form-type="other"><button type="button" id="b-add">Añadir</button></div>
    <div id="sugerencias" class="sug-lista"></div>
    ${tabla === "compra" ? `<div class="ticket-bar"><label class="mini">📷 Añadir ticket<input type="file" id="f-ticket" accept="image/*" hidden></label>
      <span id="ticket-msg" class="sug-tit"></span></div><div id="tickets"></div>` : ""}</div>
    <div class="tarjeta" id="lista"></div>`;
  const pintar = async () => {
    const { data } = await sb.from(tabla).select("*").order("hecho").order("creado", { ascending: false });
    const pend = (data || []).filter(x => !x.hecho), hechos = (data || []).filter(x => x.hecho).slice(0, 15);
    $("#lista").innerHTML = (pend.length ? "" : `<p class="vacio">Nada pendiente 🎉</p>`) + [...pend, ...hechos].map(x => `
      <div class="fila ${x.hecho ? "tachado" : ""}" data-id="${x.id}">
        <button class="check ${x.hecho ? "hecho" : ""}" data-acc="toggle"></button>
        <span class="txt">${esc(x.texto)}${x.coste ? ` <span class="etq">${eur(x.coste)}</span>` : ""}</span>
        <button class="borrar" data-acc="borrar">×</button></div>`).join("");
    pendientes = pend;
  };
  let sugs = null, pendientes = [];
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
    sugs = [...peso.values()].sort((a, b) => b.v - a.v);
    return sugs;
  };
  const anadir = async t => {
    t = mayus((t || "").trim()); if (!t) return;
    $("#nuevo").value = ""; $("#sugerencias").innerHTML = "";
    await sb.from(tabla).insert({ texto: t }); sugs = null; pintar(); $("#nuevo").focus();
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
    $("#sugerencias").innerHTML = res.map(x => `<button type="button" class="sug">${esc(x.nombre)}</button>`).join("");
  };
  $("#nuevo").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); anadir($("#nuevo").value); } };
  $("#b-add").onclick = () => anadir($("#nuevo").value);
  $("#sugerencias").onclick = e => { const b = e.target.closest(".sug"); if (b) anadir(b.textContent); };
  $("#lista").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    const id = b.closest(".fila").dataset.id;
    if (b.dataset.acc === "borrar") await sb.from(tabla).delete().eq("id", id);
    else {
      const hecho = !b.classList.contains("hecho"); const cambio = { hecho, hecho_en: hecho ? new Date().toISOString() : null };
      await sb.from(tabla).update(cambio).eq("id", id);
    }
    pintar();
  };
  if (tabla === "compra") { pintarTickets(); $("#f-ticket").onchange = subirTicket; }
  const ch = sb.channel("rt-" + tabla).on("postgres_changes", { event: "*", schema: "public", table: tabla }, pintar).subscribe();
  canales.push(ch); pintar();
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
  <div class="tarjeta"><h2>Recibos</h2>${(data || []).map(r => `<div class="fila"><span class="txt">${esc(r.nombre)}<br><small class="vacio">día ${r.dia} · ${r.meses.length === 12 ? "cada mes" : r.meses.map(m => M[m]).join(", ")}${r.nota ? " · " + esc(r.nota) : ""}</small></span><span class="importe">${r.importe_aprox ? "~" + eur(r.importe_aprox) : ""}</span></div>`).join("")}</div>`;
  $("#salir").onclick = () => sb.auth.signOut();
}

arrancar();
