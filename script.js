document.addEventListener('DOMContentLoaded', () => {

  // AÑO ACTUAL
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // QR CODE
  const qrContainer = document.getElementById('qrcode');
  if (qrContainer && typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: 'https://wa.me/56931494950',
      width: 180, height: 180,
      colorDark: '#d0d4e4', colorLight: '#161e3c',
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // ════════════════════════════════════════════════════════════
  //   CANVAS — ESCENA NOCTURNA
  // ════════════════════════════════════════════════════════════
  const canvas = document.getElementById('particles-canvas');
  const ctx    = canvas ? canvas.getContext('2d') : null;
  if (!canvas || !ctx) return;

  // Polyfill roundRect
  if (!ctx.roundRect) {
    ctx.roundRect = function(x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x+r, y); this.lineTo(x+w-r, y);
      this.quadraticCurveTo(x+w, y, x+w, y+r);
      this.lineTo(x+w, y+h-r);
      this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
      this.lineTo(x+r, y+h);
      this.quadraticCurveTo(x, y+h, x, y+h-r);
      this.lineTo(x, y+r);
      this.quadraticCurveTo(x, y, x+r, y);
      this.closePath();
    };
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── DATOS DE LA ESCENA (generados una vez) ────────────────────────────────

  // Estrellas
  const stars = Array.from({ length: 140 }, () => ({
    x:     Math.random(),
    y:     Math.random() * 0.52,
    r:     Math.random() * 1.5 + 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 2,
    gold:  Math.random() < 0.14
  }));

  // Ciudad
  const buildings = Array.from({ length: 24 }, (_, i) => {
    const w = 35 + Math.random() * 85;
    const h = 55 + Math.random() * 210;
    const cols = Math.floor(w / 13);
    const rows = Math.floor(h / 17);
    return {
      xNorm: i / 24,
      w, h,
      windows: Array.from({ length: cols * rows }, () => ({
        lit:   Math.random() < 0.38,
        timer: Math.floor(Math.random() * 350)
      }))
    };
  });

  // Destellos dorados flotantes
  const sparkles = Array.from({ length: 40 }, () => ({
    x:  Math.random(),
    y:  0.42 + Math.random() * 0.58,
    vy: -(0.0008 + Math.random() * 0.0018),
    r:  Math.random() * 2 + 0.4,
    op: Math.random(),
    ph: Math.random() * Math.PI * 2
  }));

  // Carretera perspectiva
  const DASH_N = 16;
  let roadScroll = 0;
  const ROAD_SPEED = 0.009;

  // Carreteras laterales
  const ROAD_W   = 145;
  const CONE_GAP = 175;
  const SIDE_SPD = 2.3;
  let sideDash   = 0;
  let sideOffset = 0;

  // Estado
  let wobbleTime = 0;
  let frame      = 0;
  let signYL     = 0.2;
  let signYR     = 0.62;

  // ── PERSPECTIVA: worldX(-1..1), worldZ(0=horizonte, 1=cámara) ────────────
  function toScreen(rx, rz, W, H, vpY) {
    const hw = W * 0.37;
    return [
      W / 2 + rx * hw * rz,
      vpY  + (H - vpY) * rz
    ];
  }

  // ── ESTRELLAS ─────────────────────────────────────────────────────────────
  function drawStars(W, H) {
    stars.forEach(s => {
      const op = 0.3 + 0.55 * Math.sin(s.phase + frame * s.speed * 0.018);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.gold
        ? `rgba(201,162,39,${op})`
        : `rgba(210,218,255,${op})`;
      ctx.fill();
    });
  }

  // ── CIUDAD ────────────────────────────────────────────────────────────────
  function drawCity(W, H) {
    const horizY = H * 0.44;

    buildings.forEach(b => {
      const bx = b.xNorm * W - b.w / 2;
      const by = horizY - b.h;

      // Silueta
      ctx.fillStyle = 'rgba(10, 14, 28, 0.92)';
      ctx.fillRect(bx, by, b.w, b.h);

      // Ventanas
      const cols = Math.floor(b.w / 13);
      const rows = Math.floor(b.h / 17);
      b.windows.forEach((win, idx) => {
        if (idx >= cols * rows) return;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const wx = bx + 3 + col * 13;
        const wy = by + 5 + row * 17;

        win.timer--;
        if (win.timer <= 0) {
          win.lit   = Math.random() < 0.38;
          win.timer = 120 + Math.floor(Math.random() * 450);
        }
        if (!win.lit) return;

        const isGold = Math.random() < 0.08;
        ctx.fillStyle = isGold
          ? 'rgba(255,190,80,0.65)'
          : 'rgba(210,225,255,0.55)';
        ctx.fillRect(wx, wy, 8, 9);

        // Halo sutil de la ventana
        ctx.fillStyle = isGold
          ? 'rgba(255,190,80,0.06)'
          : 'rgba(180,200,255,0.05)';
        ctx.fillRect(wx - 2, wy - 2, 12, 13);
      });
    });
  }

  // ── CARRETERA EN PERSPECTIVA ───────────────────────────────────────────────
  function drawPerspRoad(W, H) {
    const vpY = H * 0.44;

    // Superficie
    const [flx, fly] = toScreen(-1, 0.015, W, H, vpY);
    const [frx, fry] = toScreen( 1, 0.015, W, H, vpY);
    const [nlx, nly] = toScreen(-1, 1,     W, H, vpY);
    const [nrx, nry] = toScreen( 1, 1,     W, H, vpY);

    ctx.beginPath();
    ctx.moveTo(flx, fly); ctx.lineTo(frx, fry);
    ctx.lineTo(nrx, nry); ctx.lineTo(nlx, nly);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12, 17, 35, 0.88)';
    ctx.fill();

    // Gradiente de reflexión del asfalto
    const reflGrad = ctx.createLinearGradient(W/2, vpY, W/2, H);
    reflGrad.addColorStop(0, 'rgba(201,162,39,0)');
    reflGrad.addColorStop(0.6, 'rgba(201,162,39,0.04)');
    reflGrad.addColorStop(1, 'rgba(201,162,39,0.1)');
    ctx.beginPath();
    ctx.moveTo(flx, fly); ctx.lineTo(frx, fry);
    ctx.lineTo(nrx, nry); ctx.lineTo(nlx, nly);
    ctx.closePath();
    ctx.fillStyle = reflGrad;
    ctx.fill();

    // Bordes blancos (gradiente)
    function edgeLine(rx) {
      const [fx, fy] = toScreen(rx, 0.01, W, H, vpY);
      const [nx, ny] = toScreen(rx, 1,    W, H, vpY);
      const g = ctx.createLinearGradient(fx, fy, nx, ny);
      g.addColorStop(0, 'rgba(220,225,255,0)');
      g.addColorStop(1, 'rgba(220,225,255,0.5)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(nx, ny); ctx.stroke();
    }
    edgeLine(-1); edgeLine(1);

    // Línea central dorada discontinua
    for (let i = 0; i < DASH_N; i++) {
      const z = ((i / DASH_N) + roadScroll) % 1;
      if (z < 0.03) continue;

      // Alternar: solo la mitad son líneas (la otra es espacio)
      if (Math.floor(((i / DASH_N) + roadScroll) / (1 / DASH_N)) % 2 === 0) continue;

      const z2  = Math.min(z + 0.028, 1);
      const [x1, y1] = toScreen(0, z,  W, H, vpY);
      const [x2, y2] = toScreen(0, z2, W, H, vpY);
      const alpha = Math.min(z * 1.4, 0.75);

      ctx.strokeStyle = `rgba(201,162,39,${alpha})`;
      ctx.lineWidth   = Math.max(z * 4, 0.6);
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    // Carril izquierdo y derecho (blanco tenue)
    [-0.5, 0.5].forEach(rx => {
      for (let i = 0; i < DASH_N; i++) {
        const z = ((i / DASH_N) + roadScroll * 0.88) % 1;
        if (z < 0.04) continue;
        if (Math.floor(((i / DASH_N) + roadScroll * 0.88) / (1 / DASH_N)) % 2 === 0) continue;
        const z2 = Math.min(z + 0.022, 1);
        const [x1, y1] = toScreen(rx, z,  W, H, vpY);
        const [x2, y2] = toScreen(rx, z2, W, H, vpY);
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(z * 0.6, 0.28)})`;
        ctx.lineWidth = Math.max(z * 2.5, 0.4);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    });
  }

  // ── LUCES FRONTALES ───────────────────────────────────────────────────────
  function drawHeadlights(W, H) {
    const vpY = H * 0.44;

    [-60, 60].forEach(ox => {
      const bx = W / 2 + ox;

      // Haz de luz (cono)
      const beamGrad = ctx.createRadialGradient(bx, H, 2, bx, vpY, H - vpY);
      beamGrad.addColorStop(0, 'rgba(255,248,200,0.18)');
      beamGrad.addColorStop(0.5, 'rgba(255,248,200,0.05)');
      beamGrad.addColorStop(1, 'rgba(255,248,200,0)');

      ctx.beginPath();
      ctx.moveTo(bx, H);
      ctx.lineTo(W / 2 - 180, vpY);
      ctx.lineTo(W / 2 + 180, vpY);
      ctx.closePath();
      ctx.fillStyle = beamGrad;
      ctx.fill();

      // Foco (halo circular)
      const haloGrad = ctx.createRadialGradient(bx, H - 4, 0, bx, H - 4, 35);
      haloGrad.addColorStop(0, 'rgba(255,250,220,0.75)');
      haloGrad.addColorStop(0.3, 'rgba(255,245,180,0.25)');
      haloGrad.addColorStop(1, 'rgba(255,245,180,0)');
      ctx.beginPath();
      ctx.arc(bx, H - 4, 35, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();

      // Punto brillante
      ctx.beginPath();
      ctx.arc(bx, H - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,240,0.9)';
      ctx.fill();
    });
  }

  // ── DESTELLOS FLOTANTES ────────────────────────────────────────────────────
  function drawSparkles(W, H) {
    sparkles.forEach(s => {
      s.y += s.vy;
      if (s.y < 0.38) { s.y = 0.92 + Math.random() * 0.1; s.x = Math.random(); }
      const op = (0.25 + 0.55 * Math.sin(s.ph + frame * 0.03)) * s.op;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,162,39,${op})`;
      ctx.fill();
    });
  }

  // ── CARRETERAS LATERALES ──────────────────────────────────────────────────

  function drawSideRoad(x, H) {
    ctx.fillStyle = 'rgba(14, 20, 40, 0.76)';
    ctx.fillRect(x, 0, ROAD_W, H);
    ctx.strokeStyle = 'rgba(190,205,230,0.32)';
    ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, 0);         ctx.lineTo(x, H);         ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+ROAD_W, 0);  ctx.lineTo(x+ROAD_W, H); ctx.stroke();
    ctx.strokeStyle = 'rgba(201,162,39,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([30, 24]);
    ctx.lineDashOffset = -sideDash;
    ctx.beginPath();
    ctx.moveTo(x + ROAD_W / 2, 0);
    ctx.lineTo(x + ROAD_W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCone(cx, cy) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(8,8); ctx.lineTo(-8,8); ctx.closePath();
    ctx.fillStyle = 'rgba(255,105,15,0.82)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4,-1); ctx.lineTo(4,-1); ctx.lineTo(5,4); ctx.lineTo(-5,4); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
    ctx.fillStyle = 'rgba(210,80,5,0.55)'; ctx.fillRect(-9,6,18,4);
    ctx.restore();
  }

  function drawSideCones(roadX, phase, H) {
    const total   = (Math.ceil(H / CONE_GAP) + 3) * CONE_GAP;
    const numRows = Math.ceil(H / CONE_GAP) + 3;
    for (let r = 0; r < numRows; r++) {
      drawCone(roadX + ROAD_W * 0.18, ((r * CONE_GAP + phase + sideOffset) % total) - CONE_GAP);
      drawCone(roadX + ROAD_W * 0.82, ((r * CONE_GAP + phase + CONE_GAP * 0.5 + sideOffset) % total) - CONE_GAP);
    }
  }

  function drawSideSign(x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(150,150,165,0.45)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -48); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -62, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,232,232,0.76)'; ctx.fill();
    ctx.strokeStyle = 'rgba(200,30,30,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,20,0.9)'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('40', 0, -62);
    ctx.restore();
  }

  function drawSideCar(cx, cy, wobble) {
    const x = cx + wobble, cw = 26, ch = 48;
    ctx.save(); ctx.translate(x, cy);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = 'rgba(201,162,39,0.88)';
    ctx.roundRect(-cw/2, -ch/2, cw, ch, 6); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(120,185,235,0.62)';
    ctx.roundRect(-cw/2+4, -ch/2+6, cw-8, 12, 3); ctx.fill();
    ctx.fillStyle = 'rgba(120,185,235,0.4)';
    ctx.roundRect(-cw/2+4, ch/2-17, cw-8, 11, 3); ctx.fill();
    ctx.fillStyle = 'rgba(12,15,28,0.92)';
    [[-cw/2-5,-ch/2+7],[cw/2-2,-ch/2+7],[-cw/2-5,ch/2-18],[cw/2-2,ch/2-18]]
      .forEach(([wx,wy]) => ctx.fillRect(wx,wy,6,10));
    ctx.fillStyle = 'rgba(200,30,30,0.95)';
    ctx.roundRect(-7,-ch/2-12,14,10,3); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('L', 0, -ch/2-7);
    ctx.restore();
  }

  // ── BUCLE PRINCIPAL ────────────────────────────────────────────────────────
  function animate() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    frame++;
    roadScroll  = (roadScroll + ROAD_SPEED) % 1;
    wobbleTime += 0.025;

    drawStars(W, H);
    drawCity(W, H);
    drawPerspRoad(W, H);
    drawHeadlights(W, H);
    drawSparkles(W, H);

    // Carreteras laterales (pantallas > 550px)
    if (W > 550) {
      sideDash   = (sideDash   + SIDE_SPD * 1.1) % (30 + 24);
      sideOffset = (sideOffset + SIDE_SPD) % (CONE_GAP * 3);

      const leftX  = 0;
      const rightX = W - ROAD_W;

      drawSideRoad(leftX,  H);
      drawSideRoad(rightX, H);
      drawSideCones(leftX,  0, H);
      drawSideCones(rightX, CONE_GAP * 0.5, H);

      const ss = SIDE_SPD * 0.6;
      signYL = (signYL + ss / H > 1 + 80 / H) ? -80 / H : signYL + ss / H;
      signYR = (signYR + ss / H > 1 + 80 / H) ? -80 / H : signYR + ss / H;
      drawSideSign(leftX  + ROAD_W / 2, signYL * H);
      drawSideSign(rightX + ROAD_W / 2, signYR * H);

      const wL = Math.sin(wobbleTime) * 5 + Math.sin(wobbleTime * 2.2) * 2;
      const wR = Math.sin(wobbleTime + 2.1) * 5 + Math.sin(wobbleTime * 1.9) * 2;
      drawSideCar(leftX  + ROAD_W / 2, H * 0.72, wL);
      drawSideCar(rightX + ROAD_W / 2, H * 0.72, wR);
    }

    requestAnimationFrame(animate);
  }

  animate();

  // ── TILT 3D EN LA TARJETA ─────────────────────────────────────────────────
  const card = document.querySelector('.card');
  if (card && window.matchMedia('(hover: hover)').matches) {
    card.addEventListener('mousemove', (e) => {
      const rect    = card.getBoundingClientRect();
      const rotateX = ((e.clientY - rect.top  - rect.height / 2) / rect.height) * -8;
      const rotateY = ((e.clientX - rect.left - rect.width  / 2) / rect.width)  *  8;
      card.style.transition = 'transform 0.1s ease';
      card.style.transform  = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.5s ease';
      card.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
    });
  }

});
