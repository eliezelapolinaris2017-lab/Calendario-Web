const A = {
  config: null,
  blocks: {},
  booked: {},
  bookings: {},
  authed: false
};

document.addEventListener("DOMContentLoaded", () => {
  A.config = getConfig();
  A.blocks = getBlocks();
  A.booked = getBooked();
  A.bookings = getBookings();

  setupMenu();
  initAuthUI();
  initBloqueos();
  initConfig();
  initReportes();
});

/* Navegación SPA del admin */
function setupMenu(){
  const btns = document.querySelectorAll(".menu-btn");
  btns.forEach(b=>{
    b.addEventListener("click", ()=>{
      btns.forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const view = b.getAttribute("data-view");
      document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
      document.getElementById(`view-${view}`).classList.add("active");
      if(view!=="login" && !A.authed) alert("Primero inicia sesión.");
      if(view==="reportes") renderReportTable();
    });
  });
}

/* ========== AUTH ========== */
function initAuthUI(){
  const havePin = !!getPin();
  const setupCard = document.getElementById("setupCard");
  const loginCard = document.getElementById("loginCard");
  setupCard.style.display = havePin ? "none" : "block";

  document.getElementById("saveNewPin").addEventListener("click", ()=>{
    const p1 = document.getElementById("newPin").value.trim();
    const p2 = document.getElementById("newPin2").value.trim();
    if(p1.length < 4) return alert("El PIN debe tener al menos 4 dígitos.");
    if(p1!==p2) return alert("Los PIN no coinciden.");
    setPin(p1);
    alert("PIN creado. Ahora inicia sesión.");
    setupCard.style.display="none";
  });

  document.getElementById("loginBtn").addEventListener("click", ()=>{
    const p = document.getElementById("loginPin").value.trim();
    if(!getPin()) return alert("Primero crea el PIN (arriba).");
    if(p===getPin()){
      A.authed = true;
      updateSessionBadges();
      alert("Acceso concedido.");
      // Saltar al módulo de bloqueos
      document.querySelector('.menu-btn[data-view="bloqueos"]').click();
    }else{
      alert("PIN incorrecto.");
    }
  });

  updateSessionBadges();
}
function updateSessionBadges(){
  const text = A.authed ? "Autenticado" : "No autenticado";
  ["sessionBadge","sessionBadge2","sessionBadge3"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.textContent = text;
  });
}

/* ========== BLOQUEOS ========== */
function initBloqueos(){
  document.getElementById("blkLoad").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const d = document.getElementById("blkDate").value;
    if(!d) return;
    renderBlkSlots(d);
  });

  document.getElementById("blockDayBtn").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const d = document.getElementById("blockDate").value; if(!d) return;
    const all = generateSlots(getConfig());
    const curr = getBlocks();
    curr[d] = Array.from(new Set([...(curr[d]||[]), ...all]));
    saveBlocks(curr); A.blocks = curr;
    if(document.getElementById("blkDate").value===d) renderBlkSlots(d);
    alert("Día bloqueado.");
  });

  document.getElementById("unblockDayBtn").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const d = document.getElementById("unblockDate").value; if(!d) return;
    const curr = getBlocks(); delete curr[d]; saveBlocks(curr); A.blocks=curr;
    if(document.getElementById("blkDate").value===d) renderBlkSlots(d);
    alert("Día desbloqueado.");
  });

  document.getElementById("exportAll").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const data = { config:getConfig(), blocks:getBlocks(), booked:getBooked(), bookings:getBookings() };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "agenda_backup.json"; a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("importAll").addEventListener("change", (e)=>{
    if(!A.authed) return alert("Inicia sesión.");
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      try{
        const data = JSON.parse(r.result);
        if(data.config) saveConfig(data.config);
        if(data.blocks) saveBlocks(data.blocks);
        if(data.booked) saveBooked(data.booked);
        if(data.bookings) saveBookings(data.bookings);
        A.config=getConfig(); A.blocks=getBlocks(); A.booked=getBooked(); A.bookings=getBookings();
        const d = document.getElementById("blkDate").value; if(d) renderBlkSlots(d);
        alert("Importado correctamente.");
      }catch{ alert("JSON inválido."); }
    };
    r.readAsText(f);
  });

  document.getElementById("clearAll").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    if(!confirm("¿Borrar TODOS los bloqueos y reservas?")) return;
    saveBlocks({}); saveBooked({}); saveBookings({});
    A.blocks={}; A.booked={}; A.bookings={};
    const d = document.getElementById("blkDate").value; if(d) renderBlkSlots(d);
  });
}

function renderBlkSlots(dateStr){
  const wrap = document.getElementById("blkSlots");
  wrap.innerHTML = "";
  const cfg = getConfig();
  const all = generateSlots(cfg);
  const blocks = getBlocks();
  const set = new Set(blocks[dateStr]||[]);
  all.forEach(hm=>{
    const b = document.createElement("button");
    b.type="button"; b.className="slot"; b.textContent=hm;
    if(set.has(hm)) b.classList.add("blocked"); else b.classList.add("free");
    b.addEventListener("click", ()=>{
      const current = getBlocks();
      const arr = current[dateStr] || [];
      const i = arr.indexOf(hm);
      if(i>=0) arr.splice(i,1); else arr.push(hm);
      current[dateStr] = arr; saveBlocks(current); A.blocks=current;
      renderBlkSlots(dateStr);
    });
    wrap.appendChild(b);
  });
}

/* ========== CONFIG ========== */
function initConfig(){
  document.getElementById("saveBiz").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const phone = document.getElementById("bizPhone").value.replace(/\D/g,"");
    const name = document.getElementById("bizName").value.trim();
    if(!phone) return alert("Número inválido.");
    const cfg = getConfig(); cfg.BUSINESS_PHONE = phone; cfg.BUSINESS_NAME = name || cfg.BUSINESS_NAME;
    saveConfig(cfg); A.config = cfg;
    alert("Datos guardados.");
  });

  document.getElementById("saveWork").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const ws = document.getElementById("workStart").value || "08:00";
    const we = document.getElementById("workEnd").value || "18:00";
    const sm = Math.max(15, parseInt(document.getElementById("slotMinutes").value||60,10));
    if(parseHM(we) <= parseHM(ws)) return alert("El fin debe ser mayor al inicio.");
    const cfg = getConfig(); cfg.WORK_START=ws; cfg.WORK_END=we; cfg.SLOT_MINUTES=sm;
    saveConfig(cfg); A.config = cfg;
    alert("Horario guardado.");
  });

  // Precarga campos
  const cfg = getConfig();
  document.getElementById("bizPhone").value = cfg.BUSINESS_PHONE;
  document.getElementById("bizName").value  = cfg.BUSINESS_NAME;
  document.getElementById("workStart").value = cfg.WORK_START;
  document.getElementById("workEnd").value   = cfg.WORK_END;
  document.getElementById("slotMinutes").value = cfg.SLOT_MINUTES;

  document.getElementById("changePin").addEventListener("click", ()=>{
    if(!A.authed) return alert("Inicia sesión.");
    const old = document.getElementById("pinOld").value.trim();
    const n1 = document.getElementById("pinNew").value.trim();
    const n2 = document.getElementById("pinNew2").value.trim();
    if(old!==getPin()) return alert("PIN actual incorrecto.");
    if(n1.length<4) return alert("El nuevo PIN debe tener al menos 4 dígitos.");
    if(n1!==n2) return alert("Los PIN no coinciden.");
    setPin(n1); alert("PIN actualizado.");
    document.getElementById("pinOld").value = document.getElementById("pinNew").value = document.getElementById("pinNew2").value = "";
  });
}

/* ========== REPORTES ========== */
function initReportes(){
  const today = fmtDate(new Date());
  document.getElementById("repFrom").value = today;
  document.getElementById("repTo").value = today;
  document.getElementById("repFiltrar").addEventListener("click", renderReportTable);
  document.getElementById("repHoy").addEventListener("click", ()=>{
    document.getElementById("repFrom").value = today;
    document.getElementById("repTo").value = today;
    renderReportTable();
  });
  document.getElementById("repExportCSV").addEventListener("click", exportCSV);
  document.getElementById("repImprimir").addEventListener("click", ()=>window.print());
}

function renderReportTable(){
  if(!A.authed) return alert("Inicia sesión.");
  const from = document.getElementById("repFrom").value || "0000-01-01";
  const to   = document.getElementById("repTo").value   || "9999-12-31";
  const wrap = document.getElementById("repTable");
  const count= document.getElementById("repCount");
  wrap.innerHTML = "";

  const bookings = getBookings();
  const rows = [];
  Object.keys(bookings).sort().forEach(date=>{
    if(date<from || date>to) return;
    bookings[date].forEach(r=>{
      rows.push({fecha:date, hora:r.time, cliente:r.name, telefono:r.phone||"", nota:r.notes||"", creado:r.createdAt});
    });
  });

  if(!rows.length){ wrap.innerHTML=`<p class="muted">No hay reservas en el rango.</p>`; count.textContent=""; return; }

  const table = document.createElement("table");
  table.innerHTML = `<thead><tr>
    <th>Fecha</th><th>Hora</th><th>Cliente</th><th>Teléfono</th><th>Nota</th><th>Creado</th>
  </tr></thead>`;
  const tb = document.createElement("tbody");
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.fecha}</td><td>${r.hora}</td><td>${escapeHTML(r.cliente)}</td><td>${escapeHTML(r.telefono)}</td><td>${escapeHTML(r.nota)}</td><td>${r.creado}</td>`;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  wrap.appendChild(table);
  count.textContent = `${rows.length} reserva(s)`;
}

function exportCSV(){
  if(!A.authed) return alert("Inicia sesión.");
  const from = document.getElementById("repFrom").value || "0000-01-01";
  const to   = document.getElementById("repTo").value   || "9999-12-31";
  const bookings = getBookings();
  const out = [["Fecha","Hora","Cliente","Teléfono","Nota","Creado"]];
  Object.keys(bookings).sort().forEach(date=>{
    if(date<from || date>to) return;
    bookings[date].forEach(r=>{
      out.push([date, r.time, r.name, r.phone||"", (r.notes||"").replace(/\n/g," "), r.createdAt]);
    });
  });
  const csv = out.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download="reservas.csv"; a.click();
  URL.revokeObjectURL(a.href);
}
