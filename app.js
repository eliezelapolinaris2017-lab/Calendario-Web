/* =========================
   CONFIGURACIÓN
========================= */
const DEFAULTS = {
  BUSINESS_PHONE: "17876643079", // <— tu número en dígitos
  BUSINESS_NAME: "Oasis Air Cleaner Services LLC",
  WORK_START: "08:00",
  WORK_END: "18:00",
  SLOT_MINUTES: 60,
  ADMIN_PIN: "1234",
};

const LS = {
  CONFIG: "ap_config",
  BLOCKS: "ap_blockedSlots",     // { "YYYY-MM-DD": ["09:00", ...] }
  BOOKED: "ap_bookedSlots",      // { "YYYY-MM-DD": ["09:00", ...] }
  BOOKINGS: "ap_bookings",       // Detalle: { "YYYY-MM-DD": [{time,name,phone,notes,createdAt}], ... }
};

/* =========================
   ESTADO
========================= */
let state = {
  today: new Date(),
  currentMonth: null,
  currentYear: null,
  selectedDate: null,
  selectedTime: null,
  adminMode: false,
  config: null,
  blocks: {},
  booked: {},
  bookings: {},
};

/* =========================
   UTILIDADES
========================= */
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toISODate = (y,m,day) => `${y}-${pad(m+1)}-${pad(day)}`;
const parseHM = (hm) => { const [h,m] = hm.split(":").map(Number); return h*60+m; };
const minutesToHM = (mins) => `${pad(Math.floor(mins/60))}:${pad(mins%60)}`;

function getConfig(){ try{ return JSON.parse(localStorage.getItem(LS.CONFIG)) || {...DEFAULTS} }catch{ return {...DEFAULTS} } }
function saveConfig(cfg){ localStorage.setItem(LS.CONFIG, JSON.stringify(cfg)); }
function getBlocks(){ try{ return JSON.parse(localStorage.getItem(LS.BLOCKS)) || {} }catch{ return {} } }
function saveBlocks(b){ localStorage.setItem(LS.BLOCKS, JSON.stringify(b)); }
function getBooked(){ try{ return JSON.parse(localStorage.getItem(LS.BOOKED)) || {} }catch{ return {} } }
function saveBooked(b){ localStorage.setItem(LS.BOOKED, JSON.stringify(b)); }
function getBookings(){ try{ return JSON.parse(localStorage.getItem(LS.BOOKINGS)) || {} }catch{ return {} } }
function saveBookings(b){ localStorage.setItem(LS.BOOKINGS, JSON.stringify(b)); }

/* =========================
   INICIO
========================= */
document.addEventListener("DOMContentLoaded", () => {
  state.config   = getConfig();
  state.blocks   = getBlocks();
  state.booked   = getBooked();
  state.bookings = getBookings();

  const t = new Date();
  state.currentMonth = t.getMonth();
  state.currentYear  = t.getFullYear();

  hookMenu();
  hookMonthNav();
  hookForm();
  hookAdmin();
  hookConfig();
  hookReports();

  renderMonthLabel();
  renderCalendar();
  renderSlots();
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

      // Refrescos contextuales
      if(view==="reportes"){ renderReportTable(); }
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

  ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].forEach(d=>{
    const el = document.createElement("div"); el.className="dow"; el.textContent=d; cal.appendChild(el);
  });

  const first = new Date(state.currentYear, state.currentMonth, 1);
  const startDay = (first.getDay()+6)%7; // L=0 ... D=6
  const daysInMonth = new Date(state.currentYear, state.currentMonth+1, 0).getDate();

  for(let i=0;i<startDay;i++){ const cell=document.createElement("div"); cell.className="cell out"; cal.appendChild(cell); }

  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement("div");
    cell.className = "cell";
    const ymd = toISODate(state.currentYear, state.currentMonth, d);
    const num = document.createElement("div"); num.className="num"; num.textContent=d;
    const tags = document.createElement("div"); tags.className="tags";

    if(state.blocks[ymd]?.length){ const tg=document.createElement("span"); tg.className="tag blocked"; tg.textContent="Bloq."; tags.appendChild(tg); }
    if(state.booked[ymd]?.length){ const tg2=document.createElement("span"); tg2.className="tag booked"; tg2.textContent="Res."; tags.appendChild(tg2); }

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

function timeSlotsForDay(){
  const { WORK_START, WORK_END, SLOT_MINUTES } = state.config;
  const start = parseHM(WORK_START), end = parseHM(WORK_END);
  const slots = [];
  for(let m=start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES){ slots.push(minutesToHM(m)); }
  return slots;
}

function renderSlots(){
  const box = document.getElementById("slots");
  const info = document.getElementById("selectionInfo");
  box.innerHTML = "";

  if(!state.selectedDate){
    info.textContent = "Selecciona una fecha en el calendario.";
    disableActions(); return;
  }

  const all = timeSlotsForDay();
  const blocked = new Set(state.blocks[state.selectedDate]||[]);
  const booked  = new Set(state.booked[state.selectedDate]||[]);

  all.forEach(hm=>{
    const btn = document.createElement("button");
    btn.type="button"; btn.className="slot"; btn.textContent=hm;

    if(blocked.has(hm)) btn.classList.add("blocked");
    else if(booked.has(hm)) btn.classList.add("booked");
    else btn.classList.add("free");

    btn.addEventListener("click", ()=>{
      if(state.adminMode){
        toggleBlock(state.selectedDate, hm);
        renderSlots(); renderCalendar(); return;
      }
      if(btn.classList.contains("blocked") || btn.classList.contains("booked")) return;
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
   ADMIN / BLOQUEOS
========================= */
function hookAdmin(){
  const adminPin = document.getElementById("adminPin");
  const enterBtn = document.getElementById("enterAdmin");
  const exitBtn  = document.getElementById("exitAdmin");
  const status   = document.getElementById("adminStatus");

  enterBtn.addEventListener("click", ()=>{
    if(adminPin.value === state.config.ADMIN_PIN){
      state.adminMode = true; status.textContent="Modo: ADMIN"; status.style.color="#fff";
    }else alert("PIN incorrecto");
  });
  exitBtn.addEventListener("click", ()=>{ state.adminMode=false; status.textContent="Modo: usuario"; status.style.color=""; });

  document.getElementById("blockDayBtn").addEventListener("click", ()=>{
    if(!state.adminMode) return alert("Entra en modo Admin.");
    const d = document.getElementById("blockDate").value; if(!d) return;
    const all = timeSlotsForDay();
    state.blocks[d] = Array.from(new Set([...(state.blocks[d]||[]), ...all]));
    saveBlocks(state.blocks); renderCalendar(); if(state.selectedDate===d) renderSlots();
  });

  document.getElementById("unblockDayBtn").addEventListener("click", ()=>{
    if(!state.adminMode) return alert("Entra en modo Admin.");
    const d = document.getElementById("unblockDate").value; if(!d) return;
    delete state.blocks[d];
    saveBlocks(state.blocks); renderCalendar(); if(state.selectedDate===d) renderSlots();
  });

  document.getElementById("exportBlocks").addEventListener("click", ()=>{
    const data = { blocks: state.blocks, booked: state.booked, bookings: state.bookings };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "agenda_backup.json"; a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("importBlocks").addEventListener("change", (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if(data.blocks)   { state.blocks   = data.blocks;   saveBlocks(state.blocks); }
        if(data.booked)   { state.booked   = data.booked;   saveBooked(state.booked); }
        if(data.bookings) { state.bookings = data.bookings; saveBookings(state.bookings); }
        renderCalendar(); renderSlots(); alert("Importado correctamente.");
      }catch{ alert("JSON inválido."); }
    };
    reader.readAsText(file);
  });

  document.getElementById("clearAll").addEventListener("click", ()=>{
    if(!confirm("¿Borrar TODOS los bloqueos y reservas?")) return;
    state.blocks={}; state.booked={}; state.bookings={};
    saveBlocks(state.blocks); saveBooked(state.booked); saveBookings(state.bookings);
    renderCalendar(); renderSlots();
  });
}
function toggleBlock(dateStr, hm){
  const arr = state.blocks[dateStr] || [];
  const idx = arr.indexOf(hm);
  if(idx>=0) arr.splice(idx,1); else arr.push(hm);
  state.blocks[dateStr] = arr;
  saveBlocks(state.blocks);
}

/* =========================
   FORMULARIO / WHATSAPP / RESERVAS
========================= */
function hookForm(){
  document.getElementById("sendWhatsApp").addEventListener("click", sendWhatsApp);
  document.getElementById("markBooked").addEventListener("click", markAsBooked);
}
function disableActions(){ document.getElementById("sendWhatsApp").disabled=true; document.getElementById("markBooked").disabled=true; }
function enableActions(){  document.getElementById("sendWhatsApp").disabled=false; document.getElementById("markBooked").disabled=false; }
function clearSelection(){
  state.selectedDate=null; state.selectedTime=null;
  document.getElementById("slots").innerHTML=""; document.getElementById("selectionInfo").textContent="Selecciona una fecha y hora.";
  disableActions();
}

function sendWhatsApp(){
  const name = document.getElementById("name").value.trim();
  const clientPhone = document.getElementById("clientPhone").value.trim();
  const notes = document.getElementById("notes").value.trim();
  if(!state.selectedDate || !state.selectedTime) return alert("Selecciona fecha y hora.");
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
  if(!state.selectedDate || !state.selectedTime) return alert("Selecciona fecha y hora.");
  const name = document.getElementById("name").value.trim();
  const clientPhone = document.getElementById("clientPhone").value.trim();
  const notes = document.getElementById("notes").value.trim();
  if(!name) return alert("Escribe el nombre del cliente.");

  // 1) Marca slot como reservado (para disponibilidad)
  const arr = state.booked[state.selectedDate] || [];
  if(!arr.includes(state.selectedTime)) arr.push(state.selectedTime);
  state.booked[state.selectedDate] = arr;
  saveBooked(state.booked);

  // 2) Guarda detalle de reserva
  const detailArr = state.bookings[state.selectedDate] || [];
  detailArr.push({
    time: state.selectedTime,
    name, phone: clientPhone, notes,
    createdAt: new Date().toISOString()
  });
  // ordena por hora
  detailArr.sort((a,b)=> parseHM(a.time)-parseHM(b.time));
  state.bookings[state.selectedDate] = detailArr;
  saveBookings(state.bookings);

  renderSlots(); renderCalendar();
  alert("Reserva guardada.");
}

/* =========================
   CONFIGURACIÓN
========================= */
function hookConfig(){
  const phone = document.getElementById("bizPhone");
  const biz   = document.getElementById("bizName");
  const ws    = document.getElementById("workStart");
  const we    = document.getElementById("workEnd");
  const sm    = document.getElementById("slotMinutes");

  phone.value = state.config.BUSINESS_PHONE;
  biz.value   = state.config.BUSINESS_NAME;
  ws.value    = state.config.WORK_START;
  we.value    = state.config.WORK_END;
  sm.value    = state.config.SLOT_MINUTES;

  document.getElementById("saveConfig").addEventListener("click", ()=>{
    const num = phone.value.replace(/\D/g,""); if(!num) return alert("Número de WhatsApp inválido.");
    state.config.BUSINESS_PHONE = num;
    state.config.BUSINESS_NAME  = biz.value.trim() || DEFAULTS.BUSINESS_NAME;
    saveConfig(state.config);
    alert("Configuración guardada.");
  });

  document.getElementById("saveWorkday").addEventListener("click", ()=>{
    const start = ws.value || DEFAULTS.WORK_START;
    const end   = we.value || DEFAULTS.WORK_END;
    const mins  = Math.max(15, parseInt(sm.value||DEFAULTS.SLOT_MINUTES,10));
    if(parseHM(end) <= parseHM(start)) return alert("El fin debe ser mayor que el inicio.");
    state.config.WORK_START = start;
    state.config.WORK_END   = end;
    state.config.SLOT_MINUTES = mins;
    saveConfig(state.config);
    renderSlots(); renderCalendar();
    alert("Horario actualizado.");
  });
}

/* =========================
   REPORTES
========================= */
function hookReports(){
  const repFrom = document.getElementById("repFrom");
  const repTo   = document.getElementById("repTo");
  const today   = fmtDate(new Date());
  repFrom.value = today; repTo.value = today;

  document.getElementById("repFiltrar").addEventListener("click", renderReportTable);
  document.getElementById("repHoy").addEventListener("click", ()=>{
    repFrom.value = today; repTo.value = today; renderReportTable();
  });
  document.getElementById("repExportCSV").addEventListener("click", exportCSV);
  document.getElementById("repImprimir").addEventListener("click", ()=>window.print());
}

function renderReportTable(){
  const from = document.getElementById("repFrom").value || "0000-01-01";
  const to   = document.getElementById("repTo").value   || "9999-12-31";
  const wrap = document.getElementById("repTable");
  const count = document.getElementById("repCount");
  wrap.innerHTML="";

  // recolecta
  const rows = [];
  const keys = Object.keys(state.bookings).sort();
  keys.forEach(date=>{
    if(date < from || date > to) return;
    const arr = state.bookings[date] || [];
    arr.forEach(r=>{
      rows.push({
        fecha: date,
        hora: r.time,
        cliente: r.name,
        telefono: r.phone || "",
        nota: r.notes || "",
        creado: r.createdAt
      });
    });
  });

  if(!rows.length){ wrap.innerHTML = `<p class="muted">No hay reservas en el rango.</p>`; count.textContent=""; return; }

  // tabla
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr>
    <th>Fecha</th><th>Hora</th><th>Cliente</th><th>Teléfono</th><th>Nota</th><th>Creado</th>
  </tr>`;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.fecha}</td><td>${r.hora}</td><td>${escapeHTML(r.cliente)}</td><td>${escapeHTML(r.telefono)}</td><td>${escapeHTML(r.nota)}</td><td>${r.creado}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  count.textContent = `${rows.length} reserva(s)`;
}

function exportCSV(){
  const from = document.getElementById("repFrom").value || "0000-01-01";
  const to   = document.getElementById("repTo").value   || "9999-12-31";
  const keys = Object.keys(state.bookings).sort();
  const out = [["Fecha","Hora","Cliente","Teléfono","Nota","Creado"]];
  keys.forEach(date=>{
    if(date < from || date > to) return;
    (state.bookings[date]||[]).forEach(r=>{
      out.push([date, r.time, r.name, r.phone||"", (r.notes||"").replace(/\n/g," "), r.createdAt]);
    });
  });
  const csv = out.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "reservas.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
