/**
 * Hogar · CrossFit al calendario
 * Lee los correos de AimHarder (reservas y cancelaciones) y los apunta
 * en el calendario de la app de casa. Se instala en el Gmail de cada uno.
 *
 * Instalación:
 *  1. Pega este código en un proyecto nuevo de https://script.google.com
 *  2. Cambia TOKEN por el que te ha dado Claude (uno distinto para Diego y para Leire).
 *  3. Ejecuta la función "instalar" una vez y acepta los permisos.
 */
const TOKEN = 'PEGA_AQUI_TU_TOKEN';
const URL_RPC = 'https://gksmkfsluoknjgaeacvd.supabase.co/rest/v1/rpc/evento_crossfit';
const CLAVE_PUBLICA = 'sb_publishable_AlbSbr4WriWfoOwegtQq7g_PD_q4NFy';

function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('revisarCorreos').timeBased().everyMinutes(5).create();
  revisarCorreos();
}

function revisarCorreos() {
  const props = PropertiesService.getScriptProperties();
  const hechos = JSON.parse(props.getProperty('hechos') || '[]');
  const mensajes = [];
  GmailApp.search('from:no-reply@aimharder.com newer_than:3d (reservada OR cancelada OR cancelación)')
    .forEach(hilo => hilo.getMessages().forEach(m => mensajes.push(m)));
  mensajes.sort((a, b) => a.getDate() - b.getDate());
  mensajes.forEach(m => {
    const id = m.getId();
    if (hechos.indexOf(id) >= 0) return;
    const e = leer(m.getSubject() + '\n' + m.getPlainBody());
    if (e) {
      const r = UrlFetchApp.fetch(URL_RPC, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { apikey: CLAVE_PUBLICA },
        payload: JSON.stringify({ token: TOKEN, tipo: e.tipo, clase: e.clase, fecha: e.fecha, hora: e.hora })
      });
      if (r.getResponseCode() >= 300) { console.error('Error ' + r.getResponseCode() + ': ' + r.getContentText()); return; }
      console.log(e.tipo + ' ' + e.clase + ' ' + e.fecha + ' ' + e.hora);
    }
    hechos.push(id);
  });
  props.setProperty('hechos', JSON.stringify(hechos.slice(-300)));
}

function leer(texto) {
  let m = texto.match(/notificaci[oó]n de tu (reserva|cancelaci[oó]n) en (.+?) el (\d{2}-\d{2}-\d{4}) a las (\d{2}:\d{2})/i);
  if (m) return { tipo: m[1].toLowerCase().startsWith('reserva') ? 'reserva' : 'cancelacion', clase: m[2].replace(/&amp;/g, '&').trim(), fecha: m[3], hora: m[4] };
  m = texto.match(/(?:Sesi[oó]n|Clase) de (.+?) (reservada|cancelada) el (\d{2}-\d{2}-\d{4}) a las (\d{2}:\d{2})/i);
  if (m) return { tipo: m[2].toLowerCase() === 'reservada' ? 'reserva' : 'cancelacion', clase: m[1].replace(/&amp;/g, '&').trim(), fecha: m[3], hora: m[4] };
  return null;
}
