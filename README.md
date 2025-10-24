# Agenda PRO — 1 Empleado (HTML/CSS/JS)

App web 100% front-end para **GitHub Pages** que permite:
- Seleccionar **fecha y hora** por intervalos (ej. 60 min)
- **Bloquear horas** o **días completos** (modo Admin con PIN)
- **Marcar reservas** (evita doble cita)
- Enviar **solicitud por WhatsApp** con mensaje prellenado
- Guardado local en **localStorage** (sin backend)

## Demo local
1. Abre `index.html` en tu navegador.

## Publicar en GitHub Pages
1. Crea un repo y sube los 4 archivos.
2. En **Settings → Pages**, selecciona la rama (`main`) y carpeta `/root`.
3. Visita la URL que te da GitHub Pages.

## Configuración
- En la vista **Config**:
  - Número de WhatsApp del negocio (*solo dígitos*, ej. `17876643079`)
  - Nombre del negocio (aparece en el mensaje)
  - Horario laboral (inicio/fin) y duración de cita
- PIN de Admin por defecto: `1234` (cámbialo en `app.js` si quieres).

## Uso rápido
1. **Agenda**: elige un día → selecciona una hora libre → completa el formulario → **Enviar por WhatsApp**.
2. **Bloqueos** (Admin):
   - Entra con PIN → haz clic sobre horarios para bloquear/desbloquear.
   - Botones para bloquear/desbloquear **día completo**.
   - **Exportar/Importar JSON** de bloqueos y reservas.

## Estructura de datos en localStorage
- `ap_config`: configuración general.
- `ap_blockedSlots`: `{ "YYYY-MM-DD": ["09:00", "10:00"] }`
- `ap_bookedSlots`: `{ "YYYY-MM-DD": ["13:00"] }`

## Notas
- Horas marcadas como **Reservado** o **Bloqueado** no se pueden seleccionar.
- El envío abre `wa.me` en una pestaña nueva con el mensaje listo para enviar.
