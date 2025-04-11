# Plugin Overwolf para League of Legends - Documentación Técnica

## Arquitectura del Sistema y Relaciones entre Archivos

```
+------------------------+     +-------------------------+     +-------------------------+
|    Background Window   |     |    Game Events Provider|     |    Live Client Data    |
| [background.ts]       |<--->| [gep.service.ts]       |     | [lcd.service.ts]       |
+------------------------+     +-------------------------+     +-------------------------+
         |                              |                              |
         | window.service.ts            | events.ts                    | fetch API
         v                              v                              v
+------------------------+     +-------------------------+     +-------------------------+
|    Window Manager      |     |     Game Data Manager  |<--->|    Event Handlers      |
| [window.service.ts]   |     | [gameDataManager.ts]   |     | [event-handlers/*.ts]  |
+------------------------+     +-------------------------+     +-------------------------+
         |                              |
         | DOM Events                   | State Updates
         v                              v
+------------------------+     +-------------------------+
|    In-Game Window      |     |      UI Updates        |
| [in_game.ts]         |<--->| [components/*.ts]      |
+------------------------+     +-------------------------+
```

## Flujo de Datos Detallado

```
[Game Events Provider]                    [Live Client Data API]
[gep.service.ts]                         [lcd.service.ts]
        |                                        |
        | onInfoUpdates()                       | fetchData()
        v                                       v
[Event Handlers]                         [Data Fetcher]
[event-handlers/*.ts]                    [services/data-fetcher.ts]
        |                                        |
        | processEvent()                        | processResponse()
        v                                       v
[Data Processing]                        [Response Processing]
[services/data-processor.ts]             [services/response-processor.ts]
        |                                        |
        | updateGameData()                      | updateGameData()
        v                                       v
[Game Data Manager] <-----------------> [State Update]
[gameDataManager.ts]                    [state-updater.ts]
        |
        | notifySubscribers()
        v
[UI Component Updates]
[components/*.ts]
```

## Diagrama de Componentes UI

```
[Tab Manager - components-loader.js]
            |
            | loadTab()
            v
+-------------------------+
|    Dynamic Components   |
|                        |
| +-------------------+  |
| |    Overview Tab   |  |
| | tab-overview.html |  |
| | tab-overview.ts   |  |
| +-------------------+  |
|                        |
| +-------------------+  |
| |    Stats Tab     |  |
| | tab-stats.html   |  |
| | tab-stats.ts     |  |
| +-------------------+  |
|                        |
| +-------------------+  |
| |    Events Tab    |  |
| | tab-events.html  |  |
| | tab-events.ts    |  |
| +-------------------+  |
+-------------------------+
            |
            | subscribe()
            v
[Game Data Manager - gameDataManager.ts]
```

## Diagrama de Actualización de Datos en Tiempo Real

```
[Live Game Events]                    [Live Client Data]
[in_game/eventos.html]                [https://127.0.0.1:2999]
        |                                     |
        v                                     v
+----------------+                    +----------------+
| GEP Listener   |                    | LCD Poller    |
| gep.service.ts |                    | lcd.service.ts|
+----------------+                    +----------------+
        |                                     |
        | onEvent                             | onData
        v                                     v
+------------------------------------------------+
|               Event Processor                    |
|          [services/event-processor.ts]          |
+------------------------------------------------+
        |
        | processedData
        v
+------------------------------------------------+
|             Game Data Manager                    |
|            [gameDataManager.ts]                  |
+------------------------------------------------+
        |
        | notifySubscribers
        v
+------------------------------------------------+
|              UI Components                       |
| [tab-overview.ts, tab-stats.ts, tab-events.ts]  |
+------------------------------------------------+
```

## Diagrama de Inicialización del Sistema

```
[Overwolf Launch]
      |
      v
[background.ts] --> Initialize App
      |
      +-> [window.service.ts] --> Create Windows
      |         |
      |         +-> Create Background Window
      |         |
      |         +-> Create Desktop Window (if needed)
      |         |
      |         +-> Create In-Game Window (when game starts)
      |
      +-> [gep.service.ts] --> Initialize Game Events
      |         |
      |         +-> Register Required Features
      |         |
      |         +-> Set Up Event Listeners
      |
      +-> [lcd.service.ts] --> Initialize Live Client Data
                |
                +-> Start Polling
                |
                +-> Set Up Error Handling
```

## Componentes Core

### Game Data Manager (Singleton)
```typescript
class GameDataManager {
  private static instance: GameDataManager;
  private currentData: GameData = {
    summoner: {
      name: '',
      champion: '',
      level: 1,
      position: '',
      team: ''
    },
    match: {
      gameTime: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      gold: 0,
      gameMode: ''
    },
    events: []
  };
  
  private subscribers: Set<(data: GameData) => void> = new Set();
  
  public static getInstance(): GameDataManager {
    if (!GameDataManager.instance) {
      GameDataManager.instance = new GameDataManager();
    }
    return GameDataManager.instance;
  }
  
  public updateData(updates: Partial<GameData>): void {
    this.currentData = {...this.currentData, ...updates};
    this.notifySubscribers();
  }
  
  public subscribe(callback: (data: GameData) => void): void {
    this.subscribers.add(callback);
  }
  
  public unsubscribe(callback: (data: GameData) => void): void {
    this.subscribers.delete(callback);
  }
  
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentData));
  }
}
```

### Event Handler System
```typescript
interface EventHandler {
  handleEvent(event: any): void;
  processData(data: any): Partial<GameData>;
}

class KillEventHandler implements EventHandler {
  handleEvent(event: any): void {
    const updates = this.processData(event);
    GameDataManager.getInstance().updateData(updates);
  }
  
  processData(data: any): Partial<GameData> {
    // Implementación específica para eventos de kill
    return {
      match: {
        kills: data.kills
      }
    };
  }
}
```

### Live Client Data Service
```typescript
class LiveClientDataService {
  private static readonly BASE_URL = 'https://127.0.0.1:2999/liveclientdata';
  private static readonly POLL_INTERVAL = 1000;
  private intervalId: number | null = null;
  
  public startPolling(): void {
    this.intervalId = window.setInterval(() => {
      this.fetchData();
    }, LiveClientDataService.POLL_INTERVAL);
  }
  
  public stopPolling(): void {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private async fetchData(): Promise<void> {
    try {
      const response = await fetch(`${LiveClientDataService.BASE_URL}/allgamedata`);
      const data = await response.json();
      const updates = this.processData(data);
      GameDataManager.getInstance().updateData(updates);
    } catch (error) {
      console.error('Error fetching live client data:', error);
    }
  }
  
  private processData(data: any): Partial<GameData> {
    // Implementación del procesamiento de datos
    return {
      // ... datos procesados
    };
  }
}
```

## Sistema de Componentes UI

### Tab Manager
```typescript
class TabManager {
  private static readonly TABS_CONFIG = {
    overview: {
      path: 'tab-overview.html',
      updateInterval: 1000
    },
    stats: {
      path: 'tab-stats.html',
      updateInterval: 2000
    },
    events: {
      path: 'tab-events.html',
      updateInterval: 500
    }
  };
  
  private loadedTabs: Map<string, HTMLElement> = new Map();
  
  public async loadTab(tabId: string): Promise<void> {
    const config = TabManager.TABS_CONFIG[tabId];
    if (!config) throw new Error(`Tab ${tabId} not configured`);
    
    const content = await this.fetchTabContent(config.path);
    const container = document.getElementById(tabId);
    if (!container) throw new Error(`Container for ${tabId} not found`);
    
    container.innerHTML = content;
    this.loadedTabs.set(tabId, container);
    this.initializeTab(tabId, config);
  }
  
  private initializeTab(tabId: string, config: any): void {
    // Implementación de la inicialización
  }
}
```

## Performance Optimizations

```typescript
const PERFORMANCE_CONFIG = {
  UI_UPDATE_DEBOUNCE: 300,
  EVENT_CLEANUP_INTERVAL: 60000,
  MAX_STORED_EVENTS: 1000,
  API_THROTTLE: 1000,
  MEMORY_THRESHOLD: 0.8
};

class PerformanceMonitor {
  private static memoryUsage: number = 0;
  private static updateCount: number = 0;
  
  public static trackUpdate(): void {
    this.updateCount++;
    if (this.updateCount % 100 === 0) {
      this.checkMemoryUsage();
    }
  }
  
  private static checkMemoryUsage(): void {
    // Implementación del monitoreo de memoria
  }
}

// Debounce utility for UI updates
function debounce<T extends Function>(func: T, wait: number): T {
  let timeout: number | null = null;
  
  return function(...args: any[]) {
    const later = () => {
      timeout = null;
      func.apply(this, args);
    };
    
    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(later, wait);
  } as unknown as T;
}
```

## Error Handling

```typescript
class ErrorHandler {
  private static readonly MAX_RETRIES = 3;
  private static retryCount: Map<string, number> = new Map();
  
  public static handle(error: Error, context: string): void {
    console.error(`[${context}] ${error.message}`);
    
    const retries = this.retryCount.get(context) || 0;
    if (retries < this.MAX_RETRIES) {
      this.retry(context);
    } else {
      this.escalate(error, context);
    }
  }
  
  private static retry(context: string): void {
    const currentRetries = this.retryCount.get(context) || 0;
    this.retryCount.set(context, currentRetries + 1);
    // Implementación del retry
  }
  
  private static escalate(error: Error, context: string): void {
    // Implementación de la escalación
  }
}
```

## Build System

```typescript
// webpack.config.ts
import * as webpack from 'webpack';
import * as path from 'path';

const config: webpack.Configuration = {
  entry: {
    background: './src/background/background.ts',
    in_game: './src/in_game/in_game.ts'
  },
  output: {
    filename: 'js/[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  }
};

export default config;
```

## Testing

```typescript
// Ejemplo de test unitario para GameDataManager
describe('GameDataManager', () => {
  let manager: GameDataManager;
  
  beforeEach(() => {
    manager = GameDataManager.getInstance();
  });
  
  it('should process GEP updates correctly', () => {
    const updates = {
      match: {
        kills: 1,
        deaths: 0,
        assists: 2
      }
    };
    
    manager.updateData(updates);
    expect(manager.getCurrentData().match.kills).toBe(1);
  });
  
  it('should notify subscribers of updates', () => {
    const mockCallback = jest.fn();
    manager.subscribe(mockCallback);
    
    manager.updateData({
      summoner: { name: 'TestPlayer' }
    });
    
    expect(mockCallback).toHaveBeenCalled();
  });
});
```

## Estructura de Directorios Detallada

```
src/
├── AppWindow.ts         # Clase principal de ventana (no documentada previamente)
├── consts.ts            # Constantes globales (movido desde shared/constants)
├── background/
│   ├── background.html  # HTML para la ventana de fondo
│   └── background.ts    # Lógica principal de la ventana de fondo
├── css/                 # Archivos CSS globales (no documentado previamente)
│   └── ...              # (Contenido no inspeccionado)
├── desktop/
│   ├── desktop.html     # HTML para la ventana de escritorio
│   └── desktop.ts       # Lógica principal de la ventana de escritorio
└── in_game/             # Lógica y UI principal en partida (estructura simplificada)
    ├── ads.ts           # Gestión de anuncios (movido desde services/)
    ├── banner-horizontal.html
    ├── banner-vertical.html
    ├── components-loader.js # Carga dinámica de componentes UI
    ├── eventos-fix.js
    ├── eventos.html     # HTML para visualización de eventos
    ├── header-loader.js
    ├── header.html      # Plantilla HTML para la cabecera
    ├── heatmap.ts       # Lógica para el mapa de calor (no documentado previamente)
    ├── in_game.html     # HTML principal de la ventana en partida
    ├── in_game.ts       # Lógica principal de la ventana en partida
    ├── raw-data-exporter.js # Exportador de datos crudos (no documentado previamente)
    ├── tab-clips.html
    ├── tab-events.html
    ├── tab-heatmap.html
    ├── tab-improve.html
    ├── tab-overview.html
    ├── tab-performance.html
    ├── tab-stats.html
    └── tabs-menu.html   # Plantilla HTML para el menú de pestañas
```

## Licencia
Propietaria - Todos los derechos reservados

## Acceso a Métricas de League of Legends

Esta sección documenta cómo acceder a las métricas del juego en tiempo real que proporciona la API de Overwolf para League of Legends.

### Estructura de Datos Principales

Las métricas del juego se organizan en un objeto central con esta estructura:

```typescript
interface GameData {
  summoner: {
    name: string;
    champion: string;
    level: number;
    position: string;
    team: string;
  };
  match: {
    gameMode: string;
    gameTime: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    gold: number;
  };
  combat: {
    damageDealt: number;
    damageTaken: number;
    healingDone: number;
    damageDealtToChampions: number;
  };
  objectives: {
    wardPlaced: number;
    turretKills: number;
  };
  events: Array<any>;
}
```

### Cómo Acceder a las Métricas

Todos los datos están disponibles a través del `gameDataManager`. Aquí hay ejemplos de cómo acceder a datos específicos:

#### Ejemplo 1: Acceder a KDA (Kills, Deaths, Assists)

```javascript
// Obtener KDA
const kills = gameData.match.kills || 0;
const deaths = gameData.match.deaths || 0;
const assists = gameData.match.assists || 0;

// Actualizar elementos HTML
document.getElementById('kills-element').textContent = kills;
document.getElementById('deaths-element').textContent = deaths;
document.getElementById('assists-element').textContent = assists;

// Calcular ratio KDA
function calculateKDARatio(kills, deaths, assists) {
  if (deaths === 0) return ((kills + assists) > 0 ? "Perfect" : "0.0");
  return ((kills + assists) / deaths).toFixed(1);
}
const kdaRatio = calculateKDARatio(kills, deaths, assists);
document.getElementById('kda-ratio').textContent = kdaRatio;
```

#### Ejemplo 2: Acceder a CS (Creep Score) y CS por minuto

```javascript
// Obtener CS
const cs = gameData.match.cs || 0;
document.getElementById('cs-element').textContent = cs;

// Calcular CS por minuto
const gameTime = gameData.match.gameTime || 0;
if (gameTime > 0) {
  const gameTimeInMinutes = Math.max(gameTime / 60, 1);
  const csPerMinute = (cs / gameTimeInMinutes).toFixed(1);
  document.getElementById('cs-per-min').textContent = csPerMinute;
}
```

#### Ejemplo 3: Acceder a Wards colocados

```javascript
// Buscar wards en diferentes ubicaciones posibles
let wardsPlaced = 0;
if (gameData.ward && gameData.ward.placed !== undefined) {
  wardsPlaced = parseInt(gameData.ward.placed) || 0;
} else if (gameData.vision && gameData.vision.wardsPlaced !== undefined) {
  wardsPlaced = gameData.vision.wardsPlaced;
} else if (gameData.objectives && gameData.objectives.wardPlaced !== undefined) {
  wardsPlaced = gameData.objectives.wardPlaced;
}
document.getElementById('wards-placed').textContent = wardsPlaced;
```

#### Ejemplo 4: Acceder a Daño y Curación

```javascript
// Acceder a datos de combate
if (gameData.combat) {
  // Daño total
  if (gameData.combat.damageDealt !== undefined) {
    const formattedDamage = new Intl.NumberFormat('es-ES').format(gameData.combat.damageDealt);
    document.getElementById('total-damage').textContent = formattedDamage;
  }
  
  // Daño a campeones
  if (gameData.combat.totalDamageToChampions !== undefined) {
    const formattedDamage = new Intl.NumberFormat('es-ES').format(gameData.combat.totalDamageToChampions);
    document.getElementById('champion-damage').textContent = formattedDamage;
  } else if (gameData.combat.damageDealtToChampions !== undefined) {
    const formattedDamage = new Intl.NumberFormat('es-ES').format(gameData.combat.damageDealtToChampions);
    document.getElementById('champion-damage').textContent = formattedDamage;
  }
  
  // Curación
  if (gameData.combat.healing !== undefined) {
    const formattedHealing = new Intl.NumberFormat('es-ES').format(gameData.combat.healing);
    document.getElementById('total-healing').textContent = formattedHealing;
  } else if (gameData.combat.healingDone !== undefined) {
    const formattedHealing = new Intl.NumberFormat('es-ES').format(gameData.combat.healingDone);
    document.getElementById('total-healing').textContent = formattedHealing;
  }
}
```

### Lista de Claves Disponibles

Las claves disponibles incluyen:

#### Datos del Invocador
- `gameData.summoner.name`: Nombre del invocador
- `gameData.summoner.champion`: Campeón que está jugando
- `gameData.summoner.level`: Nivel del invocador
- `gameData.summoner.position`: Posición en el juego
- `gameData.summoner.team`: Equipo (Azul/Rojo)

#### Datos de la Partida
- `gameData.match.gameMode`: Modo de juego (Ranked, Normal, ARAM, etc.)
- `gameData.match.gameTime`: Tiempo de juego en segundos
- `gameData.match.kills`: Eliminaciones del jugador
- `gameData.match.deaths`: Muertes del jugador
- `gameData.match.assists`: Asistencias del jugador
- `gameData.match.cs`: Súbditos eliminados
- `gameData.match.gold`: Oro acumulado

#### Datos de Combate
- `gameData.combat.damageDealt`: Daño total infligido
- `gameData.combat.damageTaken`: Daño recibido
- `gameData.combat.damageDealtToChampions`: Daño infligido a campeones
- `gameData.combat.totalDamageToChampions`: Otra forma de acceder al daño a campeones
- `gameData.combat.healing` o `gameData.combat.healingDone`: Curación total realizada

#### Datos de Objetivos
- `gameData.objectives.wardPlaced`: Guardianes colocados
- `gameData.objectives.turretKills`: Torres destruidas
- `gameData.vision.wardsPlaced`: Otra forma de acceder a guardianes colocados

### Acceso a Datos Del Jugador Activo (Live Client Data)

También puedes acceder a datos más detallados del jugador activo mediante:

```javascript
// Habilidades
const abilities = gameData.activePlayer?.abilities;
if (abilities) {
  const qLevel = abilities.Q?.abilityLevel || 0;
  const wLevel = abilities.W?.abilityLevel || 0;
  const eLevel = abilities.E?.abilityLevel || 0;
  const rLevel = abilities.R?.abilityLevel || 0;
}

// Estadísticas del campeón
const stats = gameData.activePlayer?.championStats;
if (stats) {
  const currentHealth = stats.currentHealth;
  const maxHealth = stats.maxHealth;
  const attackDamage = stats.attackDamage;
  const abilityPower = stats.abilityPower;
}
```

### Subscribirse a Actualizaciones

Para recibir actualizaciones automáticas cuando cambian los datos del juego:

```javascript
function updateUI(gameData) {
  // Actualizar la UI con los nuevos datos
  document.getElementById('kills').textContent = gameData.match.kills || 0;
  document.getElementById('deaths').textContent = gameData.match.deaths || 0;
  // Más actualizaciones...
}

// Subscribirse a actualizaciones
if (window.gameDataManager && typeof window.gameDataManager.subscribe === 'function') {
  window.gameDataManager.subscribe(updateUI);
}
```

Este sistema permite mostrar en tiempo real las estadísticas del jugador durante el juego, ofreciendo una experiencia interactiva y útil.

## Sistema de Exportación de Datos Crudos

Este proyecto incluye un sistema completo para exportar todos los datos crudos de League of Legends, tanto del Game Events Provider (GEP) como de la Live Client Data API. El sistema está diseñado para capturar y almacenar todos los datos sin filtrar en archivos JSON para análisis posterior.

### Características principales

- Captura completa de datos crudos sin filtrar
- Guardado automático de datos en archivos JSON
- Detección automática de inicio y fin de partida
- Preparado para envío de datos a servidor externo
- Seguimiento de serie temporal con timestamps precisos
- Fácil integración con sistemas de análisis externos
- **Exportación automática al final de cada partida**

### Configuración

La configuración del exportador se encuentra en el archivo `sample-app/ts/src/in_game/raw-data-exporter.js`:

```javascript
const RAW_DATA_EXPORTER = {
  // Intervalo de guardado automático en milisegundos (5 minutos)
  AUTOSAVE_INTERVAL: 5 * 60 * 1000,
  
  // Intervalo de recopilación de datos en milisegundos (15 segundos)
  DATA_COLLECTION_INTERVAL: 15 * 1000,
  
  // URL del servidor para enviar datos (reemplazar con la URL real)
  SERVER_ENDPOINT: "https://tu-servidor.com/api/lol-data",
  
  // Carpeta donde se guardarán los archivos
  SAVE_FOLDER: "Overwolf/lol-data",
  
  // Habilitar guardado automático
  ENABLE_AUTO_SAVE: true,
  
  // Habilitar envío automático al servidor
  ENABLE_SERVER_UPLOAD: false
};
```

### Detección automática del fin de partida

El sistema detecta automáticamente el fin de la partida a través de tres mecanismos diferentes:

1. **Eventos del juego**: Detecta eventos `match_end` o `game_end` enviados por la API de eventos de League of Legends.
2. **Cambio de estado del juego**: Monitorea cuando el juego deja de ejecutarse a través de `overwolf.games.onGameInfoUpdated`.
3. **Cierre de ventana**: Detecta cuando la ventana in-game va a cerrarse utilizando `overwolf.windows.onStateChanged` y el evento `beforeunload`.

Este sistema de triple detección garantiza que los datos siempre se exporten correctamente, incluso si el juego se cierra abruptamente o si hay cambios en el sistema de eventos del juego.

### Estructura de los datos exportados

Los datos se guardan con la siguiente estructura:

```javascript
{
  // Metadatos de la sesión
  "sessionInfo": {
    "startTime": "2023-04-15T12:34:56.789Z",
    "gameVersion": "13.7.0",
    "playerName": "PlayerName",
    "gameMode": "CLASSIC",
    "gameStartTime": "2023-04-15T12:35:00.123Z",
    "gameEndTime": "2023-04-15T13:05:45.678Z"
  },
  
  // Serie temporal con datos capturados periódicamente
  "timeSeriesData": [
    {
      "timestamp": "2023-04-15T12:35:15.000Z",
      "gameTime": 15,
      "data": {
        // Estructura completa de datos del juego
        "summoner": { /* datos del invocador */ },
        "match": { /* datos de la partida */ },
        "combat": { /* estadísticas de combate */ },
        "objectives": { /* datos de objetivos */ },
        // ... y todos los demás datos disponibles
      }
    },
    // ... más puntos de datos en intervalos regulares
  ],
  
  // Eventos importantes detectados
  "events": [
    {
      "name": "kill",
      "data": { /* detalles del evento */ },
      "timestamp": "2023-04-15T12:40:23.456Z",
      "capturedAt": "2023-04-15T12:40:23.789Z"
    },
    // ... más eventos
  ],
  
  // Estado final del juego al terminar la partida
  "finalState": {
    // Estructura completa de datos al finalizar
  }
}
```

### Dónde se guardan los archivos

Los archivos JSON se guardan por defecto en:
```
C:\Users\TuUsuario\Documents\Overwolf\lol-data\
```

El formato del nombre del archivo es:
```
lol-raw-data-[NombreJugador]-[Timestamp].json
```

Al finalizar la partida, se guarda un archivo final con el sufijo `-FINAL-`:
```
lol-raw-data-[NombreJugador]-FINAL-[Timestamp].json
```

### Envío automático al servidor

Al final de cada partida, el sistema intentará enviar los datos completos al servidor configurado antes de que se cierre la ventana del juego. Este proceso se realiza de manera sincrónica para garantizar que los datos se envíen correctamente.

Para habilitar el envío automático:

1. Configura la URL del servidor:
```javascript
SERVER_ENDPOINT: "https://tu-servidor.com/api/lol-data"
```

2. Habilita el envío automático:
```javascript
ENABLE_SERVER_UPLOAD: true
```

### Cómo acceder a los datos desde JavaScript

```javascript
// Acceder a los datos a través del objeto global
const exporter = window.rawDataExporter;

// Guardar datos manualmente
exporter.saveToFile('mi-archivo-personalizado.json')
  .then(success => {
    if (success) {
      console.log('Datos guardados correctamente');
    }
  });

// Enviar datos al servidor manualmente
exporter.sendToServer()
  .then(success => {
    if (success) {
      console.log('Datos enviados al servidor');
    }
  });

// Acceder a los datos actuales
const currentData = exporter.sessionData;
console.log('Datos del jugador:', currentData.sessionInfo.playerName);
console.log('Tiempo de juego actual:', 
  currentData.timeSeriesData.length > 0 
    ? currentData.timeSeriesData[currentData.timeSeriesData.length - 1].gameTime 
    : 0
);
```

### Ejemplos de uso de los datos exportados

#### Extraer KDA y CS por minuto a lo largo de la partida

```javascript
function analizarProgresionKDA(datosPartida) {
  return datosPartida.timeSeriesData.map(punto => {
    const gameTimeMinutes = punto.gameTime / 60;
    const match = punto.data.match || {};
    
    return {
      timestamp: punto.timestamp,
      gameTimeMinutes: gameTimeMinutes.toFixed(2),
      kills: match.kills || 0,
      deaths: match.deaths || 0, 
      assists: match.assists || 0,
      cs: match.cs || 0,
      csPerMinute: gameTimeMinutes > 0 ? (match.cs / gameTimeMinutes).toFixed(2) : 0
    };
  });
}
```

#### Analizar eventos de eliminaciones (kills)

```javascript
function extraerEventosKill(datosPartida) {
  return datosPartida.events
    .filter(evento => evento.name === 'kill')
    .map(evento => {
      return {
        timestamp: evento.timestamp,
        gameTime: datosPartida.timeSeriesData.find(
          p => new Date(p.timestamp) <= new Date(evento.timestamp)
        )?.gameTime || 0,
        killer: evento.data.killer,
        victim: evento.data.victim,
        position: evento.data.position
      };
    });
}
```

### Integración con sistemas de backend

Para enviar los datos a tu propio servidor:

1. Modifica la URL del servidor en la configuración:
```javascript
SERVER_ENDPOINT: "https://tu-servidor.com/api/lol-data"
```

2. Habilita el envío automático:
```javascript
ENABLE_SERVER_UPLOAD: true
```

3. En tu servidor, implementa un endpoint que acepte solicitudes POST con la estructura JSON descrita anteriormente.
