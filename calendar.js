const state = {
  config: null,
  blocks: {},
  booked: {},
  bookings: {},
  currentMonth: null,
  currentYear: null,
  selectedDate: null,
  selectedTime: null
};

document.addEventListener("DOMContentLoaded", () => {
  state.config = getConfig();
  state.blocks = getBlocks();
  state.booked = getBooked();
  state.bookings = getBookings();

  const t = new Date();
  state.currentMonth = t.getMonth();
  state.currentYear = t.getFullYear();

  hookMonthNav();
  renderMonthLabel();
  renderCalendar();
  renderSlots();

  document.getElementById("sendWhatsApp").addEventListener("click", sendWhatsApp);
  document.getElementById("markBooked").addEventListener("click", markAsBooked);
});

function hookMonthNav(){
  document.getElementById("prevMonth").addEventListener("click", ()=>{
    state.currentMonth--; if(state.currentMonth<0){ state.currentMonth=11; state.currentYear--; }
    renderMonthLabel(); renderCalendar(); clearSelection();
  });
  document.getElementById("nextMonth").addEventListener("click", ()=>{
    state.currentMonth++; if(state.currentMonth>11){ state.currentMonth=0; state.currentYear++; }
    renderMonthLabel(); renderCalendar(); clearSelection();
  });
}
function renderMonthLabel(){
  const dt = new Date(state.currentYear, state.currentMonth, 1);
  const fmt = dt.toLocaleDateString("es-PR", {month:"long", year:"numeric"});
  document.getElementById("monthLabel").textContent = fmt.charAt(0).toUpperCase()+fmt.slice(1);
}
function renderCalendar(){
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";
  ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].forEach(d=>{
    const el = document.createElement("div"); el.className="dow"; el.textContent=d; cal.appendChild(el);
  });
  const first = new Date(state.currentYear, state.currentMonth, 1);
  const startDay = (first.getDay()+6)%7;
  const daysInMonth = new Date(state.currentYear, state.currentMonth+1, 0).getDate();
  for(let i=0;i<startDay;i++){ const cell=document.createElement("div"); cell.className="cell out"; cal.appendChild(cell); }
  for(let d=1; d<=daysInMonth; d++){
    const ymd = toISODate(state.currentYear, state.currentMonth, d);
    const cell = document.createElement("div"); cell.className="cell";
    const num = document.createElement("div"); num.className="num"; num.textContent=d;
    const tags = document.createElement("div"); tags.className="tags";
    if(state.blocks[ymd]?.length){ const s=document.createElement("span"); s.className="tag blocked"; s.textContent="Bloq."; tags.appendChild(s); }
    if(state.booked[ymd]?.length){ const s2=document.createElement("span"); s2.className="tag booked"; s2.textContent="Res."; tags.appendChild(s2); }
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
function renderSlots(){
  const box = document.getElementById("slots");
  const info = document.getElementById("selectionInfo");
  box.innerHTML = "";
  if(!state.selectedDate){ info.textContent="Selecciona una fecha en el calendario."; disableActions(); return; }
  const all = generateSlots(state.config);
  const blocked = new Set(state.blocks[state.selectedDate]||[]);
  const booked = new Set(state.booked[state.selectedDate]||[]);

  all.forEach(hm=>{
    const b = document.createElement("button");
    b.type="button"; b.className="slot"; b.textContent=hm;
    if(blocked.has(hm)) b.classList.add("blocked");
    else if(booked.has(hm)) b.classList.add("booked");
    else b.classList.add("free");

    b.addEventListener("click", ()=>{
      if(b.classList.contains("blocked") || b.classList.contains("booked")) return;
      state.selectedTime = hm;
      document.querySelectorAll(".slot").forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");
      info.textContent = `Seleccionado: ${state.selectedDate} — ${hm}`;
      enableActions();
    });

    box.appendChild(b);
  });
}
function disableActions(){ document.getElementById("sendWhatsApp").disabled = true; document.getElementById("markBooked").disabled = true; }
function enableActions(){ document.getElementById("sendWhatsApp").disabled = false; document.getElementById("markBooked").disabled = false; }
function clearSelection(){ state.selectedDate=null; state.selectedTime=null; document.getElementById("slots").innerHTML=""; document.getElementById("selectionInfo").textContent="Selecciona una fecha y hora."; disableActions(); }

function sendWhatsApp(){
  const name = document.getElementById("name").value.trim();
  const clientPhone = document.getElementById("clientPhone").value.trim();
  const notes = document.getElementById("notes").value.trim();
  if(!state.selectedDate || !state.selectedTime) return alert("Selecciona fecha y hora.");
  if(!name) return alert("Escribe el nombre del cliente.");

  const d = new Date(state.selectedDate + "T" + state.selectedTime + ":00");
  const when = d.toLocaleString("es-PR", { dateStyle:"full", timeStyle:"short" });

  const msg =
`*Nueva solicitud de cita* — ${getConfig().BUSINESS_NAME}
• Cliente: ${name}
• Teléfono: ${clientPhone || "N/D"}
• Fecha y hora: ${when}
• Nota: ${notes || "N/D"}
• Confirmar disponibilidad: ${state.selectedDate} ${state.selectedTime}`;

  const phone = getConfig().BUSINESS_PHONE.replace(/\D/g,"");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,"_blank");
}

function markAsBooked(){
  if(!state.selectedDate || !state.selectedTime) return alert("Selecciona fecha y hora.");
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("clientPhone").value.trim();
  const notes = document.getElementById("notes").value.trim();
  if(!name) return alert("Escribe el nombre del cliente.");

  const booked = getBooked();
  const arr = booked[state.selectedDate] || [];
  if(!arr.includes(state.selectedTime)) arr.push(state.selectedTime);
  booked[state.selectedDate] = arr; saveBooked(booked);

  const bookings = getBookings();
  const list = bookings[state.selectedDate] || [];
  list.push({ time: state.selectedTime, name, phone, notes, createdAt: new Date().toISOString() });
  list.sort((a,b)=> parseHM(a.time)-parseHM(b.time));
  bookings[state.selectedDate] = list; saveBookings(bookings);

  // refrescar cache local
  state.booked = booked; state.bookings = bookings;
  renderSlots(); renderCalendar();
  alert("Reserva registrada.");
}
