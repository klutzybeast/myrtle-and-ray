/* Story Quest — client-side share card renderer.
 *
 * Produces a 1200×630 PNG (Open Graph / Twitter card aspect) the kid can
 * share via the Web Share API or download. No server round-trip; all
 * compositing happens on a Canvas in the browser.
 */

const W = 1200;
const H = 630;

const WAVE_META = {
  welcome_curiosity: { letter: "W", color: "#7fcfc7", label: "Welcome Curiosity" },
  act_with_kindness: { letter: "A", color: "#f0a988", label: "Act with Kindness" },
  value_teamwork:    { letter: "V", color: "#b8a3d9", label: "Value Teamwork" },
  encourage_others:  { letter: "E", color: "#7cbf94", label: "Encourage Others" },
};

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // graceful — share card still renders without avatar
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCircularImage(ctx, img, cx, cy, r) {
  if (!img) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  // Cover-fit
  const ratio = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
  const w = img.naturalWidth * ratio;
  const h = img.naturalHeight * ratio;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

/**
 * Render a share card PNG for the kid's Story Quest result.
 *
 * @param {object} params
 * @param {object} params.matchedChar — { name, slug, image_url, role }
 * @param {object|null} params.listenedChar — narrator the kid matched most (for "you really listened to") or null
 * @param {number} params.listenedCount — how many times the kid matched that narrator
 * @param {object} params.scores — { welcome_curiosity: n, act_with_kindness: n, ... }
 * @param {string} params.siteName
 * @param {string} params.siteUrl
 * @returns {Promise<Blob>}
 */
export async function renderStoryQuestShareCard({
  matchedChar,
  listenedChar = null,
  listenedCount = 0,
  scores = {},
  siteName = "Myrtle & Ray",
  siteUrl = typeof window !== "undefined" ? window.location.origin : "",
}) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background — branded ocean gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#eef9fb");
  bg.addColorStop(0.6, "#fff5ec");
  bg.addColorStop(1, "#fef3e2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft wave shape bottom-left
  ctx.fillStyle = "rgba(127, 207, 199, 0.20)";
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.bezierCurveTo(W * 0.25, H - 120, W * 0.55, H - 30, W, H - 100);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // Wave sparkle accents
  ctx.fillStyle = "rgba(240, 169, 136, 0.35)";
  [[100, 80, 6], [180, 140, 4], [W - 200, 90, 5], [W - 120, 200, 4]].forEach(([cx, cy, r]) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  });

  // Header — small brand strip
  ctx.fillStyle = "#5a8a6f";
  ctx.font = 'bold 22px "Inter", "Helvetica Neue", sans-serif';
  ctx.textBaseline = "top";
  ctx.fillText("CATCH THE", 70, 56);
  ctx.fillStyle = "#3a4a55";
  ctx.font = 'bold 26px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText("W.A.V.E.", 200, 52);
  ctx.fillStyle = "#a36b29";
  ctx.font = 'bold 22px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText("OF EXCITEMENT", 320, 56);

  // Title
  ctx.fillStyle = "#3a4a55";
  ctx.font = 'bold 38px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText("My Story Quest result", 70, 110);

  // Left avatar — matched Sea Star
  const charImg = matchedChar?.image_url ? await loadImage(matchedChar.image_url) : null;
  const avX = 220;
  const avY = 360;
  const avR = 130;
  // Outer gradient ring
  const ring = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
  ring.addColorStop(0, "#7fcfc7");
  ring.addColorStop(0.5, "#f0a988");
  ring.addColorStop(1, "#7cbf94");
  ctx.strokeStyle = ring;
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(avX, avY, avR + 8, 0, Math.PI * 2); ctx.stroke();
  // Background disk
  ctx.fillStyle = "#fffbf3";
  ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.fill();
  if (charImg) drawCircularImage(ctx, charImg, avX, avY, avR);

  // Right column text
  const rightX = 420;
  ctx.fillStyle = "#6b7280";
  ctx.font = '500 22px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText("I'm a…", rightX, 200);

  ctx.fillStyle = "#5a8a6f";
  ctx.font = 'bold 64px "Inter", "Helvetica Neue", sans-serif';
  const name = matchedChar?.name || "Sea Star";
  ctx.fillText(name, rightX, 232);

  if (matchedChar?.role) {
    ctx.fillStyle = "#a36b29";
    ctx.font = 'bold 20px "Inter", "Helvetica Neue", sans-serif';
    ctx.fillText(matchedChar.role.toUpperCase(), rightX, 308);
  }

  // Listened-to callout
  if (listenedChar && listenedCount >= 2) {
    const calloutY = 350;
    ctx.fillStyle = "#eaf7f5";
    roundRect(ctx, rightX, calloutY, 700, 90, 18);
    ctx.fill();
    ctx.strokeStyle = "#7fcfc7";
    ctx.lineWidth = 2;
    roundRect(ctx, rightX, calloutY, 700, 90, 18);
    ctx.stroke();
    ctx.fillStyle = "#3a4a55";
    ctx.font = '600 22px "Inter", "Helvetica Neue", sans-serif';
    ctx.fillText("I really listened to", rightX + 24, calloutY + 18);
    ctx.fillStyle = "#5a8a6f";
    ctx.font = 'bold 28px "Inter", "Helvetica Neue", sans-serif';
    ctx.fillText(`${listenedChar.name} · ${listenedCount}× match`, rightX + 24, calloutY + 48);
  }

  // W.A.V.E. fingerprint bars
  const total = Object.values(scores).reduce((s, v) => s + (v || 0), 0) || 1;
  const fpX = rightX;
  const fpY = listenedChar && listenedCount >= 2 ? 470 : 380;
  ctx.fillStyle = "#3a4a55";
  ctx.font = 'bold 20px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText("My W.A.V.E. fingerprint", fpX, fpY);

  Object.entries(WAVE_META).forEach(([k, meta], i) => {
    const rowY = fpY + 36 + i * 18;
    const score = scores[k] || 0;
    const pct = score / total;
    // letter bullet
    ctx.fillStyle = meta.color;
    ctx.beginPath(); ctx.arc(fpX + 14, rowY + 7, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = 'bold 14px "Inter", "Helvetica Neue", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(meta.letter, fpX + 14, rowY + 1);
    ctx.textAlign = "left";
    // Bar bg
    const barX = fpX + 38;
    const barY = rowY + 5;
    const barW = 540;
    ctx.fillStyle = "#f4e4c6";
    roundRect(ctx, barX, barY, barW, 6, 3); ctx.fill();
    // Bar fill
    ctx.fillStyle = meta.color;
    roundRect(ctx, barX, barY, Math.max(0, barW * pct), 6, 3); ctx.fill();
    // Score count
    ctx.fillStyle = "#3a4a55";
    ctx.font = '600 13px "Inter", "Helvetica Neue", sans-serif';
    ctx.fillText(String(score), barX + barW + 10, rowY);
  });

  // Footer brand
  ctx.fillStyle = "#3a4a55";
  ctx.font = '600 18px "Inter", "Helvetica Neue", sans-serif';
  ctx.fillText(`${siteName} — Find your Sea Star at ${siteUrl.replace(/^https?:\/\//, "")}/story-quest`, 70, H - 50);

  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
}
