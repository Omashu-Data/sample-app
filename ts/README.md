# Plugin Overwolf para League of Legends

Este proyecto es un plugin para Overwolf diseñado específicamente para League of Legends. Proporciona a los jugadores una interfaz interactiva con estadísticas en tiempo real, análisis de rendimiento, grabación automática de clips y más. El plugin ha sido desarrollado siguiendo el modelo del ejemplo oficial TypeScript de Overwolf, pero con una implementación personalizada y ampliada.

## Características Principales

- **Estadísticas en tiempo real**: Métricas detalladas del juego como DPS, KDA, economía, etc.
- **Grabación automática de clips**: Captura automática de clips cuando ocurren eventos importantes.
- **Análisis de rendimiento**: Visualización y seguimiento del rendimiento durante la partida.
- **Panel de resumen del jugador**: Muestra fortalezas, debilidades y retos basados en el rendimiento actual.
- **Heatmap**: Visualización del posicionamiento y actividad durante la partida.
- **Integración de anuncios**: Espacios publicitarios para monetización del plugin.
- **Diseño modular**: Componentes cargados dinámicamente para una mejor organización y mantenimiento.

## Estructura del Proyecto

### Directorios Principales

- **public/**: Recursos estáticos y archivos que serán servidos directamente.
  - **css/**: Hojas de estilo organizadas por funcionalidad.
  - **icons/**: Iconos y activos visuales.
  - **img/**: Imágenes usadas por la aplicación.
  - **js/**: Scripts JavaScript compilados.
  - **scripts/**: Scripts adicionales para la aplicación.
  - **manifest.json**: Configuración principal del plugin para Overwolf.

- **src/**: Código fuente TypeScript organizado por componentes y funcionalidades.
  - **background/**: Ventana de fondo que gestiona el ciclo de vida de la aplicación.
  - **desktop/**: Implementación de la interfaz para escritorio.
  - **in_game/**: Implementación de la interfaz durante el juego.
    - **tab-overview.html**: Vista principal con fortalezas, debilidades y retos.
    - **tab-stats.html**: Panel detallado de estadísticas.
    - **tab-events.html**: Registro de eventos importantes.
    - **tab-clips.html**: Gestor de clips grabados.
    - **tab-performance.html**: Análisis detallado de rendimiento.
    - **tab-improve.html**: Recomendaciones de mejora.
    - **tab-heatmap.html**: Visualización de posicionamiento.

### Archivos Clave

- **components-loader.js**: Sistema de carga dinámica de componentes.
- **header-loader.js**: Cargador para el encabezado de la aplicación.
- **tabs-menu.html**: Menú de navegación entre pestañas.
- **banner-horizontal.html** y **banner-vertical.html**: Espacios publicitarios.
- **in_game.html**: Contenedor principal para la interfaz durante el juego.
- **in_game.ts**: Lógica principal para la ventana durante el juego.

## Sistema de Pestañas

El plugin implementa un sistema de pestañas modular que carga el contenido dinámicamente:

1. **Resumen**: Visión general del jugador con fortalezas, debilidades y retos personalizados.
2. **Estadísticas**: Métricas detalladas del juego presentadas en tarjetas informativas.
3. **Eventos**: Registro de acontecimientos importantes durante la partida.
4. **Clips**: Gestión de vídeos capturados automáticamente.
5. **Rendimiento**: Análisis detallado del desempeño con gráficos y métricas.
6. **Mejora**: Consejos y estrategias para mejorar el juego.
7. **Heatmap**: Visualización de actividad y posicionamiento.

## Integración de Publicidad

El plugin incluye integración para anuncios Overwolf en formato de banner horizontal (728×90) y banner vertical (160×600), ambos implementados con diseños de marcador de posición profesionales.

## Requisitos

- Overwolf Client
- Node.js y npm
- League of Legends

## Instalación para Desarrollo

1. Clona este repositorio.
2. Ejecuta `npm install` para instalar las dependencias.
3. Ejecuta `npm run dev` para iniciar el servidor de desarrollo.
4. Sigue las [instrucciones de Overwolf](https://overwolf.github.io/docs/start/sdk-introduction#load-the-app-as-unpacked-extension) para cargar la aplicación como extensión no empaquetada.

## Compilación

Para crear un paquete .opk para distribución:

```
npm run build
```

Esto generará un archivo .opk en el directorio `releases/`.

## Notas para Desarrolladores

- La aplicación utiliza una arquitectura modular donde los componentes se cargan dinámicamente.
- Los estilos CSS siguen una metodología BEM para mayor claridad y mantenibilidad.
- La interfaz principal está diseñada para ser no intrusiva durante el juego.
- Las métricas y eventos se obtienen a través de la API de eventos de juego de Overwolf.
- La grabación automática de clips se activa en momentos clave (kills, asistencias, etc.).

## Características Técnicas

- Implementación en TypeScript para tipado estático.
- Carga dinámica de componentes para mejor rendimiento.
- Sistema responsive adaptado a diferentes resoluciones de pantalla.
- Almacenamiento local para mantener configuraciones de usuario.
- Optimización para rendimiento durante el juego.

## Próximas Características

- Integración con API externa para estadísticas históricas.
- Mejoras en el sistema de recomendaciones.
- Soporte para más idiomas.
- Personalización de interfaz por parte del usuario.

## Licencia

Este proyecto está licenciado bajo términos privados. Todos los derechos reservados.
