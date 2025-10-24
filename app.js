// Config por defecto
const DEFAULTS = {
  BUSINESS_PHONE: "17876643079",
  BUSINESS_NAME: "Oasis Air Cleaner Services LLC",
  WORK_START: "08:00",
  WORK_END: "18:00",
  SLOT_MINUTES: 60
};

// Claves de almacenamiento
const LS = {
  CONFIG: "ap_config",
  BLOCKS: "ap_blockedSlots",   // { "YYYY-MM-DD": ["09:00", ...] }
  BOOKED: "ap_bookedSlots",    // { "YYYY-MM-DD": ["09:00", ...] }
  BOOKINGS: "ap_bookings",     // { "YYYY-MM-DD": [{time,name,phone,notes,createdAt}], ... }
  PIN: "ap_admin_pin"          // string
};

// Helpers fecha/hora
const pad = n => String(n).padStart(2,"0");
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toISODate = (y,m,day) => `${y}-${pad(m+1)}-${pad(day)}`;
const parseHM = hm => { const [h,m]=hm.split(":").map(Number); return h*60+m; };
const minutesToHM = mins => `${pad(Math.floor(mins/60))}:${pad(mins%60)}`;
const escapeHTML = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// Config
function getConfig(){ try{ return JSON.parse(localStorage.getItem(LS.CONFIG)) || {...DEFAULTS} }catch{ return {...DEFAULTS} } }
function saveConfig(cfg){ localStorage.setItem(LS.CONFIG, JSON.stringify(cfg)); }

// Bloqueos/Reservas
function getBlocks(){ try{ return JSON.parse(localStorage.getItem(LS.BLOCKS)) || {} }catch{ return {} } }
function saveBlocks(b){ localStorage.setItem(LS.BLOCKS, JSON.stringify(b)); }
function getBooked(){ try{ return JSON.parse(localStorage.getItem(LS.BOOKED)) || {} }catch{ return {} } }
function saveBooked(b){ localStorage.setItem(LS.BOOKED, JSON.stringify(b)); }
function getBookings(){ try{ return JSON.parse(localStorage.getItem(LS.BOOKINGS)) || {} }catch{ return {} } }
function saveBookings(b){ localStorage.setItem(LS.BOOKINGS, JSON.stringify(b)); }

// PIN
function getPin(){ return localStorage.getItem(LS.PIN) || null; }
function setPin(pin){ localStorage.setItem(LS.PIN, pin); }

// Slots generados según horario
function generateSlots(config){
  const start = parseHM(config.WORK_START);
  const end = parseHM(config.WORK_END);
  const dur = Math.max(15, parseInt(config.SLOT_MINUTES||60,10));
  const out = [];
  for(let m=start; m + dur <= end; m += dur){ out.push(minutesToHM(m)); }
  return out;
}
