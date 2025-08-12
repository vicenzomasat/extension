# Privacy Shield - Extensión Anti-Fingerprinting

Extensión para navegadores basados en Chromium que reduce el fingerprinting con cambios mínimos. Incluye listas configurables (Blanca/Negra) para control granular por dominio.

## Novedades v1.1.0

- **Listas configurables:**
  - **Lista Blanca:** dominios de confianza donde se minimiza la intervención (preserva autenticación).
  - **Lista Negra:** dominios donde se fuerza la protección.
  - **Patrones:** dominios exactos (example.com) o comodín de prefijo (*.example.com). Sin regex.
  - **Sanitización** de entradas para evitar patrones inválidos.

- **UI mejorada:**
  - **Popup** con botones rápidos para añadir/quitar el sitio actual a/de listas.
  - **Página de opciones** para gestionar ambas listas.

- **Robustez:**
  - **Defaults conservadores** (Canvas + WebGL activos; UA y Timezone opcionales y off por defecto).
  - **Precedencia clara:** si un dominio está en ambas listas, prevalece Lista Negra.
  - **Inyección temprana** y defensiva (sin modificar headers).
  - **Protecciones CSP-safe** con manejo de errores.

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
  blacklistPatterns: []    // Lista negra vacía
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