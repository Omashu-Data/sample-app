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

Esta sección documenta cómo acceder a las métricas del juego en tiempo real que proporciona la API de Overwolf para League of Legends, combinando datos de la **Live Client Data API (LCD)** y del **Game Events Provider (GEP)**.

### Estrategia de Obtención de Datos

Utilizamos un enfoque híbrido:

1.  **Live Client Data API (LCD):** Se consulta periódicamente (`lcd.service.ts`) para obtener el estado general de la partida, datos del invocador y **estadísticas detalladas del campeón activo** (`activePlayer.championStats`). Estos datos son la fuente principal para la mayoría de las métricas no relacionadas con eventos discretos.
2.  **Game Events Provider (GEP):** Escuchamos eventos específicos a través de `onNewEvents` (`gep.service.ts` -> `in_game_listeners.js`). Crucialmente, utilizamos los eventos individuales de daño (ej: `physical_damage_dealt_player`, `magic_damage_dealt_to_champions`, `physical_damage_taken`) para **acumular en tiempo real** las estadísticas de "Daño Total Infligido", "Daño a Campeones" y "Daño Recibido".
    *   **Nota Importante:** Aunque la documentación menciona una *feature* `"damage"` para `onInfoUpdates` que teóricamente provee totales (`total_damage_dealt`, etc.), nuestra experiencia ha demostrado que estos datos no llegan de forma fiable o consistente. Por ello, hemos optado por la acumulación manual basada en `onNewEvents`.

### Estructura de Datos Principales

Las métricas del juego se organizan en un objeto central gestionado por `GameDataManager`, con una estructura similar a esta:

```typescript
interface GameData {
  summoner: {
    name: string;
    champion: string; // Obtenido de LCD API
    level: number;    // Obtenido de LCD API
    // position: string; // Podría obtenerse de LCD API o GEP
    // team: string;     // Obtenido de LCD API
  };
  match: {
    gameMode: string; // Obtenido de LCD API
    gameTime: number; // Obtenido de LCD API o GEP ('match_clock')
    kills: number;    // Obtenido de LCD API (más fiable que GEP 'kill' count)
    deaths: number;   // Obtenido de LCD API
    assists: number;  // Obtenido de LCD API
    cs: number;       // Obtenido de LCD API
    gold: number;     // Obtenido de LCD API
    // Nuevas métricas si se añaden (ej: doubleKills)
    doubleKills?: number; // Obtenido de LCD API
  };
  combat: {
    // Valores acumulados a partir de eventos GEP (onNewEvents)
    damageDealt: number;
    damageDealtToChampions: number;
    damageTaken: number;
    // Otras métricas de combate de LCD API si están disponibles y son fiables
    damageSelfMitigated?: number;
    damageToObjectives?: number; // Nota: Podría requerir acumulación GEP específica
    damageToBuildings?: number; // Nota: Podría requerir acumulación GEP específica
    // healingDone: number; // No se obtiene fiablemente por ahora
  };
  vision?: { // Datos de visión (generalmente de LCD API)
    wardsPlaced?: number;
    wardsDestroyed?: number;
    visionScore?: number;
  };
  championStats?: { // Datos detallados del campeón activo (de LCD API)
    abilityPower?: number;
    attackDamage?: number;
    attackSpeed?: number;
    armor?: number;
    magicResist?: number;
    critChance?: number;
    currentHealth?: number;
    maxHealth?: number;
    moveSpeed?: number;
    tenacity?: number;
    lifeSteal?: number;
    omnivamp?: number;
    abilityHaste?: number;
    bonusArmorPenetrationPercent?: number;
    bonusMagicPenetrationPercent?: number;
    physicalLethality?: number;
    attackRange?: number;
    healShieldPower?: number;
    // ... añadir más según sea necesario
  };
  // objectives: { // Podríamos tener una sección específica si obtenemos datos
  //   turretKills: number; // Generalmente de LCD API
  // };
  events: Array<any>; // Log de eventos GEP recibidos en onNewEvents
}
```

### Cómo Acceder a las Métricas

Todos los datos están disponibles a través del `gameDataManager`. Aquí hay ejemplos de cómo acceder a datos específicos:

#### Ejemplo 1: Acceder a KDA (Kills, Deaths, Assists) - Fuente: LCD API

```javascript
// Obtener KDA (fuente principal: Live Client Data API)
const kills = gameData.match?.kills || 0;
const deaths = gameData.match?.deaths || 0;
const assists = gameData.match?.assists || 0;

// Actualizar elementos HTML
document.getElementById('stats-kills').textContent = kills;
document.getElementById('stats-deaths').textContent = deaths;
document.getElementById('stats-assists').textContent = assists;

// Calcular ratio KDA
function calculateKDARatio(kills, deaths, assists) {
  if (deaths === 0) return ((kills + assists) > 0 ? "Perfect" : "0.0");
  return ((kills + assists) / deaths).toFixed(1);
}
const kdaRatio = calculateKDARatio(kills, deaths, assists);
document.getElementById('stats-kda-ratio').textContent = kdaRatio;
```

#### Ejemplo 2: Acceder a CS (Creep Score) y CS por minuto - Fuente: LCD API

```javascript
// Obtener CS (fuente principal: Live Client Data API)
const cs = gameData.match?.cs || 0;
document.getElementById('stats-cs').textContent = cs;

// Calcular CS por minuto
const gameTime = gameData.match?.gameTime || 0;
if (gameTime > 0) {
  const gameTimeInMinutes = Math.max(gameTime / 60, 1); // Evitar división por cero
  const csPerMinute = (cs / gameTimeInMinutes).toFixed(1);
  document.getElementById('stats-cs-per-min').textContent = csPerMinute;
} else {
  document.getElementById('stats-cs-per-min').textContent = '0.0';
}
```

#### Ejemplo 3: Acceder a Wards colocados - Fuente: LCD API

```javascript
// Obtener Wards (fuente principal: Live Client Data API, si disponible)
const wardsPlaced = gameData.vision?.wardsPlaced || 0;
document.getElementById('stats-wards-placed').textContent = wardsPlaced;
// Nota: La disponibilidad y fiabilidad de 'wardsDestroyed' puede variar.
const wardsDestroyed = gameData.vision?.wardsDestroyed || 0;
document.getElementById('stats-wards-destroyed').textContent = wardsDestroyed;
```

#### Ejemplo 4: Acceder a Daño (Acumulado de Eventos GEP)

```javascript
// Acceder a datos de combate acumulados por in_game_listeners.js
if (gameData.combat) {
  // Daño total infligido (acumulado de physical/magic/true_damage_dealt_player)
  const totalDamageDealt = gameData.combat.damageDealt || 0;
  document.getElementById('stats-total-damage').textContent = new Intl.NumberFormat('es-ES').format(totalDamageDealt);
  
  // Daño a campeones (acumulado de physical/magic/true_damage_dealt_to_champions)
  const damageToChamps = gameData.combat.damageDealtToChampions || 0;
  document.getElementById('stats-champion-damage').textContent = new Intl.NumberFormat('es-ES').format(damageToChamps);
  
  // Daño recibido (acumulado de physical/magic/true_damage_taken)
  const damageTaken = gameData.combat.damageTaken || 0;
  document.getElementById('stats-damage-taken').textContent = new Intl.NumberFormat('es-ES').format(damageTaken);

  // Otras métricas de combate (si se obtienen de LCD u otra fuente)
  const damageMitigated = gameData.combat.damageSelfMitigated || 0;
  document.getElementById('stats-damage-self-mitigated').textContent = new Intl.NumberFormat('es-ES').format(damageMitigated);

  // Nota: Daño a objetivos/edificios no se acumula actualmente.
  // document.getElementById('stats-objective-damage').textContent = gameData.combat.damageToObjectives || 0;
  // document.getElementById('stats-building-damage').textContent = gameData.combat.damageToBuildings || 0;
}

// Ejemplo de acceso a Curación (actualmente no implementado/fiable)
// const totalHealing = gameData.combat?.healingDone || 0;
// document.getElementById('stats-total-healing').textContent = new Intl.NumberFormat('es-ES').format(totalHealing);
```

### Lista de Claves Disponibles (Principales)

Las claves disponibles incluyen (fuente principal entre paréntesis):

#### Datos del Invocador (LCD API)
- `gameData.summoner.name`: Nombre del invocador
// ... (resto de claves de summoner)

#### Datos de la Partida (LCD API)
- `gameData.match.gameMode`: Modo de juego
// ... (resto de claves de match como gameTime, kills, deaths, assists, cs, gold)

#### Datos de Combate (Acumulados GEP / LCD API)
- `gameData.combat.damageDealt`: Daño total infligido (Acumulado GEP)
- `gameData.combat.damageDealtToChampions`: Daño infligido a campeones (Acumulado GEP)
- `gameData.combat.damageTaken`: Daño total recibido (Acumulado GEP)
- `gameData.combat.damageSelfMitigated`: Daño mitigado por el propio jugador (LCD API, si disponible)
// - `gameData.combat.healingDone`: Curación realizada (Actualmente no fiable)

#### Datos de Visión (LCD API)
- `gameData.vision.wardsPlaced`: Guardianes colocados
- `gameData.vision.wardsDestroyed`: Guardianes destruidos
- `gameData.vision.visionScore`: Puntuación de visión

#### Estadísticas del Campeón (LCD API - vía `gameData.championStats`)
- `gameData.championStats.currentHealth`, `maxHealth`
- `gameData.championStats.abilityPower`, `attackDamage`, `attackSpeed`
- `gameData.championStats.armor`, `magicResist`
- `gameData.championStats.critChance`, `moveSpeed`, `tenacity`
// ... (y todas las demás claves listadas en la interfaz championStats)

#### Eventos GEP (GEP `onNewEvents`)
- `gameData.events`: Array de objetos, cada uno representando un evento GEP recibido (útil para debugging o la pestaña de eventos).

### Acceso a Datos Detallados del Jugador Activo (Live Client Data)

Los datos más específicos del campeón que estás jugando se obtienen de la LCD API y se almacenan en `gameData.championStats`.

```javascript
// Estadísticas del campeón activo
const champStats = gameData.championStats;
if (champStats) {
  const currentHealth = champStats.currentHealth || 0;
  const maxHealth = champStats.maxHealth || 0;
  const attackDamage = champStats.attackDamage || 0;
  const abilityPower = champStats.abilityPower || 0;
  const armor = champStats.armor || 0;
  const mr = champStats.magicResist || 0;
  const critPercent = (champStats.critChance || 0) * 100;

  // Actualizar UI específica del campeón
  document.getElementById('stats-champ-health').textContent = `${Math.round(currentHealth)} / ${Math.round(maxHealth)}`;
  document.getElementById('stats-champ-ad').textContent = Math.round(attackDamage);
  document.getElementById('stats-champ-ap').textContent = Math.round(abilityPower);
  // ... etc para las demás estadísticas ...
}

// Ejemplo de acceso a niveles de habilidad (si LCD API los provee y se procesan)
// const abilities = gameData.activePlayer?.abilities; // Depende de si se extrae de allgamedata
// if (abilities) { ... }
```

### Subscribirse a Actualizaciones

Para recibir actualizaciones automáticas cuando `GameDataManager` actualiza los datos (ya sea por LCD API o GEP):

```javascript
function updateUI(gameData) {
  // Actualizar TODA la UI con los nuevos datos combinados
  // ... KDA, CS, Oro ...
  // ... Daño Acumulado ...
  // ... Estadísticas del Campeón ...
}

// Subscribirse a actualizaciones
// Asegúrate de que gameDataManager esté disponible globalmente o importado correctamente
if (window.parent?.gameDataManager && typeof window.parent.subscribeToGameData === 'function') {
  // Desde una ventana hija (como un tab HTML)
  window.parent.subscribeToGameData(updateUI);
  // Obtener datos iniciales
  const initialData = window.parent.getGameData();
  if (initialData) updateUI(initialData);
} else if (gameDataManager && typeof gameDataManager.subscribe === 'function') {
  // Desde el contexto donde gameDataManager está definido
  gameDataManager.subscribe(updateUI);
}
```

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
