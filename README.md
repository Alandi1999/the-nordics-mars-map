# Mars Map · NASA Space Apps 2026

Concepto de un mapa de exploración de Marte para una caminata en superficie, con un guantelete que lleva
solo lo esencial: mapa y alertas. Se presenta la idea; no hay hardware.

| Carpeta | Qué es |
|---|---|
| [`ares-map/`](ares-map/) | **Prototipo usable** (React + TypeScript + OpenLayers, PWA offline). Es la demo. |
| [`ARES_MAP_SPEC.md`](ARES_MAP_SPEC.md) | Especificación técnica de la que parte el prototipo. |
| [`crates/`](crates/), `Cargo.toml` | Prototipo en Rust del enlace satélite → hub → guantelete: tramas con CRC, cola por prioridad, ventanas de contacto. |
| [`earth/`](earth/) | Módulo en Go del lado Tierra (capas de datos). |
| [`firmware/glove/`](firmware/glove/) | Nota del firmware del guantelete (ESP32-C3), solo concepto. |

## Probar el mapa

```
cd ares-map
npm install
npm run dev
```

Más detalle, qué datos son reales y cuáles ilustrativos, y el guion de la demo: [`ares-map/README.md`](ares-map/README.md).

## Prototipo Rust

```
cargo test --workspace
```
