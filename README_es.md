<div align="center">

# 🚀 Termux ARM64 Co-Processor & Database Offloading Engine
### *Transforma cualquier smartphone Android en un co-procesador físico ARM y servidor PostgreSQL dedicado para Windows 11*

<p>
  🌐 <b>Idioma / Language:</b> <a href="README.md">English</a> • <b>Español</b>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20Android%20Termux-blue.svg)](https://termux.dev)
[![Architecture](https://img.shields.io/badge/Architecture-ARM64%20aarch64-green.svg)](https://github.com)
[![Engine](https://img.shields.io/badge/Engine-PostgreSQL%2018.2%20%7C%20Node.js-informational.svg)](https://www.postgresql.org)
[![Connection](https://img.shields.io/badge/Connection-USB%20ADB%20%7C%20Wireless%20WiFi-orange.svg)](https://developer.android.com/tools/adb)

> **Diseñado y desarrollado por:** [Marcos Bazán](https://github.com/zeus300)  
> **Comunidad:** Aporte libre de código abierto para desarrolladores

</div>

---

## 🌟 ¿Qué es este proyecto y por qué es único?

La mayoría de programadores en laptops ligeras o PCs de desarrollo sufren un problema común: abrir **Docker Desktop** o levantar servicios de base de datos locales como **PostgreSQL** consume **entre 2 y 4.5 GB de memoria RAM** y genera calor continuo en la laptop.

Por otro lado, casi todos tenemos un **smartphone Android** (actual o en desuso) con un procesador de **4, 6 u 8 núcleos ARM (Snapdragon / MediaTek)** y **4 a 8 GB de RAM** completamente desaprovechados.

**Este proyecto es un puente de cómputo híbrido y distribuido** que convierte tu teléfono Android con Termux en:
1. **Un servidor de base de datos PostgreSQL 18.2 nativo dedicado:** 100% de la carga de base de datos ocurre físicamente en el chip ARM del móvil. En tu PC con Windows el consumo de RAM es **0 MB** y el de CPU es **0%**.
2. **Un Co-Procesador ARM64 de tareas secundarias:** Delega scripts pesados de Node.js, cálculos matemáticos, linters o transformaciones de datos directamente a los núcleos del celular con un simple comando (`termux-exec script.js`).
3. **Monitor en tiempo real con Failover inteligente:** Vigila la conexión en tiempo real; si desconectas el cable USB, la PC asume el modo contingencia sin congelarse, y en cuanto vuelves a enchufar el teléfono, **el móvil retoma el control automáticamente**.
4. **Asistente de primer inicio interactivo (Setup Wizard):** Diagnostica, guía al usuario paso a paso ante cualquier error de permisos o conexión, y admite tanto **Cable USB (<1ms de latencia)** como **WiFi Inalámbrico (Wireless ADB)**.

---

## 🏛️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                 LAPTOP (WINDOWS 11 / PC)                    │
│                                                             │
│   • Tus IDEs, VS Code, Navegador, Código Front/Backend       │
│   • CLI de Delegación: termux-exec.bat                      │
│   • Monitor y Vigilante de Failover: cluster-manager.js     │
│   • Consumo de RAM de la BD en Windows: 0 MB (0% CPU)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │  Socket ADB (Túnel Local de Red)    │
            │  • Opción 1: Cable USB (< 1ms)      │
            │  • Opción 2: WiFi Inalámbrico       │
            └──────────────────┬──────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│            SMARTPHONE ANDROID (TERMUX ARM64)                │
│                                                             │
│   • Micro-Worker de Cómputo: 127.0.0.1:7777 (Node.js ARM)   │
│   • Servidor Base de Datos:   127.0.0.1:5432 (Postgres 18.2)│
│   • 8 Núcleos ARM64 dedicados al procesamiento              │
│   • Alimentación eléctrica continua por el cable USB        │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Comparativa de Rendimiento

| Aspecto | Docker Desktop en Windows | PostgreSQL nativo en Windows | Co-Procesador Termux (Este Proyecto) |
| :--- | :---: | :---: | :---: |
| **Consumo de RAM en la PC** | 2.5 GB – 4.5 GB | 300 MB – 800 MB | **0 MB (Cero impacto en RAM)** |
| **Carga de CPU en la PC** | Media / Alta | Media | **0% (Delegado al móvil)** |
| **Temperatura / Ventiladores** | Se aceleran | Aumentan | **Totalmente silencioso y frío** |
| **Portabilidad de los datos** | Atado al disco de la PC | Atado a la PC | **Llevas la base de datos en tu bolsillo** |
| **Latencia de red** | Localhost | Localhost | **< 1 ms (Socket directo por USB)** |

---

## 📱 Hardware Compatible

- **Cualquier teléfono con Android 7.0 o superior** (Android 8, 9, 10, 11, 12, 13, 14, 15+).
- Probado exitosamente en chips **Snapdragon Octa-Core**, **MediaTek Helio/Dimensity** y **Samsung Exynos**.
- Memoria recomendada: Móviles con 2 GB, 3 GB, 4 GB, 6 GB u 8 GB de RAM.

---

## 🚀 Inicio Rápido en 3 Minutos

### 1. Requisitos Previos
1. **En la PC:** Tener instalado [Node.js](https://nodejs.org) (v18 o superior).
2. **En el Móvil:** Descargar e instalar la app **Termux** desde su fuente oficial:
   - 📦 [Descargar APK desde F-Droid (Recomendado)](https://f-droid.org/packages/com.termux/)
   - 📦 [Descargar APK desde GitHub Releases](https://github.com/termux/termux-app/releases/latest)
   *(⚠️ Nota: No descargues la versión de Google Play Store, ya que no recibe actualizaciones del repositorio de paquetes).*

### 2. Clonar el Repositorio
```bash
git clone https://github.com/zeus300/termux-coprocessor.git
cd termux-coprocessor
npm install
```

### 3. Ejecutar el Lanzador Inteligente
Simplemente haz doble clic en:
```cmd
iniciar.bat
```
*(O ejecuta `npm start` en tu terminal).*

Si es tu primera vez o si el teléfono no está conectado, se abrirá automáticamente el **Asistente Interactivo Guiado (Setup Wizard)**.

---

## 🧙‍♂️ El Asistente Interactivo (Setup Wizard)

El asistente (`setup-wizard.js` / `setup.bat`) resuelve todos los dolores de cabeza de configuración de manera asistida:

```
  ┌─ WIZARD DE VINCULACIÓN Y PUESTA A PUNTO ────────────────────────┐
  │  Convierte tu smartphone Android en un co-procesador y servidor │
  └─────────────────────────────────────────────────────────────────┘
```

1. **Auto-detección de ADB:** Verifica si tienes `adb` instalado; si no, te ofrece instrucciones para obtener las Platform-Tools.
2. **Selección del método de enlace:**
   - **Opción [1] Cable USB:** Plug & Play con latencia de 1 milisegundo y recarga continua de batería.
   - **Opción [2] WiFi / Depuración Inalámbrica:** Compatible con el protocolo de Android 11+ (Pairing Code de 6 dígitos + Segundo puerto de conexión).
3. **Resolución guiada de permisos (`unauthorized`):**
   - Si tu móvil requiere autorización, la consola te avisa:
     > *"Desbloquea tu pantalla. Marca la casilla 'Permitir siempre desde esta computadora' y pulsa Aceptar"*.
   - Al responder `yes` o presionar `Enter`, la consola relanza automáticamente la verificación en vivo.
4. **Verificación de Termux y Permisos:**
   - Detecta si la app de Termux está instalada en el móvil.
   - Envía o te muestra en pantalla el comando maestro de inicialización:
     ```bash
     pkg update -y && pkg install -y nodejs postgresql && termux-wake-lock
     ```
5. **Despliegue del Worker ARM y PostgreSQL:**
   - Transfiere automáticamente `worker.js` al home de Termux.
   - Aplica el mapeo de puertos (`adb forward tcp:7777 tcp:7777` y `adb forward tcp:5432 tcp:5432`).
6. **Benchmark en Vivo:**
   - Ejecuta una prueba matemática de números primos directamente en la CPU ARM del teléfono y te muestra en vivo el tiempo y la memoria consumida en el móvil.

---

## 🛠️ Cómo Utilizar el Sistema

### 1. Delegar Scripts y Comandos al Chip ARM
Usa el ejecutable `termux-exec`:

- **Ejecutar cualquier comando en el procesador del móvil:**
  ```cmd
  termux-exec "node -e 'console.log(process.arch)'"
  termux-exec "uname -a"
  ```

- **Enviar un archivo JS local para que se procese en la CPU del móvil:**
  ```cmd
  termux-exec script-pesado.js
  ```
  *(El script se transfiere en milisegundos, se ejecuta en los 8 núcleos ARM del teléfono y te devuelve el resultado en la consola de Windows con 0% de uso de CPU en tu laptop).*

### 2. Conectar tu Proyecto a PostgreSQL en el Móvil
Utiliza la cadena de conexión estándar en tu archivo `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public"
```

Compatible con:
- **ORMs:** Prisma, Drizzle, TypeORM, Sequelize.
- **Frameworks:** Next.js, Nuxt, NestJS, Express, FastAPI, Django, Laravel, Spring Boot.
- **Herramientas de escritorio:** DBeaver, TablePlus, pgAdmin.

### 3. Monitor de Conexiones en Tiempo Real
Para ver qué aplicaciones o clientes están conectados a tu base de datos:
```cmd
ver-conexiones.bat
```
*(O ejecuta `npm run connections`).*

---

## 🔄 Failover y Conmutación Inteligente

El monitor `cluster-manager.js` corre continuamente en segundo plano:
- **Si el cable USB está conectado:**
  El móvil procesa todas las solicitudes en su chip ARM64.
- **Si desconectas el cable USB:**
  El sistema detecta la extracción en menos de 2.5 segundos, libera el socket y activa el **Modo Contingencia PC** sin arrojar excepciones de bloqueo.
- **Si vuelves a conectar el cable:**
  Restaura los túneles ADB, reanuda los servicios en Termux y **el smartphone retoma el mando de forma 100% transparente**.

---

## 📂 Estructura del Repositorio

```
termux-coprocessor/
│
├── iniciar.bat              # Lanzador principal inteligente de 1-clic
├── setup.bat                # Acceso directo al Asistente de Configuración (Wizard)
├── setup-wizard.js          # Asistente interactivo guiado (USB y WiFi Wireless)
│
├── cluster-manager.js       # Demonio vigilante, monitor de CPU/RAM y failover en tiempo real
├── termux-exec.bat          # CLI de Windows para delegar comandos y scripts al móvil
├── termux-exec.js           # Cliente HTTP hacia el Worker ARM
├── worker.js                # Micro-servidor de ejecución distribuida para Termux
│
├── iniciar-postgres.bat     # Lanzador de PostgreSQL y monitor
├── ver-conexiones.bat       # Monitor de clientes SQL conectados
├── ver-conexiones.js        # Consulta en vivo a pg_stat_activity
├── adb-forward.ps1          # Script de redirección de puertos ADB
├── test-arm.js              # Script de prueba matemática de números primos
│
├── package.json             # Metadatos y scripts npm
├── LICENSE                  # Licencia MIT (Open Source)
├── README.md                # Documentación oficial en Inglés
└── README_es.md             # Documentación oficial en Español
```

---

## ❓ Preguntas Frecuentes (FAQ)

### ¿Android mata Termux si la pantalla se apaga?
No, siempre que actives `termux-wake-lock`. En el asistente de configuración se ejecuta automáticamente. Además, en los ajustes de tu móvil, desactiva la "Optimización de batería" para la app Termux.

### ¿Funciona si no tengo cable USB?
¡Sí! Puedes usar el modo **Conexión Inalámbrica (Wireless ADB)** incluido en el asistente. Solo asegúrate de que tu laptop y tu smartphone estén conectados a la misma red WiFi.

### ¿Puedo usar un teléfono antiguo con la pantalla rota?
¡Totalmente! Si el teléfono enciende y tiene depuración USB activa, puedes usarlo como un servidor de cómputo permanente conectado por USB a tu router o a tu laptop.

---

## 🤝 Contribuciones

¡Las contribuciones de la comunidad son bienvenidas!
1. Haz un Fork de este repositorio.
2. Crea una rama para tu función (`git checkout -b feature/nueva-mejora`).
3. Haz commit de tus cambios (`git commit -m 'Añade nueva funcionalidad'`).
4. Haz Push a la rama (`git push origin feature/nueva-mejora`).
5. Abre un **Pull Request**.

---

## 📜 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Puedes usarlo, modificarlo y compartirlo libremente. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

<div align="center">
  <b>¿Te resultó útil este proyecto? ¡Dale una ⭐ estrella en GitHub y compártelo con la comunidad!</b>
</div>
