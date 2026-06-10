# ParasitoLab · Atlas Interactivo de Parasitología 3D

Sitio web educativo y profesional sobre parasitología con **modelos 3D interactivos**
generados en tiempo real e **información clínica estructurada e interactiva**.

![Parásitos](https://img.shields.io/badge/Parásitos-8-blue) ![3D](https://img.shields.io/badge/WebGL-Three.js-success) ![Sin build](https://img.shields.io/badge/Build-no%20necesario-orange)

## ✨ Características

- **Visor 3D interactivo** (WebGL/Three.js): rota, acerca y desplaza cada parásito.
  Los modelos se construyen de forma **procedural** y **animada** para representar la
  morfología característica de cada organismo:
  - *Plasmodium* — trofozoíto en anillo dentro del glóbulo rojo
  - *Trypanosoma* — cuerpo fusiforme con membrana ondulante y flagelo
  - *Giardia* — la icónica forma de "cara" con sus 8 flagelos
  - *Entamoeba* — blob ameboide con pseudópodos y eritrocitos fagocitados
  - *Taenia* — escólex con ventosas/ganchos y cadena de proglótides
  - *Ascaris* — gusano cilíndrico que repta
  - *Leishmania* — promastigote con flagelo anterior
  - *Toxoplasma* — taquizoíto en media luna con complejo apical
- **Controles del visor**: rotación automática, zoom, restablecer, malla (wireframe) y
  pantalla completa.
- **Fichas clínicas con pestañas**: resumen, morfología, transmisión, síntomas,
  diagnóstico, tratamiento, prevención, taxonomía y distribución geográfica.
- **Ciclo de vida interactivo**: diagrama circular navegable paso a paso.
- **Atlas / catálogo** con tarjetas y nivel de riesgo.
- **Diseño responsivo** y accesible (respeta `prefers-reduced-motion`).
- **Degradación elegante**: si WebGL no está disponible, toda la información sigue
  accesible.

## 🚀 Cómo abrirlo

Como usa módulos ES, debe servirse por HTTP (no abrir el archivo con `file://`).

```bash
cd web
python3 -m http.server 8000
# luego abre http://localhost:8000
```

O con Node:

```bash
npx serve web
```

## 🗂️ Estructura

```
web/
├── index.html          # Estructura y secciones de la página
├── css/styles.css      # Estilos (tema oscuro científico, acento dinámico)
├── js/
│   ├── data.js         # Base de datos de parásitos (contenido científico)
│   ├── models3d.js     # Modelos 3D procedurales (Three.js)
│   └── app.js          # Interfaz dinámica + visor 3D
└── vendor/
    ├── three.module.js # Three.js alojado localmente (sin CDN en runtime)
    └── OrbitControls.js
```

## 🧰 Tecnología

- **Three.js** (r160) alojado localmente — sin dependencia de CDN en tiempo de ejecución.
- HTML + CSS + JavaScript (módulos ES). **Sin paso de compilación**.
- Tipografías *Sora* e *Inter* vía Google Fonts (con respaldo a fuentes del sistema).

## ⚠️ Nota educativa

El contenido tiene fines exclusivamente didácticos y de divulgación científica.
No sustituye el juicio clínico ni el diagnóstico profesional. Fuentes de referencia:
CDC (DPDx), OMS y manuales de parasitología médica.
