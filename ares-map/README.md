# ARES MAP · prototipo conceptual

Mapa de exploración de Marte para una caminata en superficie, hecho para **NASA Space Apps 2026**.
Es una **demostración de la idea**, no un producto: mezcla datos reales de NASA con datos ilustrativos,
y cada dato muestra su fuente, fecha y nivel de confianza (insignia «T1 · …» / «ESTIMADO»).

```
npm install
npm run dev        # desarrollo
npm test           # 44 tests (terreno, rutas, blindaje, efemérides, datos)
npm run build && npm run preview   # versión con service worker (modo offline)
```

## Qué es real y qué es ilustrativo

| Real | Ilustrativo / conceptual |
|---|---|
| Imagen Viking (Trek), MOLA, relieve HRSC+MOLA, THEMIS (USGS) | Relieve del AOI (generado), pendiente, costo, blindaje, refugios |
| Trayectoria y waypoints de Curiosity (sol 5073) y Perseverance (sol 2022) | Alertas de clima espacial (esquema DONKI, valores inventados) |
| Distancia y latencia Tierra–Marte (validadas con JPL Horizons) | Tarjeta de protocolo, simulador de eventos, guantelete, IA médica |
| Línea base de radiación RAD en Gale | Parámetros de movilidad (supuestos sin calibrar) |

Los datos de un sitio nunca se muestran sobre el otro.

## Estructura

- `src/terrain`, `src/routing`, `src/safety`, `src/crew`: lógica pura, con tests en `tests/`.
- `src/ui`, `src/map`, `src/App.tsx`: interfaz.
- `src/data`: trayectorias reales (`scripts/build_rover_data.mjs`) y muestra de alertas.
- `docs/`: `DATA_NOTES.md` (endpoints probados), `ROUTING.md` (fórmulas), `DEMO.md`, `CREDITS.md`.
- Especificación: `../ARES_MAP_SPEC.md`.

## Límites conocidos

- El relieve del AOI es sintético; la trayectoria real se dibuja sobre él (hay un aviso en pantalla).
- Sin calibración con Jezero: los umbrales de movilidad figuran como «supuestos sin validar».
- Trek solo tiene tiles hasta el nivel 7 (≈ 325 m/px): la imagen base es borrosa a escala de caminata.
- Contenido de salud: varias entradas siguen «pendientes de fuente» y están etiquetadas así.
