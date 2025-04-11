// Función para añadir a los logs
function addToLog(logElement, data, highlight = false) {
  if (!logElement) return;
  
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data, null, 2);
  
  if (highlight) {
    pre.className = 'highlight';
  }
  
  logElement.appendChild(pre);
  logElement.scrollTop = logElement.scrollHeight;
  
  // Limitar el número de logs
  while (logElement.childElementCount > 50) {
    logElement.removeChild(logElement.firstChild);
  }
}

// Formatear tiempo de juego
function formatGameTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
} 