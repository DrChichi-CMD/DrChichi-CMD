# Proyector para Iglesia ⛪📽️

¡Bienvenido a **Proyector para Iglesia**! Esta es una aplicación web full-stack de alto rendimiento construida con **React, Vite, Tailwind CSS, TypeScript y Express**. Está específicamente optimizada para proyectar de forma dual e instantánea cantos, vídeos de fondo, textos dinámicos ("cintillos" o "leyendas") y cámaras IP/teléfonos inteligentes directamente a pantallas de proyección o televisores de tu iglesia.

---

## 🚀 Características Principales

- **Doble Pantalla Interactiva**: Se comunica de forma local instantánea sin retardo de red usando la tecnología `BroadcastChannel` del navegador.
- **Panel de Control Integrado**: Todo lo necesario para operar la proyección: catálogo de letras de canciones, listas de reproducción independientes (DOCKs), ajuste dinámico del tamaño de fuente, opacidad y velocidad.
- **Leyenda / Cintillo Dinámico**: Barra deslizante de texto interactiva con personalización al instante del color del texto, tamaño de letra, velocidad de movimiento e imagen de fondo.
- **Reproductor Multimedia y Transmisiones**: Admite transmisión de video en vivo (Live Broadcast) y reproducción en tiempo real.

---

## 🛠️ Requisitos Previos

Para ejecutar la aplicación localmente en tu computadora, asegúrate de tener instalado:

- **Node.js** (Versión 18 o superior recomendada)
- **npm** (Viene integrado al instalar Node.js)

Puedes descargar el instalador oficial de Node.js de forma gratuita desde:  
👉 **[https://nodejs.org/](https://nodejs.org/)**

---

## 📥 Cómo Exportar/Descargar este Proyecto desde AI Studio

Antes de poder instalarlo en tu PC, exporta el código desde el panel de control de Google AI Studio:

1. Ve al menú **Settings (Configuración)** en la esquina superior de tu pantalla de AI Studio.
2. Haz clic en **Download ZIP (Descargar código en ZIP)** para obtener un archivo comprimido de todo el proyecto, o selecciona **Export to GitHub** si prefieres clonarlo por terminal.
3. Descomprime ese archivo ZIP en una carpeta vacía de tu ordenador.

---

## ⚡ Instalación Automatizada (Recomendado)

Hemos creado instaladores interactivos para facilitarte la puesta en marcha. Solo debes ir a la carpeta del proyecto descomprimido y ejecutar:

### Para Windows:
1. Haz **doble clic** sobre el archivo `installer.bat`.
2. El script verificará que tengas Node.js, creará tu archivo de configuración y descargará automáticamente todas las dependencias del proyecto de forma segura.
3. Al finalizar, te preguntará si deseas arrancar el proyector de inmediato. Presiona `s` para confirmar.

### Para macOS / Linux:
1. Abre tu aplicación de Terminal.
2. Navega a la carpeta del proyecto y dale permisos de ejecución al script:
   ```bash
   chmod +x installer.sh
   ```
3. Ejecútalo con el comando:
   ```bash
   ./installer.sh
   ```
4. El script configurará todo automáticamente y te dará la opción de arrancar el servidor en desarrollo.

---

## 🔧 Instalación Manual

Si prefieres realizar el proceso de instalar manualmente por medio de la consola, haz lo siguiente:

1. **Instalar dependencias**:
   ```bash
   npm install
   ```
2. **Configuración del entorno**:
   Copia el archivo de prueba `.env.example` y llámalo `.env`:
   ```bash
   cp .env.example .env
   ```
   *(Opcional: Si cuentas con una clave API de Google Gemini para las funciones inteligentes de sugerencias de cantos, puedes agregarla en la variable `GEMINI_API_KEY="..."` dentro del archivo `.env`).*

3. **Iniciar en Modo Desarrollo**:
   ```bash
   npm run dev
   ```
   Abre tu navegador de internet favorito en la dirección:  
   👉 **`http://localhost:3000`**

---

## 📦 Construcción y Despliegue para Producción

Si deseas optimizar la aplicación al máximo para usarla a largo plazo en las computadoras fijas del templo, compila el código optimizado:

```bash
# 1. Compilar todo el frontend y empaquetar el servidor de Node en dist/
npm run build

# 2. Iniciar el servidor compilado de alto rendimiento
npm start
```

---

## 🖥️ Arquitectura y Funcionamiento Técnico

Al ejecutar la aplicación localmente en el puerto `3000`, dispones de dos accesos clave:
- **`http://localhost:3000/`** (Inicia el **Controlador principal** para el operador de computadoras).
- **Controlador -> Botón "PROYECTAR"**: Abre de forma automática el **Proyector en Pantalla Completa**. Puedes arrastrar esta pestaña a la segunda pantalla de proyección, televisor o proyector y presionar **F11** para proyectar de manera profesional sin barras del navegador.

Todas las interacciones de cambio se procesan a nivel interno del navegador localmente mediante `BroadcastChannel`, garantizando que **no requieras conexión a Internet** en la segunda pantalla para proyectar a tiempo real las letras y cintillos de forma ultraveloz.
