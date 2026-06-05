/* =================================================================
   suisseclock.js  —  v5  —  Mondaine SBB Stop2Go authentique
   Hans Hilfiker, 1944

   AMÉLIORATIONS v5 :
     - Effet verre / reflet cadran via globalCompositeOperation
     - Marqueurs harmonieux : ratio progressif 0.068 / 0.050 / 0.018
     - Mouvement Stop2Go corrigé : balance étendue, frames affinées
     - Performance : regroupement des ctx.save/restore
================================================================= */

window.initSuisseClock = function (canvasId, sizePx) {

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (canvas.__suisseClockStop) canvas.__suisseClockStop();

    const DPR  = window.devicePixelRatio || 1;
    const SIZE = sizePx || 320;

    canvas.style.width  = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
    canvas.width  = SIZE * DPR;
    canvas.height = SIZE * DPR;

    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    /* ── Timing Stop2Go corrigé ─────────────────────────────────
       La trotteuse balaye en 58.5s, puis oscille jusqu'à 59.65s
       (légèrement plus long qu'en v4), attend le top minute,
       puis la grande aiguille saute avec amortissement réaliste.
    ────────────────────────────────────────────────────────────── */
    const SECOND_SWEEP_SECONDS = 58.50;
    const SECOND_BALANCE_END   = 59.65;   // +0.10s vs v4
    const MINUTE_JUMP_START    = 59.06;

    /* Frames affinées : overshoot légèrement plus prononcé,
       amortissement exponentiel plus crédible               */
    const MINUTE_JUMP_FRAMES = [
        { t: 59.06, offset: 0.000, shake:  0.00 },
        { t: 59.22, offset: 1.160, shake:  1.00 },
        { t: 59.38, offset: 0.920, shake: -0.78 },
        { t: 59.52, offset: 1.058, shake:  0.52 },
        { t: 59.64, offset: 0.982, shake: -0.30 },
        { t: 59.75, offset: 1.018, shake:  0.16 },
        { t: 59.86, offset: 0.994, shake: -0.07 },
        { t: 59.99, offset: 1.000, shake:  0.00 }
    ];

    class Clock {

        constructor(canvas, ctx, radius) {
            this.canvas = canvas;
            this.ctx    = ctx;
            this.radius = radius;
        }

        update() {
            this.center = { x: SIZE * 0.5, y: SIZE * 0.5 };
            this.ctx.clearRect(0, 0, SIZE, SIZE);
            const now = new Date();
            const pos = now.getSeconds() + now.getMilliseconds() / 1000;
            const impulse = this.minuteJumpImpulse(pos);
            this.drawShadow();
            this.drawFace();
            this.drawMarkers();
            this.drawHourHand(now, impulse);
            this.drawMinuteHand(now, impulse);
            this.drawSecondHand(pos);
        }

        easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        smoothstep(t) {
            return t * t * (3 - 2 * t);
        }

        interpolateFrames(pos, frames) {
            if (pos <= frames[0].t) return frames[0];
            for (let i = 0; i < frames.length - 1; i++) {
                const a = frames[i];
                const b = frames[i + 1];
                if (pos <= b.t) {
                    const t = this.smoothstep((pos - a.t) / (b.t - a.t));
                    return {
                        offset: a.offset + (b.offset - a.offset) * t,
                        shake:  a.shake  + (b.shake  - a.shake)  * t
                    };
                }
            }
            return frames[frames.length - 1];
        }

        minuteJumpImpulse(pos) {
            if (pos < MINUTE_JUMP_START) return { offset: 0, shake: 0 };
            return this.interpolateFrames(pos, MINUTE_JUMP_FRAMES);
        }

        secondBalanceAngle(pos) {
            if (pos < SECOND_SWEEP_SECONDS) {
                return (Math.PI * 2) * (pos / SECOND_SWEEP_SECONDS);
            }
            if (pos >= SECOND_BALANCE_END) return 0;

            const marker = Math.PI * 2 / 60;
            const t = (pos - SECOND_SWEEP_SECONDS) / (SECOND_BALANCE_END - SECOND_SWEEP_SECONDS);
            /* oscillation légèrement plus ample, décroissance plus lente */
            const wobble = Math.sin(t * Math.PI * 2.0) * Math.exp(-t * 1.6);
            const settle = (1 - this.smoothstep(t)) * 0.06;
            return marker * (wobble * 0.14 + settle);
        }

        drawShadow() {
            const { x: cx, y: cy } = this.center;
            const r = this.radius;
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r * 1.075, 0, Math.PI * 2);
            this.ctx.shadowColor   = 'rgba(0,0,0,0.72)';
            this.ctx.shadowBlur    = r * 0.13;
            this.ctx.shadowOffsetY = r * 0.045;
            this.ctx.fillStyle     = '#050505';
            this.ctx.fill();
            this.ctx.restore();
        }

        drawFace() {
            const { x: cx, y: cy } = this.center;
            const r = this.radius;

            /* ── Biseau extérieur ── */
            const bezel = this.ctx.createRadialGradient(cx, cy - r * 0.22, r * 0.58, cx, cy, r * 1.09);
            bezel.addColorStop(0.00, '#3a3427');
            bezel.addColorStop(0.45, '#090909');
            bezel.addColorStop(0.72, '#000000');
            bezel.addColorStop(1.00, '#2a2418');
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r * 1.075, 0, Math.PI * 2);
            this.ctx.fillStyle = bezel;
            this.ctx.fill();

            /* ── Cadran champagne ── */
            const face = this.ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.22, r * 0.06, cx, cy, r);
            face.addColorStop(0.00, '#ffffff');
            face.addColorStop(0.34, '#f5f5e6');
            face.addColorStop(0.72, '#fafaf7');
            face.addColorStop(1.00, '#fafacd');
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r * 0.985, 0, Math.PI * 2);
            this.ctx.fillStyle = face;
            this.ctx.fill();

            /* ── Reflet verre : couche 'screen' haut-gauche ──
               globalCompositeOperation 'screen' simule une vraie
               réflexion spéculaire sur verre bombé : les zones
               claires s'additionnent sans écraser le cadran.
            ── */
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r * 0.982, 0, Math.PI * 2);
            this.ctx.clip();

            this.ctx.globalCompositeOperation = 'screen';

            const glassShine = this.ctx.createRadialGradient(
                cx - r * 0.28, cy - r * 0.34, 0,
                cx - r * 0.10, cy - r * 0.10, r * 1.05
            );
            glassShine.addColorStop(0.00, 'rgba(255,255,255,0.52)');
            glassShine.addColorStop(0.18, 'rgba(255,255,255,0.22)');
            glassShine.addColorStop(0.42, 'rgba(255,255,255,0.06)');
            glassShine.addColorStop(1.00, 'rgba(255,255,255,0.00)');

            this.ctx.fillStyle = glassShine;
            this.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

            /* Reflet secondaire bas-droite (contre-jour) */
            const glassShine2 = this.ctx.createRadialGradient(
                cx + r * 0.38, cy + r * 0.42, 0,
                cx + r * 0.20, cy + r * 0.20, r * 0.80
            );
            glassShine2.addColorStop(0.00, 'rgba(255,255,255,0.14)');
            glassShine2.addColorStop(0.55, 'rgba(255,255,255,0.03)');
            glassShine2.addColorStop(1.00, 'rgba(255,255,255,0.00)');
            this.ctx.fillStyle = glassShine2;
            this.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.restore();

            /* ── Liseré intérieur ── */
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r * 0.988, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(0,0,0,0.72)';
            this.ctx.lineWidth   = r * 0.018;
            this.ctx.stroke();
        }

        /* ── Marqueurs harmonieux ───────────────────────────────────
           Ratio progressif sur 3 niveaux :
             quart  : width 0.068  inner 0.610
             heure  : width 0.050  inner 0.695
             minute : width 0.018  inner 0.828
        ────────────────────────────────────────────────────────── */
        drawMarkers() {
            const { x: cx, y: cy } = this.center;
            const r = this.radius;
            const outer = r * 0.915;

            /* Regrouper par type pour limiter les changements d'état */
            const types = [
                { step: 15, inner: r * 0.610, width: r * 0.068 },
                { step:  5, inner: r * 0.695, width: r * 0.050 },
                { step:  1, inner: r * 0.828, width: r * 0.018 }
            ];

            this.ctx.save();
            this.ctx.strokeStyle = '#111';
            this.ctx.lineCap     = 'butt';

            for (const { step, inner, width } of types) {
                this.ctx.lineWidth = width;
                for (let i = 0; i < 60; i++) {
                    if (i % 5 !== 0 && step !== 1) continue;
                    if (i % 5 === 0 && step === 1) continue;
                    if (step === 15 && i % 15 !== 0) continue;
                    if (step === 5  && (i % 15 === 0 || i % 5 !== 0)) continue;

                    const angle = (Math.PI * 2) * (i / 60);
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx + Math.sin(angle) * outer, cy - Math.cos(angle) * outer);
                    this.ctx.lineTo(cx + Math.sin(angle) * inner, cy - Math.cos(angle) * inner);
                    this.ctx.stroke();
                }
            }
            this.ctx.restore();
        }

        /* ── Aiguilles : un seul save/restore global ── */
        drawTrapHand(angle, length, back, baseW, tipW, color) {
            const r = this.radius;
            const { x: cx, y: cy } = this.center;
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(angle);
            this.ctx.shadowColor   = 'rgba(0,0,0,0.18)';
            this.ctx.shadowBlur    = r * 0.025;
            this.ctx.shadowOffsetY = r * 0.012;
            this.ctx.fillStyle     = color;
            this.ctx.beginPath();
            this.ctx.moveTo(-baseW * r * 0.5,  back   * r);
            this.ctx.lineTo( baseW * r * 0.5,  back   * r);
            this.ctx.lineTo( tipW  * r * 0.5, -length * r);
            this.ctx.lineTo(-tipW  * r * 0.5, -length * r);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        }

        drawHourHand(now, impulse) {
            const h       = (now.getHours() % 12) + (now.getMinutes() + impulse.offset) / 60;
            const base    = (Math.PI * 2) * (h / 12);
            const tremble = impulse.shake * (Math.PI * 2 / 60) * 0.018;
            this.drawTrapHand(base + tremble, 0.50, 0.14, 0.155, 0.105, '#050505');
        }

        drawMinuteHand(now, impulse) {
            const disp    = now.getMinutes() + impulse.offset;
            const tremble = impulse.shake * (Math.PI * 2 / 60) * 0.052;
            this.drawTrapHand((Math.PI * 2) * (disp / 60) + tremble, 0.84, 0.15, 0.125, 0.075, '#050505');
        }

        /* ── Trotteuse ── */
        drawSecondHand(pos) {
            const { x: cx, y: cy } = this.center;
            const r        = this.radius;
            const angle    = this.secondBalanceAngle(pos);
            const diskDist = r * 0.66;

            /* Taille du disque proportionnelle à sizePx pour
               garder l'équilibre visuel sur tous formats       */
            const diskR    = Math.max(r * 0.088, Math.min(r * 0.108, 18));

            const stemX0 = cx - Math.sin(angle) * r * 0.22;
            const stemY0 = cy + Math.cos(angle) * r * 0.22;
            const stemX1 = cx + Math.sin(angle) * diskDist;
            const stemY1 = cy - Math.cos(angle) * diskDist;

            this.ctx.save();
            this.ctx.shadowColor = 'rgba(0,0,0,0.20)';
            this.ctx.shadowBlur  = r * 0.020;
            this.ctx.strokeStyle = '#d71920';
            this.ctx.lineWidth   = r * 0.038;
            this.ctx.lineCap     = 'butt';
            this.ctx.beginPath();
            this.ctx.moveTo(stemX0, stemY0);
            this.ctx.lineTo(stemX1, stemY1);
            this.ctx.stroke();

            /* Disque */
            const diskX = cx + Math.sin(angle) * diskDist;
            const diskY = cy - Math.cos(angle) * diskDist;
            this.ctx.shadowBlur  = 0;
            this.ctx.fillStyle   = '#d71920';
            this.ctx.beginPath();
            this.ctx.arc(diskX, diskY, diskR, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0,0,0,0.10)';
            this.ctx.lineWidth   = r * 0.006;
            this.ctx.stroke();

            this.ctx.restore();
        }
    }

    const clock  = new Clock(canvas, ctx, SIZE * 0.495);
    let frameId  = null;

    function render() {
        clock.update();
        frameId = requestAnimationFrame(render);
    }

    render();

    canvas.__suisseClockStop = function () {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = null;
        canvas.__suisseClockStop = null;
    };

    return canvas.__suisseClockStop;
};
