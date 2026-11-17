const STOPS = [
  [0, [36, 82, 168]],
  [3, [28, 140, 186]],
  [6, [42, 186, 132]],
  [10, [92, 198, 58]],
  [15, [214, 212, 52]],
  [20, [232, 148, 40]],
  [26, [224, 68, 72]],
  [33, [176, 42, 148]],
  [42, [96, 22, 110]],
];

export function windColor(speed, alpha) {
  const value = Math.max(0, speed);
  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let index = 0; index < STOPS.length - 1; index += 1) {
    if (value >= STOPS[index][0] && value <= STOPS[index + 1][0]) {
      lower = STOPS[index];
      upper = STOPS[index + 1];
      break;
    }
  }
  const span = upper[0] - lower[0] || 1;
  const t = Math.min(1, Math.max(0, (value - lower[0]) / span));
  const mix = (channel) => Math.round(lower[1][channel] + (upper[1][channel] - lower[1][channel]) * t);
  return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${alpha})`;
}

export function sampleWind(field, index, lat, lng) {
  if (!field?.frames?.length) return null;
  const frame = field.frames[Math.min(field.frames.length - 1, Math.max(0, index))];
  const x = (lng - field.lng0) / field.dLng;
  const y = (lat - field.lat0) / field.dLat;
  if (x < 0 || y < 0 || x > field.cols - 1 || y > field.rows - 1) return null;
  const col = Math.floor(x);
  const row = Math.floor(y);
  const right = Math.min(field.cols - 1, col + 1);
  const below = Math.min(field.rows - 1, row + 1);
  const tx = x - col;
  const ty = y - row;
  const at = (r, c) => r * field.cols + c;
  const mix = (arr) => {
    const a = arr[at(row, col)] || 0;
    const b = arr[at(row, right)] || 0;
    const c = arr[at(below, col)] || 0;
    const d = arr[at(below, right)] || 0;
    return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 10;
  };
  const u = mix(frame.u);
  const v = mix(frame.v);
  return { u, v, speed: Math.hypot(u, v) };
}

function paintTexture(texture, field, index) {
  texture.width = field.cols;
  texture.height = field.rows;
  const ctx = texture.getContext('2d');
  const image = ctx.createImageData(field.cols, field.rows);
  const frame = field.frames[Math.min(field.frames.length - 1, Math.max(0, index))];
  for (let row = 0; row < field.rows; row += 1) {
    for (let col = 0; col < field.cols; col += 1) {
      const at = row * field.cols + col;
      const speed = Math.hypot((frame.u[at] || 0) / 10, (frame.v[at] || 0) / 10);
      const color = windColor(speed, 1).match(/\d+/g).map(Number);
      const pixel = ((field.rows - 1 - row) * field.cols + col) * 4;
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function attachWind(map, L, getState) {
  const pane = map.createPane('wind');
  pane.style.zIndex = 200;
  pane.style.pointerEvents = 'none';
  const colorCanvas = L.DomUtil.create('canvas', 'wind-canvas', pane);
  const particleCanvas = L.DomUtil.create('canvas', 'wind-canvas', pane);
  const texture = document.createElement('canvas');
  colorCanvas.style.pointerEvents = 'none';
  particleCanvas.style.pointerEvents = 'none';
  const particles = [];
  let running = true;
  let frameId = 0;
  let textureKey = '';
  let lastIndex = -1;
  let lastShow = true;

  function place(canvas) {
    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }
  }

  function drawColor() {
    const { wind: field, index = 0, show = true } = getState();
    place(colorCanvas);
    const ctx = colorCanvas.getContext('2d');
    ctx.clearRect(0, 0, colorCanvas.width, colorCanvas.height);
    if (!show || !field?.frames?.length) return;
    const key = `${index}|${field.times?.[index] || ''}`;
    if (key !== textureKey) {
      paintTexture(texture, field, index);
      textureKey = key;
    }
    const north = field.lat0 + (field.rows - 0.5) * field.dLat;
    const south = field.lat0 - 0.5 * field.dLat;
    const west = field.lng0 - 0.5 * field.dLng;
    const east = field.lng0 + (field.cols - 0.5) * field.dLng;
    const nw = map.latLngToContainerPoint([north, west]);
    const se = map.latLngToContainerPoint([south, east]);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.32;
    ctx.drawImage(texture, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.globalAlpha = 1;
  }

  function spawn(bounds) {
    return {
      lat: bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth()),
      lng: bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest()),
      age: Math.random() * 90,
      life: 70 + Math.random() * 90,
    };
  }

  function stepParticles() {
    place(particleCanvas);
    const ctx = particleCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
    ctx.fillRect(0, 0, particleCanvas.width, particleCanvas.height);
    ctx.globalCompositeOperation = 'source-over';
    const { wind: field, index = 0, show = true } = getState();
    if (!show || !field) {
      ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
      return;
    }
    if (index !== lastIndex) {
      drawColor();
      lastIndex = index;
    }
    const bounds = map.getBounds().pad(0.08);
    const count = Math.min(2800, Math.round((particleCanvas.width * particleCanvas.height) / 280));
    while (particles.length < count) particles.push(spawn(bounds));
    if (particles.length > count) particles.length = count;
    const step = 2.4 / 60;
    ctx.lineCap = 'round';
    particles.forEach((particle, at) => {
      const wind = sampleWind(field, index, particle.lat, particle.lng);
      if (!wind || particle.age > particle.life || !bounds.contains([particle.lat, particle.lng])) {
        particles[at] = spawn(map.getBounds());
        return;
      }
      const from = map.latLngToContainerPoint([particle.lat, particle.lng]);
      const lat = particle.lat + ((wind.v * 3.6 * step) / 111.32);
      const lng = particle.lng + ((wind.u * 3.6 * step) / (111.32 * Math.max(0.25, Math.cos(particle.lat * Math.PI / 180))));
      const to = map.latLngToContainerPoint([lat, lng]);
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.95, 0.35 + wind.speed / 24)})`;
      ctx.lineWidth = wind.speed > 18 ? 1.8 : 1.15;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      particle.lat = lat;
      particle.lng = lng;
      particle.age += 1;
    });
  }

  function tick() {
    if (!running) return;
    const show = getState().show !== false;
    if (show !== lastShow) {
      lastShow = show;
      drawColor();
    }
    stepParticles();
    frameId = requestAnimationFrame(tick);
  }

  map.on('move zoom resize', drawColor);
  drawColor();
  frameId = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(frameId);
    map.off('move zoom resize', drawColor);
    colorCanvas.remove();
    particleCanvas.remove();
  };
}
