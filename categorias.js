/* Categorías de la lista de la compra y clasificación automática por palabras */
window.CATS_COMPRA = [
  ["fruta", "🍎 Fruta y verdura", "manzana platano pera naranja mandarina kiwi fresa uva melon sandia piña limon aguacate tomate lechuga cebolla ajo patata zanahoria pimiento pepino calabacin berenjena brocoli coliflor espinaca acelga judia puerro champiñon seta remolacha calabaza apio rucula canonigo verdura fruta arandano frambuesa mango papaya higo cereza melocoton nectarina ciruela batata boniato lima jengibre perejil cilantro albahaca"],
  ["carne", "🥩 Carne y pescado", "pollo pavo ternera cerdo cordero carne_picada filete lomo solomillo hamburguesa salchicha chorizo jamon pechuga muslo costilla pescado merluza salmon atun bacalao gamba langostino calamar sepia mejillon sardina dorada lubina pulpo fiambre embutido salami bacon lacon"],
  ["lacteos", "🥛 Lácteos y huevos", "leche yogur yogurt queso mantequilla nata huevo clara kefir requeson cuajada skyr batido"],
  ["pan", "🍝 Pan, pasta y cereales", "pan barra tostada pasta macarron espagueti tallarin fideo arroz harina avena cereal muesli quinoa cuscus tortilla wrap galleta bizcocho legumbre garbanzo lenteja alubia"],
  ["despensa", "🥫 Despensa", "aceite vinagre sal azucar especia pimienta oregano tomate_frito salsa ketchup mayonesa mostaza conserva lata atun_en_lata miel mermelada crema_de_cacahuete almendra nuez frutos_secos chocolate cacao cafe te infusion caldo levadura sirope aroma vainilla proteina whey evowhey hummus guacamole"],
  ["congelados", "🧊 Congelados", "congelado helado pizza hielo"],
  ["bebidas", "🥤 Bebidas", "agua refresco cocacola coca_cola zumo cerveza vino isotonica bebida gaseosa"],
  ["limpieza", "🧽 Limpieza y casa", "detergente suavizante lejia friegasuelos lavavajillas estropajo bayeta papel_de_cocina servilleta bolsa basura film aluminio pila bombilla limpiador amoniaco"],
  ["higiene", "🧴 Higiene", "champu gel desodorante pasta_de_dientes cepillo papel_higienico compresa tampon crema maquinilla cuchilla colonia jabon algodon bastoncillo"],
  ["otros", "🛒 Otros", ""]
];
window.categoriaDe = (texto, aprendidas) => {
  const n = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (aprendidas && aprendidas[n]) return aprendidas[n];
  const palabras = n.split(/[^a-zñ]+/).filter(Boolean);
  let mejor = null, largo = 0;
  for (const [id, , claves] of CATS_COMPRA) for (const c of claves.split(" ")) {
    if (!c) continue;
    const ok = c.includes("_") ? n.includes(c.replace(/_/g, " ")) : palabras.some(w => w === c || w === c + "s" || w === c + "es" || (c.length > 4 && w.startsWith(c)));
    if (ok && c.length > largo) { mejor = id; largo = c.length; }
  }
  return mejor || "otros";
};
