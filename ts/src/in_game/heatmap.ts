import { OWGamesEvents } from "@overwolf/overwolf-api-ts";

interface GameEvent {
  type: 'kill' | 'death' | 'assist' | 'objective';
  position: { x: number, y: number };
  timestamp: number;
  details?: string;
}

interface PositionData {
  x: number;
  y: number;
  timestamp: number;
}

export class HeatmapManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mapImage: HTMLImageElement | null = null;
  private positions: PositionData[] = [];
  private events: GameEvent[] = [];
  private gameStartTime: number = 0;
  private gameEndTime: number = 0;
  private currentTimeFilter: number = 0;
  private eventFilters: { [key: string]: boolean } = {
    kill: true,
    death: true,
    assist: true,
    objective: true
  };
  private mapBounds = {
    minX: 0,
    maxX: 15000,
    minY: 0,
    maxY: 15000
  };
  private isInitialized = false;
  private isGameRunning = false;
  private gameEventsListener: OWGamesEvents | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Inicializar cuando se cargue la ventana
    window.addEventListener('load', () => {
      this.setupCanvas();
      this.setupEventListeners();
      this.setupGameListeners();
      this.isInitialized = true;
    });

    // Redimensionar el canvas cuando cambie el tamaño de la ventana
    window.addEventListener('resize', () => {
      if (this.isInitialized) {
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer && this.canvas) {
          const containerWidth = mapContainer.clientWidth;
          const containerHeight = mapContainer.clientHeight;
          this.canvas.width = containerWidth;
          this.canvas.height = containerHeight;
          this.drawHeatmap();
        }
      }
    });
  }

  private setupCanvas(): void {
    this.canvas = document.getElementById('heatmap-canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      console.error('No se pudo encontrar el elemento canvas para el mapa de calor');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error('No se pudo obtener el contexto 2D del canvas');
      return;
    }

    // Asegurar que el canvas tenga el tamaño correcto
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
      const containerWidth = mapContainer.clientWidth;
      const containerHeight = mapContainer.clientHeight;
      this.canvas.width = containerWidth;
      this.canvas.height = containerHeight;
    }

    // Cargar la imagen del mapa
    this.mapImage = new Image();
    this.mapImage.src = '../img/summoners-rift.svg';
    this.mapImage.onload = () => {
      this.drawHeatmap();
    };
  }

  private setupEventListeners(): void {
    // Configurar filtros de eventos
    const eventTypes = ['kill', 'death', 'assist', 'objective'];
    eventTypes.forEach(type => {
      const checkbox = document.getElementById(`filter-${type}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.eventFilters[type] = checkbox.checked;
          this.drawHeatmap();
        });
      }
    });

    // Configurar slider de tiempo
    const timeSlider = document.getElementById('time-slider') as HTMLInputElement;
    if (timeSlider) {
      timeSlider.addEventListener('input', () => {
        this.currentTimeFilter = parseInt(timeSlider.value);
        this.updateTimeDisplay();
        this.drawHeatmap();
      });
    }
  }

  private setupGameListeners(): void {
    // Registrar para eventos de información del juego
    overwolf.games.onGameInfoUpdated.addListener(this.onGameInfoUpdated.bind(this));
    
    // Configurar el listener para eventos del juego
    const gameFeatures = [
      'location',
      'match_info',
      'kill',
      'death',
      'assist',
      'objective'
    ];
    
    // Crear el listener de eventos del juego
    this.gameEventsListener = new OWGamesEvents(
      {
        onInfoUpdates: this.onInfoUpdates.bind(this),
        onNewEvents: this.onNewEvents.bind(this)
      },
      gameFeatures
    );
    
    // Iniciar el listener
    this.gameEventsListener.start();
    console.log('Listener de eventos del juego iniciado para el mapa de calor');
    
    // Para pruebas: Añadir eventos simulados
    this.addSimulatedEvents();
  }

  private onGameInfoUpdated(info: any): void {
    if (info && info.gameInfo) {
      if (info.gameInfo.isRunning && !this.isGameRunning) {
        // El juego ha comenzado
        this.isGameRunning = true;
        this.gameStartTime = Date.now();
        this.resetData();
      } else if (!info.gameInfo.isRunning && this.isGameRunning) {
        // El juego ha terminado
        this.isGameRunning = false;
        this.gameEndTime = Date.now();
        this.updateTimeSlider();
      }
    }
  }

  private onInfoUpdates(info: any): void {
    if (!this.isGameRunning) return;

    // Actualizar posición del jugador
    if (info.location && info.location.position) {
      try {
        const position = JSON.parse(info.location.position);
        if (position && typeof position.x === 'number' && typeof position.y === 'number') {
          // Verificar que las coordenadas estén dentro de los límites esperados
          if (position.x >= this.mapBounds.minX && position.x <= this.mapBounds.maxX &&
              position.y >= this.mapBounds.minY && position.y <= this.mapBounds.maxY) {
            this.addPosition(position.x, position.y);
          } else {
            console.warn('Coordenadas fuera de los límites esperados:', position);
          }
        }
      } catch (e) {
        console.error('Error al procesar la posición del jugador:', e);
      }
    }
    
    // Registrar información adicional si está disponible
    if (info.match_info) {
      // Actualizar información del juego si está disponible
      if (info.match_info.game_mode) {
        console.log('Modo de juego:', info.match_info.game_mode);
      }
      if (info.match_info.game_time) {
        console.log('Tiempo de juego:', info.match_info.game_time);
      }
    }
  }

  private onNewEvents(events: any[]): void {
    if (!this.isGameRunning) return;

    events.forEach(event => {
      if (!event || !event.name) return;

      // Registrar el evento para depuración
      this.logEventForDebug(event);

      // Procesar eventos según su tipo
      switch (event.name) {
        case 'kill':
          this.addEvent('kill', event.data);
          break;
        case 'death':
          this.addEvent('death', event.data);
          break;
        case 'assist':
          this.addEvent('assist', event.data);
          break;
        case 'objective':
          this.addEvent('objective', event.data);
          break;
      }
    });
  }

  private logEventForDebug(event: any): void {
    // Solo registrar en consola en desarrollo
    // Usamos una variable para simular el entorno de desarrollo
    const isDevelopment = true; // En producción, cambiar a false
    
    if (isDevelopment) {
      console.group(`Evento: ${event.name}`);
      console.log('Datos completos:', event.data);
      
      if (event.data && event.data.position) {
        try {
          const position = typeof event.data.position === 'string' 
            ? JSON.parse(event.data.position) 
            : event.data.position;
          
          console.log('Posición:', position);
          console.log('Coordenadas normalizadas:', {
            x: this.normalizeCoordinate(position.x, this.mapBounds.minX, this.mapBounds.maxX),
            y: this.normalizeCoordinate(position.y, this.mapBounds.minY, this.mapBounds.maxY)
          });
        } catch (e) {
          console.error('Error al procesar posición para depuración:', e);
        }
      }
      
      console.groupEnd();
    }
  }

  private addPosition(x: number, y: number): void {
    // Normalizar coordenadas al rango del mapa
    const normalizedX = this.normalizeCoordinate(x, this.mapBounds.minX, this.mapBounds.maxX);
    const normalizedY = this.normalizeCoordinate(y, this.mapBounds.minY, this.mapBounds.maxY);

    this.positions.push({
      x: normalizedX,
      y: normalizedY,
      timestamp: Date.now()
    });

    // Actualizar el mapa de calor periódicamente, no en cada actualización para evitar sobrecarga
    if (this.positions.length % 10 === 0) {
      this.drawHeatmap();
    }
  }

  private addEvent(type: 'kill' | 'death' | 'assist' | 'objective', data: any): void {
    if (!data || !data.position) return;

    try {
      const position = typeof data.position === 'string' 
        ? JSON.parse(data.position) 
        : data.position;

      if (position && typeof position.x === 'number' && typeof position.y === 'number') {
        const normalizedX = this.normalizeCoordinate(position.x, this.mapBounds.minX, this.mapBounds.maxX);
        const normalizedY = this.normalizeCoordinate(position.y, this.mapBounds.minY, this.mapBounds.maxY);

        // Extraer detalles adicionales según el tipo de evento
        let details = '';
        
        if (type === 'kill') {
          details = data.killerName ? `${data.killerName} eliminó a ${data.victimName || 'un enemigo'}` : 'Eliminación';
          if (data.killType) {
            details += ` (${data.killType})`;
          }
        } else if (type === 'death') {
          details = data.killerName ? `Eliminado por ${data.killerName}` : 'Muerte';
        } else if (type === 'assist') {
          details = data.assistingParticipants ? 
            `Asistencia con ${data.assistingParticipants.join(', ')}` : 'Asistencia';
        } else if (type === 'objective') {
          details = data.objectiveType ? `${data.objectiveType} ${data.stolen ? '(robado)' : ''}` : 'Objetivo';
        }

        this.events.push({
          type,
          position: { x: normalizedX, y: normalizedY },
          timestamp: Date.now(),
          details: details || data.details || ''
        });

        // Actualizar el mapa de calor cuando ocurre un evento
        this.drawHeatmap();
      }
    } catch (e) {
      console.error(`Error al procesar evento ${type}:`, e);
    }
  }

  private normalizeCoordinate(value: number, min: number, max: number): number {
    // Asegurar que el valor está dentro de los límites
    const clampedValue = Math.max(min, Math.min(max, value));
    // Normalizar al rango [0, 1]
    return (clampedValue - min) / (max - min);
  }

  private resetData(): void {
    this.positions = [];
    this.events = [];
    this.updateZoneStatistics();
    this.drawHeatmap();
  }

  private updateTimeSlider(): void {
    const timeSlider = document.getElementById('time-slider') as HTMLInputElement;
    if (timeSlider) {
      const gameDuration = this.gameEndTime - this.gameStartTime;
      timeSlider.max = gameDuration.toString();
      timeSlider.value = gameDuration.toString();
      this.currentTimeFilter = gameDuration;
      this.updateTimeDisplay();
    }
  }

  private updateTimeDisplay(): void {
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) {
      const minutes = Math.floor(this.currentTimeFilter / 60000);
      const seconds = Math.floor((this.currentTimeFilter % 60000) / 1000);
      timeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private updateZoneStatistics(): void {
    // Definir zonas del mapa (coordenadas normalizadas)
    const zones = {
      topLane: { minX: 0, maxX: 0.33, minY: 0, maxY: 0.33 },
      midLane: { minX: 0.33, maxX: 0.67, minY: 0.33, maxY: 0.67 },
      botLane: { minX: 0.67, maxX: 1, minY: 0.67, maxY: 1 },
      jungle: { minX: 0.33, maxX: 0.67, minY: 0, maxY: 0.33 },
      river: { minX: 0.33, maxX: 0.67, minY: 0.33, maxY: 0.67 }
    };

    // Contar posiciones en cada zona
    const zoneCounts: { [key: string]: number } = {
      topLane: 0,
      midLane: 0,
      botLane: 0,
      jungle: 0,
      river: 0
    };

    // Filtrar posiciones por tiempo si es necesario
    const filteredPositions = this.positions.filter(pos => 
      pos.timestamp <= this.gameStartTime + this.currentTimeFilter
    );

    // Contar posiciones por zona
    filteredPositions.forEach(pos => {
      for (const [zoneName, zone] of Object.entries(zones)) {
        if (pos.x >= zone.minX && pos.x <= zone.maxX && 
            pos.y >= zone.minY && pos.y <= zone.maxY) {
          zoneCounts[zoneName]++;
          break;
        }
      }
    });

    // Calcular porcentajes
    const total = Object.values(zoneCounts).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      // Mapeo de nombres de zonas en inglés a español
      const zoneNamesMap = {
        topLane: 'Top Lane',
        midLane: 'Mid Lane',
        botLane: 'Bot Lane',
        jungle: 'Jungla',
        river: 'Río'
      };
      
      // Actualizar los elementos HTML directamente
      for (const [zone, count] of Object.entries(zoneCounts)) {
        const percentage = (count / total * 100).toFixed(1);
        
        // Buscar todos los elementos .zone-name y encontrar el que contiene el texto
        const zoneNameElements = document.querySelectorAll('.zone-name');
        zoneNameElements.forEach(el => {
          if (el.textContent.includes(zoneNamesMap[zone])) {
            // Encontrar el elemento .zone-value hermano
            const parent = el.parentElement;
            if (parent) {
              const valueElement = parent.querySelector('.zone-value');
              if (valueElement) {
                valueElement.textContent = `${percentage}% del tiempo`;
              }
            }
          }
        });
      }
    }
  }

  public drawHeatmap(): void {
    if (!this.canvas || !this.ctx || !this.mapImage) return;

    // Limpiar canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Dibujar imagen del mapa
    this.ctx.drawImage(this.mapImage, 0, 0, this.canvas.width, this.canvas.height);

    // Filtrar datos por tiempo
    const currentTime = this.gameStartTime + this.currentTimeFilter;
    const filteredPositions = this.positions.filter(pos => pos.timestamp <= currentTime);
    const filteredEvents = this.events.filter(event => 
      event.timestamp <= currentTime && this.eventFilters[event.type]
    );

    // Dibujar mapa de calor
    this.drawHeatmapData(filteredPositions);

    // Dibujar eventos
    this.drawEvents(filteredEvents);

    // Actualizar estadísticas de zonas
    this.updateZoneStatistics();
  }

  private drawHeatmapData(positions: PositionData[]): void {
    if (!this.canvas || !this.ctx) return;

    // Crear un mapa de intensidad
    const intensityMap = new Array(this.canvas.width).fill(0)
      .map(() => new Array(this.canvas.height).fill(0));

    // Calcular intensidad en cada punto
    positions.forEach(pos => {
      const x = Math.floor(pos.x * this.canvas.width);
      const y = Math.floor(pos.y * this.canvas.height);
      
      // Aplicar un radio de influencia
      const radius = 15;
      for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
          const distance = Math.sqrt(i*i + j*j);
          if (distance <= radius) {
            const intensity = 1 - (distance / radius);
            const pixelX = x + i;
            const pixelY = y + j;
            
            if (pixelX >= 0 && pixelX < this.canvas.width && 
                pixelY >= 0 && pixelY < this.canvas.height) {
              intensityMap[pixelX][pixelY] += intensity;
            }
          }
        }
      }
    });

    // Encontrar el valor máximo de intensidad
    let maxIntensity = 0;
    for (let x = 0; x < this.canvas.width; x++) {
      for (let y = 0; y < this.canvas.height; y++) {
        maxIntensity = Math.max(maxIntensity, intensityMap[x][y]);
      }
    }

    // Dibujar el mapa de calor con un gradiente de colores
    const imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    for (let x = 0; x < this.canvas.width; x++) {
      for (let y = 0; y < this.canvas.height; y++) {
        const intensity = intensityMap[x][y] / maxIntensity;
        if (intensity > 0.05) { // Umbral mínimo para mostrar color
          const index = (y * this.canvas.width + x) * 4;
          
          // Gradiente de color: azul (frío) a rojo (caliente)
          const r = Math.min(255, Math.floor(intensity * 255 * 2));
          const g = Math.min(255, Math.floor(intensity * 100));
          const b = Math.min(255, Math.floor((1 - intensity) * 255));
          
          imageData.data[index] = r;
          imageData.data[index + 1] = g;
          imageData.data[index + 2] = b;
          imageData.data[index + 3] = Math.min(200, Math.floor(intensity * 255)); // Alpha (transparencia)
        }
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  private drawEvents(events: GameEvent[]): void {
    if (!this.canvas || !this.ctx) return;

    // Limpiar los marcadores de eventos anteriores
    const eventMarkers = document.getElementById('event-markers');
    if (eventMarkers) {
      eventMarkers.innerHTML = '';
    }

    events.forEach(event => {
      const x = event.position.x * this.canvas.width;
      const y = event.position.y * this.canvas.height;
      
      // Crear un elemento para el marcador de evento
      if (eventMarkers) {
        const marker = document.createElement('div');
        marker.className = `event-marker ${event.type}`;
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
        
        // Añadir tooltip al pasar el ratón
        marker.addEventListener('mouseover', (e) => {
          const tooltip = document.getElementById('event-tooltip');
          if (tooltip) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.clientX + 10}px`;
            tooltip.style.top = `${e.clientY + 10}px`;
            
            const gameTime = Math.floor((event.timestamp - this.gameStartTime) / 1000);
            const minutes = Math.floor(gameTime / 60);
            const seconds = gameTime % 60;
            
            // Coordenadas originales (no normalizadas)
            const originalX = Math.round(event.position.x * this.mapBounds.maxX);
            const originalY = Math.round(event.position.y * this.mapBounds.maxY);
            
            tooltip.innerHTML = `
              <strong>${this.getEventTypeName(event.type)}</strong><br>
              Tiempo: ${minutes}:${seconds.toString().padStart(2, '0')}<br>
              Posición: (${originalX}, ${originalY})<br>
              ${event.details ? `Detalles: ${event.details}` : ''}
            `;
          }
        });
        
        marker.addEventListener('mouseout', () => {
          const tooltip = document.getElementById('event-tooltip');
          if (tooltip) {
            tooltip.style.display = 'none';
          }
        });
        
        eventMarkers.appendChild(marker);
      }
    });
  }

  private getEventTypeName(type: string): string {
    switch(type) {
      case 'kill': return 'ELIMINACIÓN';
      case 'death': return 'MUERTE';
      case 'assist': return 'ASISTENCIA';
      case 'objective': return 'OBJETIVO';
      default: return type.toUpperCase();
    }
  }

  // Método para añadir eventos simulados para pruebas
  private addSimulatedEvents(): void {
    // Simular una kill en la parte superior
    this.addEvent('kill', {
      position: JSON.stringify({ x: 3000, y: 3000 }),
      killerName: 'Jugador',
      victimName: 'Enemigo',
      killType: 'Normal'
    });
    
    // Simular una muerte en la parte inferior
    this.addEvent('death', {
      position: JSON.stringify({ x: 12000, y: 12000 }),
      killerName: 'Enemigo'
    });
    
    // Simular una asistencia en el medio
    this.addEvent('assist', {
      position: JSON.stringify({ x: 7500, y: 7500 }),
      assistingParticipants: ['Aliado1', 'Aliado2']
    });
    
    // Simular un objetivo en el río
    this.addEvent('objective', {
      position: JSON.stringify({ x: 9000, y: 6000 }),
      objectiveType: 'Dragón',
      stolen: false
    });
    
    // Simular posiciones del jugador
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 15000;
      const y = Math.random() * 15000;
      this.addPosition(x, y);
    }
    
    // Actualizar las estadísticas
    this.updateZoneStatistics();
  }
}

// Inicializar el mapa de calor cuando se cargue la página
window.addEventListener('load', () => {
  new HeatmapManager();
}); 