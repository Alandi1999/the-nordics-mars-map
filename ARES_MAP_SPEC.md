# ARES MAP — Especificación técnica para Claude Code

> Proyecto: NASA Space Apps Challenge 2026 — "Mars Map" (mapa/herramienta para un astronauta en una caminata de exploración en Marte).
> Idioma de la UI y de los textos: **español** (con terminología técnica en inglés cuando corresponda). Idioma del código, commits y nombres de variables: **inglés**.
> Fecha de esta spec: 2026-11-14 (v1.2: estrategia multi-sitio, corrección sobre la geología de Gale, datos de salud y claims verificados contra fuentes, perfil de misión corta).
> Documento hermano: `SPEECH_EQUIPO.md` (material de presentación; **no** es para programar).

---

## 0. Cómo debe trabajar Claude Code con este documento

1. Trabajá **por fases** (sección 11). No avances a la siguiente sin cumplir los criterios de aceptación de la actual.
2. **Verificá cada endpoint antes de programar contra él** (`curl -I`, `GetCapabilities`, etc.). En la sección 5 cada fuente tiene un estado: `✔ verificado` (visto en documentación/búsqueda) o `⚠ verificar` (no confirmado: hay que probarlo). **No inventes endpoints, nombres de capas ni parámetros.** Si algo falla, documentalo en `docs/DATA_NOTES.md` y usá el fallback indicado.
3. Todo dato mostrado en la UI debe tener **fuente, fecha de adquisición y nivel de confianza** (ver sección 8 y la función F10).
4. Lo que sea una **estimación o un supuesto del equipo** debe estar etiquetado en la UI como tal ("estimado", "supuesto") y listado en la sección 12. No presentar supuestos como datos de NASA.
5. Mantené el MVP **estático y offline-first**: el mapa y la planificación de rutas deben funcionar sin red una vez cargados. Los servicios en la nube son opcionales (sección 6).
6. Antes de empezar, **preguntá al equipo** solo lo que esté en la sección 14 y no tenga default razonable. El resto, decidí y documentá la decisión.

---

## 1. Contexto y objetivo

El desafío pide crear un mapa, herramienta o interfaz que un astronauta pueda usar durante una exploración de superficie en Marte, usando datos y herramientas de NASA. Requisitos del enunciado que cubrimos:

- Definir **objetivo científico** y **ubicación** (sección 4).
- Combinar **al menos 3 tipos de datos** en capas (óptico, topográfico, térmico, espectral, atmosférico, radiación…). Plan: **óptico + topográfico + térmico + atmosférico + radiación**.
- Priorizar **seguridad del astronauta** (radiación, clima espacial, pendientes, obstáculos).
- Considerar la **movilidad con traje** y mostrar una **ruta** que evite obstáculos.

### Visión (del board de Miro "Nasa Space App")
**ARES — Autonomous Mars Exploration & Routing System**: sistema de mapas, navegación y evaluación de riesgos que **no depende de la Tierra** durante la caminata. Tres módulos conceptuales:

| Módulo | Qué es | Alcance en esta spec |
|---|---|---|
| **ARES MAP** | Mapa científico multicapa del sitio | **MVP completo** |
| **ARES NAV** | Planificación y replanificación de ruta, posicionamiento sin GPS | Ruta + replanificación sobre mapa de costo (MVP); posicionamiento inercial/visual = solo concepto/mock |
| **ARES SAFETY** | Riesgos: radiación, clima espacial, terreno, salud de la tripulación | Capa de refugio + alertas DONKI + panel Crew Status |

Concepto de dos componentes: (1) **centro de planificación** (prepara datos y rutas) y (2) **dispositivo portátil** (lleva todo almacenado localmente). La app web que construimos representa el **dispositivo portátil** (PWA offline) y su **pipeline offline de datos** representa el centro de planificación.

---

## 2. Decisiones tomadas

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Estrategia multi-sitio. Sitio principal: Gale Crater / Mount Sharp** (Curiosity). **Jezero = segundo sitio y banco de pruebas** (calibración/validación de peligros). **Arquitectura agnóstica al sitio**: un archivo `site.config.json` por sitio; cada sitio usa **sus propios datos**. | Gale tiene datos de radiación en superficie (RAD), terreno con gran relieve y el objetivo científico del propio enunciado (boxwork). Jezero tiene mapas de peligros y topografía fina para validar el modelo. Ver sección 4. |
| D7 | **Prohibido mezclar datos entre sitios**: nunca mostrar geología, topografía o peligros de un sitio sobre las coordenadas de otro. Lo que se comparte entre sitios son **métodos, parámetros calibrados y la tabla de clases de terreno**, no capas. | Son datos de lugares concretos; mezclarlos produciría información falsa para el astronauta. |
| D2 | **Objetivo científico:** exploración de la unidad con formaciones **boxwork** en Mount Sharp y evaluación de su accesibilidad/seguridad para una caminata. | Curiosity estudió el boxwork en 2025; hay imágenes y contexto. El enunciado lo menciona como ejemplo. |
| D3 | **Offline-first**: PWA estática + datos del área de interés (AOI) pre-procesados. | Latencia de 3–22 min por sentido; sin internet en Marte. |
| D4 | **Backend opcional** (Cloud Run / Cloudflare Workers) solo para: proxy de DONKI con API key, cache de clima. El MVP funciona sin backend con datos cacheados. | Menos dependencias, demo robusta. |
| D5 | **Ruta = algoritmo propio** (A* sobre mapa de costo derivado del DTM). No existe servicio de rutas para Marte. | — |
| D6 | **Cálculo de latencia Tierra–Marte offline** con efemérides (`astronomy-engine`), validado contra JPL Horizons. | No requiere red. |
| D8 | **Perfil de misión: estancia corta (clase oposición), 30–90 días en superficie.** Valor por defecto de la app: **30 sols** (con slider hasta 500 para explorar). | El board del equipo ya define misión corta; coincide con la referencia NASA de 30 sols. |

---

## 3. Datos verificados (usar estos valores en la app y en la presentación)

Correcciones a lo que figuraba en el board de Miro, con fuentes:

| Tema | Valor correcto | Fuente / nota |
|---|---|---|
| Latencia de comunicación (un sentido) | **≈ 3 min (mín.) a ≈ 22 min (máx.)**; ida y vuelta **≈ 6 a 44 min** | Mínima ≈ 3 min 2 s a 54,6 M km; máxima ≈ 22 min 17 s a 401 M km (newspaceeconomy.ca, abr-2026; aerospaceweb.org). |
| Distancia Tierra–Marte | **54,6 M km (mín. teórica) a ≈ 401 M km (máx.)**. El valor medio (~225 M km) es un promedio aritmético; **no** corresponde a la latencia máxima. Con ~225 M km la latencia es ≈ 12,5 min por sentido / ≈ 25 min ida y vuelta. | Idem. En el board, "225 millones km … hasta 44 min" mezclaba el promedio de distancia con la latencia máxima. |
| Gravedad en Marte | **≈ 3,71 m/s² ≈ 0,38 g.** Es una **fracción de la gravedad terrestre**, no un porcentaje de pérdida ósea. | El "38 % de pérdida ósea" del board es un error de interpretación. |
| Pérdida ósea | **✔ Verificado:** en promedio **1–1,5 % de la densidad mineral ósea por mes** en sitios de carga, en misiones de 4–6 meses en microgravedad. **No se sabe** si la gravedad fraccionada (0,38 g) la reduce, ni si la pérdida se estabiliza con el tiempo. No existe un valor "% por gravedad". | NASA HRP, "Risk of Spaceflight-Induced Bone Changes" y Evidence Report (NTRS 20170004597, 2017). |
| Clase de misión | **Opposition class = estancia corta** (típicamente ~30–90 sols en superficie; viaje redondo total ≈ 550–660 días, a veces con sobrevuelo de Venus). **Conjunction class = estancia larga** (hasta ~500–550 sols en superficie; viaje redondo ≈ 900–1000 días). El board decía "clase conjunción o de corta estancia": **son opuestos**. | NASA NTRS (Mars mission classes); decision package Mars Architecture. NASA usa como referencia una misión de superficie de **30 sols** (documento SAC21). |
| Tránsito | ≈ 180 días (≈ 6 meses) por sentido en trayectorias de baja energía (rango 6–9 meses según arquitectura). | NTRS / literatura de misiones. |
| Tiempo total en el espacio (oposición) | ≈ **1,5 años** entre ida y vuelta en una misión de estancia corta (30–90 días en superficie). | Landau & Longuski; Mars Journal 2007. |
| Abortar la misión | Existen opciones **solo antes de la captura en Marte** (trayectorias de retorno libre y de aborto propulsivo); un retorno libre implica ≈ 3 años de la salida al regreso. Una vez en Marte, la tripulación espera la ventana de retorno. **No** afirmar "el aborto es imposible". | Landau & Longuski (Georgia Tech / Mars Journal 2007). |
| Ejercicio como contramedida | En la ISS: bloques de **2,5 h, 6 días por semana** (1,5 h resistencia + 1 h aeróbico). Es cifra de **microgravedad**; para superficie marciana no hay un valor oficial. | NASA NTRS 20110016265; NASA ISS Exercise Countermeasures. |
| "Efecto del tercer cuarto" | **Evidencia mixta.** Una revisión (Kanas et al., 2021) concluye que hay poca evidencia de un efecto dependiente del tiempo en el espacio o en simulaciones. Presentarlo como "reportado en algunos análogos", no como regla. | Kanas, Gushin, Yusupova, *Aerosp Med Hum Perform* 92(8), 2021. |
| Sol marciano | **24 h 39 min 35 s** (≈ 24 h 39 min). | Valor estándar; RAD paper lo cita como 24 h 39 min. |
| Radiación en superficie (Gale) | Dosis equivalente GCR promedio **≈ 0,67 mSv/día** en superficie (ago-2012 a jun-2013) vs **≈ 1,8 mSv/día** dentro de la nave en tránsito. Medida por **RAD** en Curiosity (Hassler et al., Science 2014). Varía con el ciclo solar y con la presión atmosférica (altitud). | SwRI / Science 2014. Los valores son de un período concreto: etiquetarlo así. |
| DONKI y Marte | **DONKI sí sirve para Marte**: sus simulaciones **WSA-ENLIL+Cone** incluyen "Other Location(s) Impact" con **Marte** y hora estimada de llegada del choque (p. ej. "Mars … Minor Impact / Glancing Blow"). Son productos **experimentales**; el pronóstico oficial de EE. UU. es NOAA SWPC. | Páginas DONKI WSA-ENLIL (2023–2025). |
| Elevación | Gale (aterrizaje): **≈ −4,4 km** (MOLA). Jezero (aterrizaje): **−2.656 m**, 18,36° N / 77,59° E. | Hassler et al. 2014; JGR Planets 2023 (MEDA). |
| Planetary Computer (Microsoft) | Plataforma de datos **terrestres**. **No usar** para el mapa. | Revisión del catálogo. |

---

## 4. Comparación Gale vs Jezero

### 4.1 Tabla

| Criterio | **Gale (Curiosity)** | **Jezero (Perseverance)** |
|---|---|---|
| Ubicación / altitud | ≈ 4–5° S, 137° E; aterrizaje ≈ −4,4 km (MOLA) | ≈ 18,4° N, 77,5° E; aterrizaje −2.656 m |
| Objetivo científico natural | Mount Sharp (sedimentos en capas, sulfatos/arcillas), **boxwork** (estudiado 2025) | Delta fósil, muestras (cache), posible biofirmas |
| Relieve para rutas | **Muy alto** (montaña de varios km de espesor) → pendientes variadas, buen caso para costo de ruta | Cráter con delta, escarpes y campos de rocas; relieve moderado |
| Topografía fina | HiRISE DTM disponibles (p. ej. par PSP_001488_1750 sobre Gale); **ortofoto + DEM de la ciencia de MSL** en el PDS Imaging Node; base CTX+HRSC | **Mosaico DEM+ortofoto HiRISE del USGS** (≈ 5,3 GB, 18,135–18,588° N) y DTM del piso del cráter; mapa de **riesgos de la TRN** |
| Geología | **Mapeo detallado publicado**: 1:500 de los estratos inferiores de Aeolis Mons sobre HiRISE (Stack et al., GSA 2016); 7 unidades del Mount Sharp group por textura, mineralogía y propiedades térmicas (Fraeman et al. 2016); 1:60.000 del oeste de Aeolis Mons (Thomson et al., GSA 2023, en proceso de envío al USGS); Glen Torridon (Fedo et al. 2022). **⚠ Verificar si existen como polígonos GIS descargables** (si no, hay que georreferenciar y digitalizar, o usar el mapa global como respaldo grueso, ver 5.2b). | **Mapa fotogeológico 1:5.000** de Mars 2020 (Stack et al. 2020) sobre HiRISE 25 cm/px + DTM 1 m/px; USGS SIM 3464 → **polígonos de unidades**, ideal para capa de peligros/ciencia |
| Trayectoria del rover | Traza y waypoints de Curiosity (mapa "Where is Curiosity"; origen PLACES/PDS) | **`M20_waypoints.json`** ✔ (GeoJSON con sol por punto) |
| Clima in situ | **REMS** (temperatura aire/suelo, presión, humedad, UV) – PDS y feed JSON no documentado | **MEDA** (temp. a 3 alturas + suelo, presión, humedad, **RDS** flujo solar y polvo); datos en PDS; sensor de viento dañado por arena |
| **Radiación ionizante en superficie** | **✔ RAD** – única medición directa de dosis en superficie (GCR, SEP, blindaje del terreno) | ✘ No encontramos un detector de radiación ionizante equivalente. MEDA/RDS mide flujo solar y polvo, **no** dosis de partículas |
| Fotos / contexto visual | Catálogo enorme; "Experience Curiosity" en Trek; imágenes del boxwork | Catálogo muy grande (>107.000 imágenes raw) |
| Cobertura Trek (capas globales) | Capa "Experience Curiosity" | Mismas capas globales |
| Riesgos de terreno documentados | Rocas afiladas que aceleraron el desgaste de ruedas; **dunas oscuras** | Campos de rocas y escarpes cartografiados (TRN) |
| Encaje con el enunciado | **Ejemplo textual del desafío** (boxwork / Mount Sharp) | Muy buen sitio, pero sin dato de radiación |

### 4.2 Recomendación
**Gale como sitio principal**, por tres razones medibles: (1) es el único con **dosis de radiación medida in situ** (RAD) y estudios del **efecto de blindaje del terreno** (acantilados/colinas) → habilita la capa "zonas de refugio", central para seguridad; (2) el **relieve** de Mount Sharp hace que el mapa de costo y la ruta tengan resultados interesantes; (3) coincide con el ejemplo del enunciado.
**Jezero como segundo sitio y banco de pruebas**: aporta geología vectorial 1:5.000 ya publicada, mapas de peligros de la navegación de aterrizaje (TRN) y MEDA. **Corrección respecto de v1.0:** Gale **también** tiene mapeo geológico detallado (ver tabla); lo que no está confirmado es su disponibilidad como capa vectorial lista para usar. Como la app se diseña por `site.config.json`, cambiar de sitio = cambiar configuración + correr el pipeline.

### 4.3 Qué es reutilizable entre sitios (no depende de Gale/Jezero)
- Capas globales: **Trek WMTS** (Viking, MOLA, albedo TES…), **mosaico CTX de Murray Lab** (5 m/px, 88°S–88°N), **THEMIS IR día/noche** (WMS USGS).
- **STAC del USGS** (HiRISE DTM) y bucket AWS público.
- **DONKI** (clima espacial) y **efemérides** (latencia).
- Motor de ruta, mapa de costo, UI de capas, panel Crew Status, PWA, modelo de datos.

### 4.4 Estrategia multi-sitio: "lo mejor de cada uno" sin mezclar datos

**Lo que NO se hace:** copiar la topografía o la geología de Jezero y aplicarla sobre Gale (ver D7). Serían datos de otro lugar y el mapa mostraría terreno inexistente.

**Lo que SÍ se hace:**
1. **App de dos sitios, cada uno con sus mejores datos.** Gale: radiación medida (RAD), relieve de Mount Sharp, boxwork. Jezero: geología vectorial 1:5.000, mapas de peligros del aterrizaje (TRN), MEDA. Mismo motor, misma interfaz; el selector de sitio carga otra configuración.
2. **Jezero como banco de pruebas de peligros.** El USGS generó un mosaico DTM/ortoimagen HiRISE sobre el cual se cartografiaron los peligros de superficie para el aterrizaje de Mars 2020. Usar esa capa para **calibrar y validar** los umbrales de pendiente y rugosidad del mapa de costo: si el modelo marca bien lo ya cartografiado, se aplica a Gale con más confianza. Reportar métricas simples (p. ej. qué fracción de peligros cartografiados cae en celdas "precaución/prohibido"). Para Gale, usar como **casos de control** los peligros documentados: rocas afiladas que aceleraron el desgaste de las ruedas de Curiosity y campos de dunas oscuras.
3. **Tabla común "clase de terreno → riesgo"** (roca firme, regolito suelto, arena/dunas, escarpe, campo de rocas, cresta…) con multiplicadores de costo. Se define una vez en `config/terrain_classes.json`; lo que cambia por sitio es **qué polígonos pertenecen a cada clase**.
4. **Geología de Gale (en orden de preferencia):** (a) polígonos publicados si se encuentran descargables; (b) digitalizar/georreferenciar los mapas publicados para el AOI (trabajo manual, indicar error de georreferencia); (c) respaldo: mapa geológico global del USGS (5.2b), **solo como contexto**, no para planificar.
5. **Honestidad en la UI:** cada polígono de geología/peligro muestra su fuente, escala de mapeo y fecha (`DataMeta`).

---

## 5. Catálogo de fuentes de datos

Estado: ✔ = confirmado en documentación o búsqueda; ⚠ = **verificar con una petición real antes de usar**.

### 5.1 Imagen / base
| Fuente | Acceso | Estado |
|---|---|---|
| **NASA Trek – WMTS Mars** (global) | Plantilla: `https://trek.nasa.gov/tiles/Mars/EQ/{LayerId}/1.0.0/{Style}/{TileMatrixSet}/{z}/{row}/{col}.{jpg\|png}`. Ej. verificado: `https://trek.nasa.gov/tiles/Mars/EQ/Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/1/0/0.jpg`. Capabilities: `…/{LayerId}/1.0.0/WMTSCapabilities.xml`. Docs: `https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars`. Catálogo: `https://api.nasa.gov/mars-wmts/catalog`. **No adivinar `TileMatrixSet` ni extensión: leerlos del GetCapabilities.** Tile inexistente = sin cobertura. Proyección **equirectangular** (no Web Mercator). | ✔ patrón / ⚠ IDs de otras capas (MOLA, hillshade, TES, Curiosity) |
| **Murray Lab Global CTX Mosaic V01** (5 m/px, 99,5 % de Marte, equirectangular, uso libre) | Tiles GeoTIFF 4°×4° sin comprimir: `https://murray-lab.caltech.edu/CTX/V01/tiles/` · Página: `https://murray-lab.caltech.edu/CTX/` · Visor: `https://murray-lab.caltech.edu/CTX/V01/SceneView/3dViewer.html`. **Bajar solo los tiles del AOI, de a uno** (pide el laboratorio). | ✔ |
| **USGS WMS** (THEMIS IR día/noche, MDIM21, Viking) | `http://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map` capas `THEMIS_IR_Day`, `THEMIS_IR_Night`, `MDIM21`, `Viking_MDIM21`. Probar versión **https**. Pedir `GetCapabilities` primero. | ✔ / ⚠ https y CORS |
| **USGS WMS elevación MOLA** | `http://wms.wr.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl_elev.map` capa `MOLA_elev` | ✔ / ⚠ |
| **USGS WMS nomenclatura** | `http://wms.wr.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_nomen_wms.map` (el propio USGS avisa que puede fallar) | ⚠ |

### 5.2 Topografía
| Fuente | Acceso | Estado |
|---|---|---|
| **HiRISE DTM controlados (USGS/NASA)** | Bucket público: `aws s3 ls --no-sign-request s3://astrogeo-ard/mars/mro/hirise/controlled/dtm/` (us-west-2, COG). Catálogo STAC: `https://stac.astrogeology.usgs.gov/` (docs: `…/docs/data/mars/hirise_dtms/`). DTM de 1–2 m de espaciado; alturas sobre el geoide. Leer **por ventanas** con `rasterio`/GDAL `/vsis3/` (no descargar todo). | ✔ |
| **HiRISE DTM por observación** | Ej. Gale: `https://www.uahirise.org/dtm/PSP_001488_1750` | ✔ |
| **MOLA/HRSC blended DEM (200 m/px)** y **MOLA interpolado (463 m/px)** | `https://fdp.astrogeology.usgs.gov/fdp/mars/` (GeoTIFF/IMG) | ✔ |
| **Jezero HiRISE DEM+ortho mosaics (USGS, 5,3 GB)** | `https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic` · ScienceBase item `67a2a012d34e05baae1c87e7` · citar autores | ✔ |
| **Gale: ortofoto + DEM de la ciencia de MSL** | PDS Imaging Node / Analyst's Notebook de MSL (capas: ortomosaico, DEM, contornos, waypoints) | ⚠ ubicar URL exacta |
| **Jezero: DTM HiRISE para la navegación de aterrizaje (TRN) y mapa de peligros** | Mosaico DTM + ortoimagen del USGS sobre el que se cartografiaron peligros de superficie (ver fila anterior de Jezero). **Buscar la capa de peligros** (¿vectorial o raster?) en el mismo registro/ScienceBase. | ⚠ ubicar la capa de peligros |

### 5.2b Geología

| Fuente | Cobertura / escala | Acceso | Estado |
|---|---|---|---|
| **Mapa fotogeológico de Jezero (Stack et al. 2020, Space Sci. Rev.)** y **USGS SIM 3464** | Jezero, 1:5.000 sobre HiRISE 25 cm/px + DTM 1 m/px | Artículo en PMC (`PMC7116714`) y mapa USGS `https://pubs.usgs.gov/sim/3464/sim3464.pdf` (buscar los datos GIS asociados) | ✔ existe / ⚠ formato GIS |
| **Geología de Gale (varios)** | 1:500 estratos inferiores de Aeolis Mons (Stack et al. 2016); 7 unidades de lower Mount Sharp (Fraeman et al. 2016, JGR Planets 121); 1:60.000 oeste de Aeolis Mons (Thomson et al. 2023, en proceso de envío al USGS); Glen Torridon (Fedo et al. 2022, JGR Planets) | Publicaciones; revisar **material suplementario, USGS Publications Warehouse y Astropedia** por shapefiles | ✔ existe el mapeo / ⚠ vectores |
| **Mapa geológico global de Marte (USGS SIM 3292, Tanaka et al. 2014)** | Global, **1:20.000.000**, 44 unidades; solo contexto regional | `https://pubs.usgs.gov/sim/3292` · shapefiles en el paquete de datos (`SIM3292_Global_Geology`, campo `Unit`/`UnitDesc`); datos en proyección Robinson con el sistema Mars 2000 (esfera de radio 3.396.190 m), shapefiles exportados en grados decimales | ✔ |


### 5.3 Trayectorias, POIs, imágenes
| Fuente | Acceso | Estado |
|---|---|---|
| **Perseverance waypoints (GeoJSON)** | `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json` | ✔ |
| **Curiosity waypoints (GeoJSON)** | Probable análogo en `…/mmgis-maps/MSL/Layers/json/…` (el visor "Where is Curiosity" permite exportar GeoJSON). Fuente primaria: archivo PLACES en PDS. | ⚠ ubicar URL exacta |
| **PDS Imaging Atlas API** (imágenes por sol/instrumento) | `https://pds-imaging.jpl.nasa.gov/api/` (ver `…/tools/atlas/documentation/docs/api/data-access`) | ✔ |
| **Raw images mars.nasa.gov (feed JSON no oficial)** | Ej. `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json` (y `msl`) | ⚠ no documentado oficialmente |
| **NASA Mars Rover Photos API** (el board la cita en el stack) | `https://api.nasa.gov/mars-photos/api/v1/rovers/{rover}/photos`. La descripción oficial la limita a **Curiosity, Opportunity y Spirit** (no Perseverance); el repositorio original se **archivó en octubre de 2025**. **No usarla como fuente principal**; preferir PDS Imaging Atlas y dejar esta como fallback opcional. | ⚠ probar antes de usar |

### 5.4 Atmósfera / clima
| Fuente | Acceso | Estado |
|---|---|---|
| **Curiosity REMS** | PDS Atmospheres Node: `https://pdsatmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html` · Feed JSON no documentado: `https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json` | ✔ PDS / ⚠ feed |
| **Perseverance MEDA** | PDS (datos corregidos de TIRS; RDS **sin** corrección de polvo; viento degradado) | ✔ (ver nota) |
| **Fallback obligatorio** | Guardar una **serie de ejemplo** en `data/samples/weather_*.json` para que la demo funcione sin red | — |

### 5.5 Radiación / clima espacial
| Fuente | Acceso | Estado |
|---|---|---|
| **MSL/RAD** | Datos en PDS (dosis/dosis equivalente) y valores de referencia en literatura (Hassler 2014; Guo et al. 2021, doi 10.1007/s00159-021-00136-5). **Usar la dosis media como línea base, no como tiempo real.** | ✔ |
| **NASA DONKI** | `https://api.nasa.gov/DONKI/…` (endpoints a confirmar: `CME`, `CMEAnalysis`, `SEP`, `WSAEnlilSimulations`). Las simulaciones WSA-ENLIL traen **impacto en Marte** (`Mars … arrival time … Minor Impact / Glancing Blow`). API key gratuita en `https://api.nasa.gov` (`DEMO_KEY` tiene límite bajo). **Nunca exponer la key en el frontend**: pasar por proxy o usar JSON cacheado. | ⚠ parámetros y esquema |

### 5.6 Efemérides / latencia
| Fuente | Acceso | Estado |
|---|---|---|
| **astronomy-engine** (npm) | Cálculo **offline** de distancia Tierra–Marte → latencia = distancia / c | ✔ librería / ⚠ API exacta |
| **JPL Horizons API** | `https://ssd.jpl.nasa.gov/api/horizons.api` solo para **validar** el cálculo | ⚠ |

### 5.7 Herramientas de apoyo (no son APIs de la app)
- **JMARS (ASU):** exploración rápida de CTX, HiRISE, THEMIS, TES, CRISM, MOLA, HRSC.
- **CRISM (espectral):** PDS Geosciences (`https://pds-geosciences.wustl.edu/missions/mro/`). **Fuera del MVP**; opción "stretch".

---

## 6. Arquitectura

```
┌────────────── Centro de planificación (offline, en la PC del equipo) ──────────────┐
│ scripts/ (Python)                                                                 │
│  1 fetch_dtm.py    → recorta DTM del AOI (COG por ventana) + CTX/HiRISE            │
│  2 derive_terrain.py → pendiente, aspecto, rugosidad, hillshade, curvatura         │
│  3 shielding.py    → índice de blindaje (horizonte/sky-view) → dosis relativa      │
│  4 cost_grid.py    → mapa de costo + máscara de prohibido                          │
│  5 build_tiles.sh  → tiles XYZ/geodéticos de AOI (gdal2tiles) + COG                │
│  6 build_pois.py   → waypoints, targets, unidades geológicas → GeoJSON             │
└───────────────────────────────┬───────────────────────────────────────────────────┘
                                │  public/data/<site>/  (se versiona o se sube a Storage)
┌───────────────────────────────▼───────────────────────────────────────────────────┐
│ Dispositivo portátil = Web app (PWA, offline-first)                               │
│  Mapa (OpenLayers) · capas · ruta (A* en el navegador) · paneles · Service Worker │
└───────────────────────────────┬───────────────────────────────────────────────────┘
                                │ opcional, solo con red
                   ┌────────────▼────────────┐
                   │ Proxy (Cloud Run / CF   │  DONKI (key oculta) · cache de clima
                   │ Worker) + fallback JSON │
                   └─────────────────────────┘
```

**Stack propuesto (cambiar solo con justificación escrita):**
- Frontend: **TypeScript + Vite + OpenLayers** (soporta WMTS vía GetCapabilities, WMS y proyecciones personalizadas con `proj4`; el mapa de Trek es equirectangular). Alternativa aceptable: Leaflet con `L.CRS.EPSG4326`. **No usar Google Maps** (es solo terrestre). MapLibre solo si se re-proyecta todo el AOI a Web Mercator en el pipeline.
- UI: **Svelte o React** (el equipo elige; default React). Estilo: **modo oscuro de alto contraste, tipografía monoespaciada para telemetría** (estética de interfaz de misión).
- PWA: `vite-plugin-pwa` (precache de AOI y UI).
- Pipeline: **Python 3.11+** (`rasterio`, `numpy`, `scipy`, `scikit-image`, `pystac-client`, `shapely`, `geopandas`), **GDAL**.
- Ruta: A* propio en TS (binary heap) sobre la grilla; en Python usar `skimage.graph.route_through_array` solo para validar resultados.
- Despliegue estático: **GitHub Pages / Cloudflare Pages / Firebase Hosting**. Google Cloud (crédito de Space Apps: $300 por 90 días, requiere tarjeta) **solo** si se agrega el proxy o se alojan datos pesados en Cloud Storage; configurar **alerta de presupuesto** desde el primer día.

---

## 7. Funcionalidades (con criterios de aceptación)

> Prioridad: **P0** = MVP imprescindible · **P1** = importante · **P2** = si hay tiempo.

**F1 — Mapa base y gestor de capas (P0).**
Mapa de Marte con capas activables y opacidad ajustable: Trek (Viking/MOLA), CTX del AOI, HiRISE/ortofoto del AOI (si existe), THEMIS día/noche. Selector de sitio (Gale/Jezero) leído de `site.config.json`.
*Aceptación:* cambiar de sitio recentra el mapa y recarga capas; toggles funcionan; barra de escala y coordenadas (lat/lon planetocéntricas, longitud este positiva).

**F2 — Terreno (P0).**
Hillshade, pendiente (°), curvas de nivel, rugosidad. Al hacer clic: elevación, pendiente, aspecto, índice de rugosidad y **antigüedad/fuente** del dato.
*Aceptación:* popup con valores numéricos correctos vs. el raster; leyenda con unidades.

**F3 — Térmico y atmósfera (P0).**
THEMIS IR día/noche como capa; panel con **serie temporal de temperatura y presión** (REMS para Gale, MEDA para Jezero) desde JSON cacheado, con rango día/noche.
*Aceptación:* gráfico funciona offline con la muestra; etiqueta "dato de sol N / fecha".

**F4 — Puntos de interés y ciencia (P0).**
Capa de POIs: waypoints del rover, zona de boxwork, unidades geológicas, objetivos científicos. Popup con descripción, **por qué importa** (agua antigua, minerales, zona no explorada) y miniatura de imagen (P1, vía PDS Atlas, con fallback a imagen local).
*Aceptación:* ≥ 10 POIs con metadatos completos (fuente, fecha, confianza).

**F5 — Mapa de costo y peligros (P0).**
Capa que muestra costo/peligro: pendiente por tramos (cómodo / precaución / prohibido), rugosidad, zonas de exclusión (escarpes, dunas si se identifican, rocas grandes si hay dato). Parámetros en `config/mobility.json`.
*Aceptación:* leyenda clara; los valores límite son editables y se reflejan al recalcular; los parámetros por defecto provienen de `docs/CALIBRATION.md` (calibración con Jezero) y la UI indica si están **calibrados** o son **supuestos sin validar**.

**F6 — Planificador de ruta (P0).**
Elegir inicio y destino (clic o POI). A* sobre la grilla de costo. Mostrar: distancia, tiempo estimado (con supuestos), pendiente máxima, perfil de elevación, puntaje de riesgo. **Comparar 2–3 rutas** (más corta / más segura / con refugio cercano).
*Aceptación:* ruta no atraviesa celdas prohibidas; recalcular < 2 s en un AOI de ≈ 10×10 km a 10 m/celda en un portátil medio; funciona **sin red**.

**F6b — Replanificación local (P1).**
Botón **"Reportar peligro"**: el usuario marca un punto/polígono bloqueado → se agrega a la grilla → se recalcula la ruta → se **registra el incidente** (cola local `incidents.json`) para sincronizar con la Tierra cuando haya enlace. Es la escena del board ("terreno inestable no mapeado").
*Aceptación:* ruta alternativa no cruza la zona nueva; el incidente queda con fecha/hora, posición y fuente "observación local".

**F7 — Radiación y refugio (P0/P1).**
- **Capa estimada de blindaje del terreno** (índice de horizonte/sky-view-factor derivado del DTM) → "dosis relativa". Etiquetar **"estimado – ilustrativo"**.
- Línea base de dosis (RAD, ver sección 3) con fecha del período de medición.
- **Panel de alertas de clima espacial** con DONKI (CME / SEP / simulaciones con impacto en Marte). Si no hay red, mostrar el último JSON cacheado con su **antigüedad**.
- **Tarjeta de protocolo**: alerta → riesgo → acción (p. ej. "regresar al hábitat / buscar refugio en la zona X a N minutos").
*Aceptación:* la tarjeta de protocolo se dispara con un evento de muestra; la ruta "con refugio" prioriza trayectos cercanos a zonas de alto blindaje.

**F8 — Enlace Tierra–Marte (P1).**
Panel con distancia actual, latencia un sentido / ida y vuelta, y estado "sin respuesta de la Tierra en ≥ X min". Cálculo offline con efemérides, selector de fecha para explorar el rango 3–22 min.
*Aceptación:* para una fecha dada, coincide con JPL Horizons dentro de una tolerancia documentada.

**F9 — Crew Status / salud (P1).**
Slider de **sol de la misión** (1, 30, 90, 180, 500…) con riesgos y contramedidas desde `data/health.json` (NASA HRP; ICE: aislamiento/confinamiento/ambientes extremos). Incluye ritmo circadiano (sol = 24 h 39 min), fatiga, ejercicio de resistencia, radiación acumulada (**presupuesto de radiación** estimado), regolito/percloratos y polvo en esclusas. Botón **"Simular evento"** (fuga en esclusa, inhalación de polvo con percloratos, ansiedad por confinamiento, falla de ISRU → cancelar EVA, evento solar → refugio) → guía paso a paso. El contenido sale de `data/health.json`, cuyas entradas iniciales y estado de verificación están en el **Apéndice A**. Entradas con estado ⚠ se muestran con la etiqueta "pendiente de fuente" hasta completarse.
*Aceptación:* cada ítem del JSON tiene `source`, `confidence` y `last_reviewed`; ningún texto médico sin fuente.

**F10 — Frescura y confiabilidad del dato (P0, transversal).**
Cada dato/capa/POI muestra **fuente, fecha de adquisición, antigüedad, nivel de confianza y ubicación**, y se clasifica en los 3 niveles del board: (1) datos científicos previos, (2) observaciones locales, (3) información de la Tierra. Distinguir datos que envejecen despacio (topografía) de los que envejecen rápido (clima).
*Aceptación:* componente `<DataBadge />` reutilizado en todos los paneles; nada se muestra sin él.

**F11 — Offline-first (P0).**
Service Worker + precache del AOI. Indicador de estado de red ("ENLACE: SIN SEÑAL").
*Aceptación:* con la red desactivada, la app carga, muestra capas del AOI, calcula rutas y abre los paneles con datos cacheados.

**F12 — Interfaz tipo misión (P1).**
Modo oscuro, alto contraste, tipografía monoespaciada para telemetría, botones grandes (uso con guantes), códigos de alerta claros (color + forma + texto; no solo color).
*Aceptación:* contraste WCAG AA, objetivos táctiles ≥ 48 px, navegación por teclado.

**F13 — Dispositivo portátil ARES NAV (P2, mock).**
Vista compacta tipo "computadora de muñeca" que reutiliza el motor de ruta; posicionamiento **simulado** (inercial + comparación con mapa) con ruido configurable. **Aclaración visible:** concepto, no tecnología existente. (El Arduino/sensores físicos se plantea en una etapa posterior.)

---

## 8. Modelo de datos

```ts
// Metadatos obligatorios en todo dato mostrado
interface DataMeta {
  source: string;            // "MSL/RAD (Hassler et al., 2014)"
  sourceUrl?: string;
  acquiredAt: string;        // ISO-8601 o "sol:1234"
  retrievedAt: string;       // cuándo lo bajamos
  tier: 1 | 2 | 3;           // 1 previo · 2 observación local · 3 info de la Tierra
  confidence: "high" | "medium" | "low" | "estimated";
  shelfLife: "slow" | "medium" | "fast"; // topografía / geología / clima
  notes?: string;
}

interface Poi {
  id: string;
  name: string;
  kind: "waypoint" | "science" | "hazard" | "habitat" | "shelter" | "landmark";
  lonlat: [number, number];  // lon este positiva, lat planetocéntrica
  elevation_m?: number;
  description_es: string;
  whyItMatters_es?: string;
  images?: { url: string; caption: string; credit: string }[];
  meta: DataMeta;
}

interface SiteConfig {
  id: "gale" | "jezero";
  name: string;
  center: [number, number];
  aoiBBox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  cellSize_m: number;                          // default 10
  layers: LayerDef[];
  dataPaths: { dtm: string; slope: string; cost: string; shielding: string; pois: string; weather: string };
}

interface MobilityConfig {           // SUPUESTOS del equipo, editables (ver sección 12)
  walkSpeed_kmh: number;             // default 2.5 en plano
  slopeComfort_deg: number;          // default 10
  slopeCaution_deg: number;          // default 20
  slopeNoGo_deg: number;             // default 25
  roughnessPenalty: number;
  hazardMultiplier: Record<string, number>;
}

interface Incident {
  id: string; createdAt: string; lonlat: [number, number];
  type: "unstable_ground" | "blocked" | "dust" | "other"; note?: string;
  tier: 2; syncedToEarth: boolean;
}
```

**Costo de celda (inicial, editable):**
`cost = dist × (1 + a·slope² + b·roughness) × hazardMultiplier`, con **celdas prohibidas** si `slope > slopeNoGo` o están en máscara de exclusión. Documentar la fórmula en `docs/ROUTING.md` y exponer `a`, `b` en `mobility.json`.

**Índice de blindaje (estimado):** a partir del DTM, calcular fracción de cielo visible (sky-view factor) o ángulo de horizonte por celda; `doseRelative = f(1 − blockedSkyFraction)` normalizado a 1 en terreno abierto. Calibrar la escala con la línea base de RAD. **Etiquetar siempre como estimación.**

---

## 9. Pipeline offline de datos (scripts)

1. `fetch_dtm.py --site gale`: buscar en STAC los DTM HiRISE que intersecan el AOI; leer por ventana (COG); si no hay cobertura suficiente, caer a **HRSC/MOLA 200 m** y avisar la pérdida de resolución. Guardar en `data/raw/` (ignorado por git).
2. `derive_terrain.py`: pendiente, aspecto, rugosidad, hillshade, contornos (`gdaldem`, `numpy`).
3. `shielding.py`: ángulo de horizonte/sky-view factor.
4. `cost_grid.py`: grilla de costo y máscara; salida `cost.bin` (Float32) + `cost.json` (metadatos: bbox, tamaño, cellSize) para cargar en el navegador.
5. `build_tiles.sh`: ortofoto/CTX/hillshade → tiles (`gdal2tiles.py`, perfil **geodético** si se usa CRS equirectangular).
6. `build_pois.py`: waypoints (GeoJSON de rover) + objetivos científicos curados + unidades geológicas → `pois.geojson` con `DataMeta`.
7. `snapshot_weather.py` y `snapshot_donki.py`: guardan muestras en `public/data/<site>/` para el modo offline.
8. `calibrate_hazards.py --site jezero`: compara la capa de peligros cartografiada del aterrizaje de Mars 2020 con la clasificación del mapa de costo (pendiente/rugosidad) y ajusta/valida umbrales y parámetros `a`, `b`. Salida: `docs/CALIBRATION.md` con métricas y los parámetros resultantes en `config/mobility.json`. Luego `--site gale` aplica los mismos parámetros y verifica los casos de control (rocas afiladas, dunas).
9. `geology_to_hazard.py --site <id>`: convierte polígonos de unidades geológicas a **clases de terreno** con `config/terrain_classes.json` y genera la capa de peligros por geología del sitio.

Reglas: **todo script imprime fuente y fecha de descarga**, es idempotente y registra versiones en `docs/DATA_NOTES.md`.

---

## 10. Estructura del repositorio

```
ares-map/
├─ README.md
├─ docs/
│  ├─ SPEC.md                 (este documento)
│  ├─ DATA_NOTES.md           (endpoints probados, fallos, decisiones)
│  ├─ ROUTING.md              (fórmula de costo, supuestos)
│  ├─ CALIBRATION.md          (calibración de peligros con Jezero, métricas)
│  └─ CREDITS.md
├─ config/
│  ├─ sites/gale.json · jezero.json
│  ├─ mobility.json
│  └─ terrain_classes.json    (clase de terreno → riesgo/multiplicador, común a ambos sitios)
├─ scripts/                   (pipeline Python, sección 9)
├─ data/
│  ├─ raw/                    (no versionar)
│  ├─ samples/                (weather, donki, health de ejemplo — sí versionar)
│  └─ health.json
├─ public/data/<site>/        (tiles, cost.bin, pois.geojson, weather.json…)
├─ src/
│  ├─ map/        (OpenLayers, capas, proyecciones)
│  ├─ routing/    (A*, grilla, incidentes)
│  ├─ panels/     (Terrain, Weather, Radiation, Link, Crew, Poi)
│  ├─ lib/        (ephemeris, dataMeta, i18n)
│  └─ ui/         (DataBadge, Legend, tema)
├─ worker/ (opcional)         (proxy DONKI + cache)
└─ tests/
```

---

## 11. Plan por fases

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **P0 — Sondeo de datos** | Probar cada endpoint ⚠ de la sección 5; descargar AOI de Gale (≈ 10×10 km alrededor de la zona boxwork/Mount Sharp; definir bbox con los waypoints reales de Curiosity). Escribir `DATA_NOTES.md`. **Además:** (a) verificar si los mapas geológicos de Gale (5.2b) existen como polígonos descargables; (b) ubicar la capa de peligros de Jezero (TRN). | Tabla de endpoints con estado real (OK / falla / fallback) |
| **P1 — Mapa base** | Vite + TS + OpenLayers; capas Trek + CTX + THEMIS; `site.config.json`; `DataBadge`. | F1 y F10 cumplidos |
| **P2 — Terreno + costo** | Pipeline 1–4; capas hillshade/pendiente/costo; popup de clic. **Calibración con Jezero** (paso 8) si P0 confirmó la capa de peligros. | F2 y F5 cumplidos; `CALIBRATION.md` con métricas (o nota de que no hubo datos) |
| **P3 — Rutas** | A* en navegador, comparación de rutas, perfil de elevación. | F6 cumplido (< 2 s, offline) |
| **P4 — Seguridad** | Blindaje, DONKI (con proxy o cache), tarjetas de protocolo, panel de enlace, replanificación con incidente. | F6b, F7, F8 |
| **P5 — Salud y presentación** | Crew Status, simulador de eventos, PWA completa, pulido visual, guion de demo. | F9, F11, F12; demo de 3 min sin red |
| **P6 — Opcional** | Jezero como segundo sitio, CRISM, ARES NAV (mock), fotos del rover. Capa de **recursos (hielo/agua)** de la "Capa 1" del board (**⚠ la fuente de datos está sin buscar**). Clasificación de rocas a bordo, estilo AEGIS (mock, etiquetado como concepto). | — |

**Guion de demo sugerido (3 min):** (1) problema: latencia 6–44 min ida y vuelta → autonomía; (2) mapa multicapa de Gale; (3) planificar caminata A→B comparando rutas; (4) alerta DONKI → refugio; (5) "Reportar peligro" → replanifica; (6) Crew Status en el sol 30; (7) modo avión.

---

## 12. Supuestos y límites (decirlos en la presentación)

- **Parámetros de movilidad** (velocidad de caminata, umbrales de pendiente 10°/20°/25°, penalizaciones): **supuestos del equipo, no datos de NASA.** Validar con literatura de operaciones de EVA (p. ej. NASA SAC21 Surface Ops) antes de afirmar rigor.
- **Capa de blindaje de radiación**: modelo **simplificado** basado en geometría del terreno; no sustituye transporte de radiación real. La dosis base es una **media histórica** de RAD, no un valor en tiempo real; cambia con el ciclo solar.
- **Rocas y obstáculos finos** (< 1 m): el DTM no los resuelve; usar rugosidad como proxy y decirlo. Un mapa de rocas por imagen sería trabajo futuro.
- **Calibración con Jezero:** valida el método en un lugar con peligros ya cartografiados; **no garantiza** que los umbrales sean exactos en Gale (distinta geología, dunas, estratos). Presentarlo como "validación parcial".
- **Geología de Gale:** si se digitaliza a mano desde publicaciones, declarar el error de georreferencia y la escala de mapeo original (1:500, 1:60.000, etc.). El mapa global (1:20.000.000) **no sirve** para decisiones a escala de caminata.
- **Nunca** mostrar datos de un sitio sobre otro (D7).
- **DONKI**: productos experimentales de NASA; no es el pronóstico oficial. Un evento solar detectado **no implica impacto en Marte**: usar solo las simulaciones/estimaciones que incluyen Marte y mostrar su incertidumbre (p. ej. "glancing blow / minor impact").
- **Clima**: Perseverance tiene el sensor de viento degradado; las lecturas de RDS de MEDA no están corregidas por polvo en el PDS. REMS/MEDA son mediciones en el sitio del rover, no en todo el AOI.
- **Posicionamiento sin GPS**: no existe un GPS marciano; ARES NAV es **concepto**. Cualquier simulación debe decir "simulado".
- Todo texto médico (salud física y mental) debe citar la fuente de NASA HRP / análogos (HERA, HI-SEAS, Mars-500) y no constituye consejo médico.
- **Pérdida ósea en superficie:** el 1–1,5 %/mes es de microgravedad; en 0,38 g no está determinada. No presentar la cifra como válida para Marte.
- **"Tercer cuarto":** evidencia mixta; no usarlo como regla ni como predicción.
- **Disposición de restos / protección planetaria:** no se encontró una norma COSPAR específica sobre enterrar tripulantes; solo el marco general (la tripulación es una fuente de contaminación mucho mayor que los robots y los sistemas tripulados no son sellados). No afirmar "está prohibido por COSPAR".
- **IA y cómputo en el borde:** AEGIS, RAD750, IVGEN, Spaceborne Computer-2 y CIMON existen y están citados en el Apéndice B. **CIMON usa la nube de IBM**, por lo que no es un modelo de dispositivo offline. La IA de voz de HRP/HERA predice cohesión/rendimiento de equipo; **no** diagnostica depresión. Cualquier "recomendador" de salud mental en la app es **concepto**, no un producto validado.
- **"Retorno libre":** ver sección 3; no decir que el aborto es imposible.

---

## 13. Créditos y licencias

- **Murray Lab (Caltech):** el laboratorio permite el uso libre de la versión V01 del mosaico CTX. Crédito: "NASA/JPL-Caltech/MSSS/The Murray Lab". Citar: Dickson, Ehlmann, Kerber, Fassett (2024), *Earth and Space Science* 11(7), doi:10.1029/2024EA003555.
- **NASA/JPL, USGS Astrogeology, PDS:** datos públicos; **citar a los autores** de cada producto (el USGS lo solicita en los DTM de Jezero). Imágenes: "NASA/JPL-Caltech/…".
- **HiRISE:** NASA/JPL-Caltech/UArizona.
- Mantener `docs/CREDITS.md` con cada fuente, URL, fecha de descarga y licencia.

---

## 14. Preguntas abiertas para el equipo

1. ¿Confirmamos **Gale** como sitio principal y **boxwork** como objetivo científico? (default: sí).
2. ¿Framework de UI preferido (React / Svelte)? (default: React).
3. ¿Quién del equipo reclama el crédito de Google Cloud y tiene tarjeta? ¿Hace falta backend o alcanza con estático + cache? (default: estático + JSON cacheado; proxy opcional).
4. ~~¿Qué duración de misión asumimos?~~ **Resuelto (D8):** estancia corta, 30–90 días; default 30 sols, slider hasta 500.
5. ¿Idioma de la demo: español o inglés? (el jurado de Space Apps es internacional; default: español con modo EN como P2).
6. Datos de **salud**: ¿qué fuentes citará el equipo (NASA HRP, OSDR, etc.)? Falta completar `data/health.json` con referencias.
7. **Geología de Gale:** si los polígonos publicados no están descargables, ¿el equipo acepta digitalizar a mano el AOI (más trabajo, con error declarado) o preferimos mostrar solo el mapa global como contexto? (default: intentar descargar; si no, digitalizar solo 1 mapa del AOI y marcar el error).

---

## Apéndice A — Contenido inicial de `data/health.json`

Cada entrada debe tener `id`, `title_es`, `text_es`, `source`, `confidence` (`high` | `medium` | `low`), `last_reviewed`, `applies_to` (`transit` | `surface` | `both`) y, si corresponde, `countermeasure_es`. **Estado de la fuente:** ✔ = verificada en la revisión de 2026-11-14; ⚠ = viene del board del equipo y **falta citar una fuente primaria** antes de mostrarse como hecho.

| id | Tema | Contenido resumido | Fuente / estado |
|---|---|---|---|
| `bone-loss` | Pérdida ósea | 1–1,5 %/mes en sitios de carga en misiones de 4–6 meses en microgravedad; en 0,38 g, no determinada | ✔ NASA HRP (NTRS 20170004597) |
| `exercise` | Ejercicio | ISS: 2,5 h × 6 días/semana; no hay valor oficial para superficie | ✔ NASA NTRS 20110016265 |
| `third-quarter` | Cohesión y tercer cuarto | Reportado en algunos análogos; evidencia mixta | ✔ Kanas et al. 2021 |
| `ice-environments` | ICE | Isolated, Confined, Extreme: marco de HRP para riesgos psicológicos/de equipo | ⚠ citar página HRP |
| `sans` | SANS (visión) | Redistribución de fluidos y deterioro de la agudeza visual en tránsito | ⚠ citar HRP "Risk of SANS" |
| `orthostatic` | Ortostatismo al llegar | Caída de presión arterial al ponerse de pie tras la microgravedad; desorientación vestibular | ⚠ citar HRP |
| `radiation-budget` | Presupuesto de radiación | GCR y SEP; línea base medida en superficie por RAD (≈ 0,67 mSv/día, Gale 2012–2013) | ✔ RAD (Hassler 2014); ⚠ límite de carrera de NASA |
| `circadian` | Ritmo circadiano | Sol = 24 h 39 min 35 s; contramedidas de luz | ✔ valor del sol; ⚠ contramedida a citar |
| `perchlorates` | Percloratos en regolito | Sales oxidantes; riesgo endocrino; evitar ingreso por esclusas | ⚠ citar fuente (Phoenix/MSL) |
| `dust-abrasion` | Polvo abrasivo | Degrada trajes y sellos; control en esclusa | ⚠ citar fuente |
| `safe-haven` | Refugio ante evento solar | Confinarse en zona blindada (agua/provisiones) hasta que baje el flujo | ⚠ citar fuente de arquitectura |
| `pressure-breach` | Brecha de presión | Sellar módulo; traje de emergencia presurizado accesible (**sin** cifra de segundos) | ⚠ citar fuente |
| `isru-failure` | Falla de ISRU | Pasar a soporte vital de emergencia, cancelar EVA, racionar consumibles | ⚠ citar fuente |
| `iv-fluid` | Suero in situ | IVGEN (demo ISS 2010) genera fluido IV desde agua potable; IVGEN Mini en pruebas en 2026 | ✔ NASA NTRS (IVGEN Mini) |
| `crisis-psych` | Crisis psicológica | Relevar de EVA, línea de sucesión, descanso forzado | ⚠ citar; **no** presentar como protocolo oficial |
| `medical-ai` | IA médica / telemedicina asíncrona | Guía asistida y manuales interactivos; la latencia de 6–44 min impide la consulta en tiempo real | ⚠ citar; concepto |

---

## Apéndice B — IA y cómputo en el borde (contraste con la NASA, verificado)

| Tema | Qué hace la NASA hoy | Fuente |
|---|---|---|
| Selección autónoma de blancos | **AEGIS**: opera en Curiosity (ChemCam, desde 2016) y en Perseverance (SuperCam, desde 2022); en Curiosity eligió el material deseado > 93 % de las veces vs 24 % sin selección a bordo | JPL AI; NASA NTRS 20220001538 |
| Procesador | **RAD750**: variante endurecida del PowerPC 750 (diseño de 1997–98), ~200 MHz; usado en Curiosity y Perseverance | NASA/BAE; prensa técnica |
| Edge en la ISS | **Spaceborne Computer-2 (HPE)**, instalado en mayo de 2021, 24 experimentos en menos de un año; ej.: 1,8 GB de ADN → 92 KB en 2 s | HPE; Network World |
| Fluido IV in situ | **IVGEN** (2010, ISS) y **IVGEN Mini** (2026) | NASA NTRS |
| Asistente con IA | **CIMON** (DLR, Airbus, IBM, ESA): vuela en la ISS desde 2018; CIMON-2 con análisis lingüístico de emociones. **Usa la nube de IBM** | DLR; Airbus; Computer Weekly |
| Monitoreo de equipo por voz | HRP financia IA de voz para predecir cohesión/rendimiento de equipo (HERA); no diagnostica depresión | NASA NTRS 20260002431, 20260005849 |
| Gestión de fallas | **ACAWS** (detección de anomalías + aislamiento + efectos) y demostración de gestión de sistemas del Gateway | NASA NTRS 20140010520; NASA |
