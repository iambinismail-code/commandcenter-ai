/* ═══════════════════════════════════════════════════════════
   CommandCenter AI — Canvas Charts (No Libraries)
   window.Charts.Bar(canvas, data, opts)
   window.Charts.Line(canvas, data, opts)
   window.Charts.Doughnut(canvas, data, opts)
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const COLORS = ['#667eea','#764ba2','#00d2ff','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6'];
  const FONT   = "'Inter', sans-serif";

  /* ── Helpers ──────────────────────────────────────────── */
  function setupCanvas(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  }

  function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function animate(draw, duration = 800) {
    const start = performance.now();
    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      draw(ease(t));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ── Bar Chart ───────────────────────────────────────── */
  function Bar(canvas, data, opts = {}) {
    if (!canvas) return;
    const { labels = [], values = [], colors = COLORS, title = '' } = data;
    const W = opts.width  || canvas.parentElement.clientWidth || 400;
    const H = opts.height || 220;
    const ctx = setupCanvas(canvas, W, H);

    const pad   = { top: title ? 36 : 16, right: 16, bottom: 36, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const max    = Math.max(...values, 1) * 1.1;
    const barW   = Math.min(chartW / labels.length * 0.6, 40);
    const gap    = chartW / labels.length;

    animate(t => {
      ctx.clearRect(0, 0, W, H);

      // Title
      if (title) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 13px ${FONT}`;
        ctx.fillText(title, pad.left, 20);
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + chartH - (chartH * i / 4);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max * i / 4).toLocaleString(), pad.left - 8, y + 4);
      }

      // Bars
      values.forEach((v, i) => {
        const x = pad.left + gap * i + (gap - barW) / 2;
        const barH = (v / max) * chartH * t;
        const y = pad.top + chartH - barH;

        const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
        const c = colors[i % colors.length];
        grad.addColorStop(0, c);
        grad.addColorStop(1, c + '44');
        ctx.fillStyle = grad;

        ctx.beginPath();
        const r = 4;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, pad.top + chartH);
        ctx.lineTo(x, pad.top + chartH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.fill();

        // Labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(labels[i] || '', x + barW / 2, H - pad.bottom + 18);
      });
    });
  }

  /* ── Line Chart ──────────────────────────────────────── */
  function Line(canvas, data, opts = {}) {
    if (!canvas) return;
    const { labels = [], values = [], color = COLORS[0], title = '' } = data;
    const W = opts.width  || canvas.parentElement.clientWidth || 400;
    const H = opts.height || 220;
    const ctx = setupCanvas(canvas, W, H);

    const pad   = { top: title ? 36 : 16, right: 16, bottom: 36, left: 48 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const max    = Math.max(...values, 1) * 1.15;
    const step   = chartW / Math.max(labels.length - 1, 1);

    animate(t => {
      ctx.clearRect(0, 0, W, H);

      if (title) {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `600 13px ${FONT}`;
        ctx.fillText(title, pad.left, 20);
      }

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + chartH - (chartH * i / 4);
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.fillStyle = '#64748b';
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max * i / 4).toLocaleString(), pad.left - 8, y + 4);
      }

      // Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      labels.forEach((l, i) => {
        if (labels.length <= 12 || i % Math.ceil(labels.length / 8) === 0) {
          ctx.fillText(l, pad.left + step * i, H - pad.bottom + 18);
        }
      });

      // Area fill
      const pts = values.map((v, i) => ({
        x: pad.left + step * i,
        y: pad.top + chartH - (v / max) * chartH * t,
      }));

      if (pts.length > 1) {
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
        grad.addColorStop(0, color + '30');
        grad.addColorStop(1, color + '05');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pad.top + chartH);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH);
        ctx.fill();

        // Line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // Dots
        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#0f1419';
          ctx.fill();
        });
      }
    });
  }

  /* ── Doughnut Chart ──────────────────────────────────── */
  function Doughnut(canvas, data, opts = {}) {
    if (!canvas) return;
    const { labels = [], values = [], colors = COLORS } = data;
    const size = opts.size || Math.min(canvas.parentElement.clientWidth, 220);
    const W = size, H = size;
    const ctx = setupCanvas(canvas, W, H);

    const cx = W / 2, cy = H / 2;
    const outerR = Math.min(W, H) / 2 - 10;
    const innerR = outerR * 0.62;
    const total  = values.reduce((a, b) => a + b, 0) || 1;

    animate(t => {
      ctx.clearRect(0, 0, W, H);
      let angle = -Math.PI / 2;
      values.forEach((v, i) => {
        const sweep = (v / total) * Math.PI * 2 * t;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, angle, angle + sweep);
        ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        angle += sweep;
      });

      // Center text
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `700 ${Math.round(outerR * 0.35)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total.toLocaleString(), cx, cy - 4);
      ctx.fillStyle = '#94a3b8';
      ctx.font = `11px ${FONT}`;
      ctx.fillText('Total', cx, cy + 16);
    });
  }

  window.Charts = { Bar, Line, Doughnut };
})();
