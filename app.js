/* =========================
   CONFIGURACIÓN (editable)
========================= */
const DEFAULTS = {
  BUSINESS_PHONE: "17876643079", // <- Reemplaza con tu número (solo dígitos)
  BUSINESS_NAME: "Oasis Air Cleaner Services LLC",
  WORK_START: "08:00",         // Inicio jornada
  WORK_END: "18:00",           // Fin jornada
  SLOT_MINUTES: 60,            // Duración de cada cita
  ADMIN_PIN: "1234",           // PIN para modo Admin
};

// Keys localStorage
const LS = {
  CONFIG: "ap_config",
  BLOCKS: "ap_blockedSlots",   // { "YYYY-MM-DD": ["09:00","10:00"], ... }
  BOOKED: "ap_bookedSlots",    // { "YYYY-MM-DD": ["13:00", ...] }
};

// Estado global
let state = {
  today: new Date(),
  currentMonth: null,  // 0-11
  currentYear: null,
  selectedDate: null,  // "YYYY-MM-DD"
  selectedTime: null,  // "HH:MM"
  adminMode: false,
  config: null,
  blocks: {}, // objeto
  booked: {}, // objeto
};

/* =========================
   UTILIDADES
========================= */
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toISODate = (y,m,day) => `${y}-${pad(m+1)}-${pad(day)}`;
const parseHM = (hm) => {
  const [h,m] = hm.split(":").map(Number);
  return h*60+m;
};
const minutesToHM = (mins) => `${pad(Math.floor(mins/60))}:${pad(mins%60)}`;

function getConfig(){
  const raw = localStorage.getItem(LS.CONFIG);
  if(raw){
    try{ return JSON.parse(raw) }catch(e){/* noop */}
  }
  return {...DEFAULTS};
}
function saveConfig(cfg){
  localStorage.setItem(LS.CONFIG, JSON.stringify(cfg));
}
function getBlocks(){
  const raw = localStorage.getItem(LS.BLOCKS);
  return raw ? JSON.parse(raw) : {};
}
function saveBlocks(b){
  localStorage.setItem(LS.BLOCKS, JSON.stringify(b));
}
function getBooked(){
  const raw = localStorage.getItem(LS.BOOKED);
  return raw ? JSON.parse(raw) : {};
}
function saveBooked(b){
  localStorage.setItem(LS.BOOKED, JSON.stringify(b));
}

/* =========================
   INICIALIZACIÓN
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // Cargar estado
  state.config = getConfig();
  state.blocks = getBlocks();
  state.booked = getBooked();

  const t = new Date();
  state.currentMonth = t.getMonth();
  state.currentYear = t.getFullYear();

  // Hook UI
  hookMenu();
  hookMonthNav();
  hookForm();
  hookAdmin();
  hookConfig();

  renderMonthLabel();
  renderCalendar();
  renderSlots(); // vacío hasta seleccionar día
});

/* =========================
   NAVEGACIÓN SPA
========================= */
function hookMenu(){
  const btns = document.querySelectorAll(".menu-btn");
  btns.forEach(b=>{
    b.addEventListener("click", ()=>{
      btns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");

      const view = b.getAttribute("data-view");
      document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
      document.getElementById(`view-${view}`).classList.add("active");
    });
  });
}

/* =========================
   CALENDARIO
========================= */
function hookMonthNav(){
  document.getElementById("prevMonth").addEventListener("click", ()=>{
    state.currentMonth--;
    if(state.currentMonth<0){ state.currentMonth=11; state.currentYear--; }
    renderMonthLabel(); renderCalendar(); clearSelection();
  });
  document.getElementById("nextMonth").addEventListener("click", ()=>{
    state.currentMonth++;
    if(state.currentMonth>11){ state.currentMonth=0; state.currentYear++; }
    renderMonthLabel(); renderCalendar(); clearSelection();
  });
}
function renderMonthLabel(){
  const lbl = document.getElementById("monthLabel");
  const dt = new Date(state.currentYear, state.currentMonth, 1);
  const fmt = dt.toLocaleDateString("es-PR", {month:"long", year:"numeric"});
  lbl.textContent = fmt.charAt(0).toUpperCase()+fmt.slice(1);
}

function renderCalendar(){
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  // encabezados
  ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].forEach(d=>{
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = d;
    cal.appendChild(el);
  });

  const first = new Date(state.currentYear, state.currentMonth, 1);
  const startDay = (first.getDay()+6)%7; // convertir Domingo(0)→6
  const daysInMonth = new Date(state.currentYear, state.currentMonth+1, 0).getDate();

  // celdas en blanco antes del 1
  for(let i=0;i<startDay;i++){
    const cell = document.createElement("div");
    cell.className = "cell out";
    cal.appendChild(cell);
  }

  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement("div");
    cell.className = "cell";
    const ymd = toISODate(state.currentYear, state.currentMonth, d);
    const num = document.createElement("div");
    num.className = "num"; num.textContent = d;
    const tags = document.createElement("div");
    tags.className = "tags";

    if(state.blocks[ymd] && state.blocks[ymd].length>0){
      const tg = document.createElement("span");
      tg.className = "tag blocked"; tg.textContent = "Bloq.";
      tags.appendChild(tg);
    }
    if(state.booked[ymd] && state.booked[ymd].length>0){
      const tg2 = document.createElement("span");
      tg2.className = "tag booked"; tg2.textContent = "Res.";
      tags.appendChild(tg2);
    }

    cell.appendChild(num); cell.appendChild(tags);

    cell.addEventListener("click", ()=>{
      state.selectedDate = ymd;
      renderSlots();
      document.querySelectorAll(".cell").forEach(c=>c.classList.remove("selected"));
      cell.classList.add("selected");
    });

    cal.appendChild(cell);
  }
}

function timeSlotsForDay(dateStr){
  const { WORK_START, WORK_END, SLOT_MINUTES } = state.config;
  const start = parseHM(WORK_START);
  const end = parseHM(WORK_END);
  const slots = [];
  for(let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES){
    slots.push(minutesToHM(m));
  }
  return slots;
}

function renderSlots(){
  const box = document.getElementById("slots");
  box.innerHTML = "";
  const info = document.getElementById("selectionInfo");

  if(!state.selectedDate){
    info.textContent = "Selecciona una fecha en el calendario.";
    disableActions();
    return;
  }

  const all = timeSlotsForDay(state.selectedDate);
  const blocked = new Set((state.blocks[state.selectedDate]||[]));
  const booked = new Set((state.booked[state.selectedDate]||[]));

  all.forEach(hm=>{
    const btn = document.createElement("button");
    btn.type="button"; btn.className="slot";
    btn.textContent = hm;

    if(blocked.has(hm)){ btn.classList.add("blocked"); }
    else if(booked.has(hm)){ btn.classList.add("booked"); }
    else { btn.classList.add("free"); }

    btn.addEventListener("click", ()=>{
      if(state.adminMode){
        toggleBlock(state.selectedDate, hm);
        renderSlots(); renderCalendar();
        return;
      }
      if(btn.classList.contains("blocked") || btn.classList.contains("booked")) return;

      // Selección de usuario
      state.selectedTime = hm;
      document.querySelectorAll(".slot").forEach(s=>s.classList.remove("selected"));
      btn.classList.add("selected");
      info.textContent = `Seleccionado: ${state.selectedDate} — ${hm}`;
      enableActions();
    });

    box.appendChild(btn);
  });
}

/* =========================
   BLOQUEOS / ADMIN
========================= */
function hookAdmin(){
  const adminPin = document.getElementById("adminPin");
  const enterBtn = document.getElementById("enterAdmin");
  const exitBtn = document.getElementById("exitAdmin");
  const status = document.getElementById("adminStatus");

  enterBtn.addEventListener("click", ()=>{
    if(adminPin.value === state.config.ADMIN_PIN){
      state.adminMode = true;
      status.textContent = "Modo: ADMIN";
      status.style.color = "#fff";
    }else{
      alert("PIN incorrecto");
    }
  });
  exitBtn.addEventListener("click", ()=>{
    state.adminMode = false;
    status.textContent = "Modo: usuario";
    status.style.color = "";
  });

  // Bloquear día entero
  document.getElementById("blockDayBtn").addEventListener("click", ()=>{
    if(!state.adminMode) return alert("Entra en modo Admin.");
    const d = document.getElementById("blockDate").value;
    if(!d) return;
    const all = timeSlotsForDay(d);
    state.blocks[d] = Array.from(new Set([...(state.blocks[d]||[]), ...all]));
    saveBlocks(state.blocks); renderCalendar();
    if(state.selectedDate===d) renderSlots();
  });

  // Desbloquear día entero
  document.getElementById("unblockDayBtn").addEventListener("click", ()=>{
    if(!state.adminMode) return alert("Entra en modo Admin.");
    const d = document.getElementById("unblockDate").value;
    if(!d) return;
    delete state.blocks[d];
    saveBlocks(state.blocks); renderCalendar();
    if(state.selectedDate===d) renderSlots();
  });

  // Exportar / Importar / Limpiar
  document.getElementById("exportBlocks").addEventListener("click", ()=>{
    const data = {
      blocks: state.blocks,
      booked: state.booked
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bloqueos_reservas.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("importBlocks").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(data.blocks) { state.blocks = data.blocks; saveBlocks(state.blocks); }
        if(data.booked) { state.booked = data.booked; saveBooked(state.booked); }
        renderCalendar(); renderSlots();
        alert("Importado correctamente.");
      }catch(err){
        alert("JSON inválido.");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("clearAll").addEventListener("click", ()=>{
    if(!confirm("¿Borrar TODOS los bloqueos y reservas?")) return;
    state.blocks = {}; state.booked = {};
    saveBlocks(state.blocks); saveBooked(state.booked);
    renderCalendar(); renderSlots();
  });
}

function toggleBlock(dateStr, hm){
  const arr = state.blocks[dateStr] || [];
  const idx = arr.indexOf(hm);
  if(idx>=0) arr.splice(idx,1);
  else arr.push(hm);
  state.blocks[dateStr] = arr;
  saveBlocks(state.blocks);
}

/* =========================
   FORMULARIO / WHATSAPP
========================= */
function hookForm(){
  document.getElementById("sendWhatsApp").addEventListener("click", sendWhatsApp);
  document.getElementById("markBooked").addEventListener("click", markAsBooked);
}

function disableActions(){
  document.getElementById("sendWhatsApp").disabled = true;
  document.getElementById("markBooked").disabled = true;
}
function enableActions(){
  document.getElementById("sendWhatsApp").disabled = false;
  document.getElementById("markBooked").disabled = false;
}

function clearSelection(){
  state.selectedDate = null;
  state.selectedTime = null;
  document.getElementById("slots").innerHTML = "";
  document.getElementById("selectionInfo").textContent = "Selecciona una fecha y hora.";
  disableActions();
}

function sendWhatsApp(){
  const name = document.getElementById("name").value.trim();
  const clientPhone = document.getElementById("clientPhone").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if(!state.selectedDate || !state.selectedTime){
    return alert("Selecciona fecha y hora.");
  }
  if(!name) return alert("Escribe el nombre del cliente.");

  const d = new Date(state.selectedDate + "T" + state.selectedTime + ":00");
  const when = d.toLocaleString("es-PR", { dateStyle:"full", timeStyle:"short" });

  const msg =
`*Nueva solicitud de cita* — ${state.config.BUSINESS_NAME}
• Cliente: ${name}
• Teléfono: ${clientPhone || "N/D"}
• Fecha y hora: ${when}
• Nota: ${notes || "N/D"}
• Confirmar disponibilidad: ${state.selectedDate} ${state.selectedTime}`;

  const phone = state.config.BUSINESS_PHONE.replace(/\D/g,"");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  window.open(url, "_blank");
}

function markAsBooked(){
  if(!state.selectedDate || !state.selectedTime){
    return alert("Selecciona fecha y hora.");
  }
  const arr = state.booked[state.selectedDate] || [];
  if(!arr.includes(state.selectedTime)) arr.push(state.selectedTime);
  state.booked[state.selectedDate] = arr;
  saveBooked(state.booked);
  renderSlots(); renderCalendar();
  alert("Marcado como reservado.");
}

/* =========================
   CONFIG
========================= */
function hookConfig(){
  const phone = document.getElementById("bizPhone");
  const biz = document.getElementById("bizName");
  const ws = document.getElementById("workStart");
  const we = document.getElementById("workEnd");
  const sm = document.getElementById("slotMinutes");

  // Cargar valores
  phone.value = state.config.BUSINESS_PHONE;
  biz.value = state.config.BUSINESS_NAME;
  ws.value = state.config.WORK_START;
  we.value = state.config.WORK_END;
  sm.value = state.config.SLOT_MINUTES;

  document.getElementById("saveConfig").addEventListener("click", ()=>{
    const num = phone.value.replace(/\D/g,"");
    if(!num) return alert("Número de WhatsApp inválido.");
    state.config.BUSINESS_PHONE = num;
    state.config.BUSINESS_NAME = biz.value.trim() || DEFAULTS.BUSINESS_NAME;
    saveConfig(state.config);
    alert("Configuración guardada.");
  });

  document.getElementById("saveWorkday").addEventListener("click", ()=>{
    const start = ws.value || DEFAULTS.WORK_START;
    const end = we.value || DEFAULTS.WORK_END;
    const mins = Math.max(15, parseInt(sm.value||DEFAULTS.SLOT_MINUTES,10));
    if(parseHM(end) <= parseHM(start)) return alert("El fin debe ser mayor que el inicio.");
    state.config.WORK_START = start;
    state.config.WORK_END = end;
    state.config.SLOT_MINUTES = mins;
    saveConfig(state.config);
    renderSlots(); renderCalendar();
    alert("Horario actualizado.");
  });
}
