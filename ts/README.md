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
├── background/
│   ├── background.ts         # Gestión del ciclo de vida
│   └── services/
│       ├── window.service.ts # Gestión de ventanas
│       └── auth.service.ts   # Autenticación
├── desktop/
│   ├── desktop.ts           # Interfaz de escritorio
│   └── components/
│       └── settings/        # Componentes de configuración
├── in_game/
│   ├── components/          # Componentes UI reutilizables
│   │   ├── tab-overview/
│   │   │   ├── index.ts
│   │   │   ├── overview.html
│   │   │   └── overview.css
│   │   ├── tab-stats/
│   │   └── tab-events/
│   ├── services/           # Servicios de datos y lógica
│   │   ├── gep.service.ts  # Game Events Provider
│   │   ├── lcd.service.ts  # Live Client Data
│   │   └── ads.service.ts  # Gestión de anuncios
│   ├── utils/             # Utilidades y helpers
│   │   ├── time.ts        # Formateo de tiempo
│   │   ├── stats.ts       # Cálculos estadísticos
│   │   └── dom.ts         # Manipulación DOM
│   └── in_game.ts         # Lógica principal in-game
└── shared/
    ├── interfaces/        # Definiciones TypeScript
    │   ├── game-data.ts
    │   └── events.ts
    ├── constants/         # Constantes globales
    │   ├── features.ts
    │   └── config.ts
    └── helpers/          # Funciones auxiliares
        ├── logger.ts
        └── performance.ts
```

## Licencia
Propietaria - Todos los derechos reservados
