# Foco

App de planeación diaria para gente que quiere organizar su día y trabajar enfocado. Cada nodo es una tarea (o un descanso) que se marca como hecha con un clic. Incluye un Pomodoro clásico (25/5/15) y navegación por días para revisar el historial.

Todo el estado vive en `localStorage`, así que no hay cuentas, servidores ni build. Abres `index.html` en el navegador y listo.

## Características

- **Nodos circulares** que representan tareas o descansos del día.
- **Pomodoro** clásico 25/5/15, con ciclos que sobreviven al refresh.
- **Historial por día**: navega con las flechas o el selector de fecha.
- **Modo oscuro y claro** (fondo negro profundo o crema).
- **Tipografía** Inter ExtraLight.
- **Cero dependencias**: HTML, CSS y JS vanilla.

## Uso

1. Abre `index.html` directamente en tu navegador (doble clic) o sírvelo con cualquier servidor estático:
   ```bash
   # con Python
   python -m http.server 8000

   # con Node
   npx serve
   ```
2. Crea un nodo con el botón `+ Nuevo nodo`.
3. Elige entre **Tarea** (trabajo) o **Descanso**.
4. Clic sobre el nodo para marcarlo como hecho. Doble clic sobre el título para renombrarlo.
5. Usa el Pomodoro de la esquina para enfocarte.

## Atajos

- **Clic en nodo** → marcar como hecho.
- **Doble clic en título** → renombrar.
- **Enter** → confirmar edición. **Esc** → cancelar.

## Estructura

```
habit-tracker/
├── index.html    # Marcado
├── styles.css    # Estilos y tokens de diseño
├── main.js       # Toda la lógica
└── README.md
```

## Deploy

Al ser 100% estática, puedes publicarla gratis en GitHub Pages, Netlify, Vercel, Cloudflare Pages, o cualquier hosting estático. No requiere build.

## Licencia

MIT.
