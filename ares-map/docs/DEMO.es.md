Versión en inglés: [DEMO.md](DEMO.md)

# Demo de 3 minutos

Preparación (una vez, con red):

```
npm run build && npm run preview     # el service worker solo existe en la versión compilada
```

Abrir la app, pestaña **Mapa** → **Preparar modo offline** (≈ 120 imágenes por sitio). Verificar que diga
"Service worker: activo".

| Tiempo | Pestaña | Qué mostrar | Frase clave |
|---|---|---|---|
| 0:00 | Enlace | Latencia de hoy y el gráfico 2025–2030. Mover el slider «sin respuesta». | «Entre 3 y 22 min por sentido: la Tierra no puede guiar una caminata.» |
| 0:25 | Mapa / Puntos | Gale con la trayectoria real de Curiosity (hasta sol 5073). Clic en un waypoint: ficha con fuente y fecha. | «Datos reales de NASA; cada dato dice de dónde viene y qué tan confiable es.» |
| 0:50 | Terreno | Pendiente, mapa de costo; mover los umbrales y ver el mapa recalcularse. Clic para sondear. | «El terreno del AOI es ilustrativo, y la app lo avisa.» |
| ~0:55 (opcional, 10 s) | Clima | Ciclo de temperatura y presión de un sol y el botón «Ver THEMIS de noche». | «Esta serie es inventada y está marcada; las capas térmicas THEMIS sí son reales.» |
| 1:15 | Ruta | **Ruta de ejemplo**: tres rutas (corta, segura, con refugio) y su perfil de elevación. | «El mejor camino no siempre es el más corto.» |
| 1:40 | Seguridad | Activar blindaje; simular un evento. Con A en el extremo SO, **moderado** da CÓDIGO ROJO (ningún refugio llega a tiempo, margen −28 min) y **menor** da verde. Tarjeta: código, cuenta regresiva, refugio y margen. | «Una alerta solar se traduce en una acción concreta.» |
| 2:05 | Ruta | **Reportar peligro** sobre la ruta; la ruta se recalcula sola. | «Si el terreno cambia, el plan cambia sin esperar a la Tierra.» |
| 2:25 | Equipo | Sol 30; simular «Fuga en la esclusa». Señalar las etiquetas «pendiente de fuente». | «Decimos qué sabemos y qué falta citar.» |
| 2:45 | Guante | Vista del guantelete: código, flecha, distancia. Subir el error de posición. | «Esto es el concepto que llevaría la tripulación: solo lo esencial.» |
| 2:55 | — | Modo avión y recargar. | «Todo sigue funcionando sin red.» |

## Antes de presentar (checklist)

- [ ] `npm run build` sin errores y `npm test` en verde.
- [ ] Versión compilada abierta con `npm run preview`, no `npm run dev`.
- [ ] «Preparar modo offline» ejecutado en **Gale y Jezero** (cambiar de sitio y repetir).
- [ ] Probar el modo avión con la pestaña ya cargada, **antes** de subir al escenario.
- [ ] Decir en voz alta: terreno, alertas, rutas y salud son **ilustrativos o conceptuales**.

## Lo que NO afirmar

- El guantelete, el posicionamiento sin GPS y la IA médica son **conceptos**, no tecnología existente.
- El relieve del AOI no es real; la trayectoria del rover, los waypoints, las efemérides y la línea base RAD sí.
- Las alertas de clima espacial son una muestra con el esquema de DONKI, no un pronóstico.
- Los umbrales de movilidad son supuestos del equipo, sin calibrar.
