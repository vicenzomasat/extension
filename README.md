# Privacy Shield - Extensión Anti-Fingerprinting

Extensión para navegadores basados en Chromium que reduce el fingerprinting con cambios mínimos. Incluye listas configurables (Blanca/Negra) para control granular por dominio.

## Novedades recientes

- Opciones avanzadas (desactivadas por defecto):
  - Resolución/Pantalla: falsifica propiedades de `screen` (width, height, avail*), `colorDepth`, `pixelDepth` y alinea `devicePixelRatio`.
  - CPU Cores: falsifica `navigator.hardwareConcurrency` a un valor estable (4) para evitar variaciones detectables.
- Integración con listas: las opciones avanzadas se respetan por dominio con la misma precedencia (Lista Negra > Lista Blanca > Normal).
- Seguridad y robustez: las anulaciones son defensivas, con comprobaciones de configurabilidad y fallbacks (Proxy de `window.screen` si procede). Todo envuelto en try/catch para no romper la página.

## Advertencias sobre las opciones avanzadas

- Estas funciones pueden afectar el comportamiento de algunos sitios (por ejemplo, diseño responsivo o detección de zoom). Por eso están desactivadas por defecto. Si las habilitas y observas problemas, añade el dominio a la Lista Blanca o desactívalas temporalmente.

## Desarrollo

- Helper opcional: `tools/launch_vivaldi.py` permite abrir Vivaldi con la extensión cargada para pruebas locales. Requiere tener `vivaldi` en PATH.

```
python3 tools/launch_vivaldi.py --ext-path /ruta/a/la/extension
```

Si no se pasa `--ext-path`, intentará resolver la carpeta del repo automáticamente.

## Características de Protección

### Canvas Fingerprinting
- Añade ruido mínimo a las exportaciones de canvas
- Protege `toDataURL()`, `toBlob()` y `getImageData()`
- Preserva funcionalidad visual sin detectar cambios

### WebGL Fingerprinting  
- Oculta información real del GPU/driver
- Bloquea extensión `WEBGL_debug_renderer_info`
- Devuelve valores genéricos consistentes

### User Agent Spoofing
- **Por defecto OFF** para evitar inconsistencias
- Solo afecta JavaScript, no headers HTTP
- Configurable via popup

### Timezone Spoofing
- **Por defecto OFF** para evitar incompatibilidades
- Limitado a `Intl.DateTimeFormat`
- Configurable via popup

### Screen/Resolution Spoofing
- **Por defecto OFF** para mantener compatibilidad
- Falsifica propiedades del objeto `screen` (width, height, availWidth, availHeight, colorDepth, pixelDepth)
- Alinea `devicePixelRatio` a un valor consistente (1)
- Implementación defensiva con fallbacks (prototipo Screen + Proxy + direct assignment)
- Puede afectar diseño responsivo y detección de zoom

### Hardware Concurrency Spoofing
- **Por defecto OFF** para evitar problemas de compatibilidad
- Falsifica `navigator.hardwareConcurrency` a un valor estable (4)
- Evita variaciones detectables que pueden flaggear detectores avanzados
- Valor configurable en futuras versiones

## Gestión de Listas

### Lista Blanca (Confiables)
- Sitios donde se minimiza la protección
- Incluye dominios bancarios/auth pre-configurados
- Ideal para preservar autenticación

### Lista Negra (Forzar Protección)
- Protección aplicada sin excepciones
- **Prevalece** sobre lista blanca
- Para sitios con tracking agresivo

### Patrones Soportados
- **Dominio exacto:** `example.com`
- **Comodín prefijo:** `*.example.com` (incluye subdominios)
- **Sanitización automática:** elimina esquemas, paths, caracteres inválidos

## Instalación

1. Descarga o clona este repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa "Modo de desarrollador"
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta del proyecto

## Uso

### Popup (Acceso Rápido)
- **Toggles individuales** para cada protección
- **Estado del sitio actual** en listas
- **Botones rápidos** para añadir/quitar de listas
- **Recarga automática** tras cambios

### Página de Opciones
- **Gestión completa** de listas
- **Añadir/eliminar** patrones
- **Validación automática** de entradas

## Configuración por Defecto

```javascript
{
  enabled: true,           // Protección activa
  spoofUserAgent: false,   // UA spoofing desactivado
  spoofTimezone: false,    // Timezone spoofing desactivado  
  spoofWebGL: true,        // WebGL protegido
  spoofCanvas: true,       // Canvas protegido
  preserveAuth: true,      // Preservar autenticación
  whitelistPatterns: [],   // Lista blanca vacía
  blacklistPatterns: [],   // Lista negra vacía
  spoofScreen: false,      // Screen spoofing desactivado
  spoofHardware: false     // Hardware spoofing desactivado
}
```

## Precedencia de Protección

1. **Lista Negra** → Protección forzada (ignora lista blanca)
2. **Lista Blanca + preserveAuth** → Protección mínima
3. **Por defecto** → Protección estándar

## Compatibilidad

- **Manifest V3** (Chrome Extensions API v3)
- **Chrome/Chromium** 88+
- **Edge** 88+
- **Brave, Vivaldi** y otros basados en Chromium

## Seguridad

- **Inyección defensiva** con verificación de configurabilidad
- **Manejo de errores** para evitar interferencia
- **Sin modificación** de headers HTTP
- **CSP-compatible** sin `eval()` o `unsafe-inline`

## Assets / Icons

The extension uses a new shield icon set for improved visibility and comprehensive size coverage:

- **Shield Icons (Enabled State)**: `shield16.png`, `shield32.png`, `shield48.png`, `shield64.png`, `shield128.png`
- **Legacy Icons (Disabled State)**: `icon16-disabled.png`, `icon48-disabled.png`, `icon128-disabled.png`

The shield iconography provides better visual identification of the privacy protection status, with sizes covering all common use cases from browser toolbars to extension management pages.

## Desarrollo

### Estructura del Proyecto
```
├── manifest.json          # Configuración de la extensión
├── content.js             # Script de inyección de protecciones
├── background.js          # Service Worker
├── popup.html/popup.js    # Interfaz popup
├── options.html/options.js # Página de opciones
├── icons/                 # Iconos de la extensión
└── README.md             # Documentación
```

### Testing
1. Cargar extensión en modo desarrollador
2. Visitar sitios de prueba de fingerprinting
3. Verificar protecciones en consola del desarrollador
4. Probar gestión de listas via popup/opciones

## Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

## Contribuir

1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit cambios (`git commit -am 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

## Changelog

### v1.1.0
- ✅ Listas configurables (Blanca/Negra)
- ✅ UI para gestión de listas
- ✅ Patrones de dominio con comodines
- ✅ Precedencia de protección mejorada
- ✅ Defaults conservadores
- ✅ Inyección CSP-safe

### v1.0.0
- ✅ Protección básica contra fingerprinting
- ✅ Canvas, WebGL, UA, Timezone spoofing
- ✅ Configuración simple