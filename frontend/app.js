const API = (window.CARD_API_BASE_URL || "").replace(/\/$/, "");
const $ = (id) => document.getElementById(id);
let student = JSON.parse(localStorage.getItem("starCardStudent") || "null");
let artDataUrl = "";
const ATTRIBUTES = {
  lightning: { label: "雷電", template: "./assets/source-lightning.png", surface: "#ffe36c" },
  grass: { label: "草", template: "./assets/source-grass.png", surface: "#cfeb6a" },
  psychic: { label: "超能力", template: "./assets/source-psychic.webp", surface: "#efb9df" },
  water: { label: "水", template: "./assets/source-water.png", surface: "#b8e9fa" },
};
const FULL_LAYOUTS = {
  "full-forest": { template: "./assets/full-forest.webp", surface: "#e8d88c", width: 868, height: 1212, full: true },
  "full-ex": { template: "./assets/full-ex.webp", surface: "#f4c35d", width: 868, height: 1212, full: true },
  "full-water": { template: "./assets/full-water.png", surface: "#d7edee", width: 868, height: 1212, full: true },
  "full-fire": { template: "./assets/full-fire.png", surface: "#f2c1a0", width: 868, height: 1212, full: true },
};

function message(id, text, ok = false) { const el = $(id); el.textContent = text; el.style.color = ok ? "#24733c" : "#a13d20"; }
function requireApi(id) { if (API) return true; message(id, "尚未連接課堂伺服器，請通知老師完成部署設定。"); return false; }
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "伺服器暫時未能回應");
  return data;
}
function updateQuota() { $("quota").textContent = `草圖 ${student.trialRemaining} 次 · 完成圖 ${student.finalRemaining} 次`; }
function openStudio() {
  $("join-view").hidden = true; $("studio-view").hidden = false;
  $("hello").textContent = `${student.displayName} 的創作桌`;
  updateQuota();
}
function readCard() { return { name: $("card-name").value.trim() || "無名怪獸", element: $("element").value, layout: $("card-layout").value, ability: $("ability").value.trim() || "星光技能" }; }
function designFor(card) { return card.layout === "standard" ? { ...ATTRIBUTES[card.element], width: 600, height: 838, full: false } : FULL_LAYOUTS[card.layout]; }
function updatePreview() {
  const card = readCard(), design = designFor(card);
  $("preview-name").textContent = card.name; $("preview-hp").textContent = "HP 100"; $("preview-ability").textContent = card.ability;
  $("card").className = `card template-${card.layout === "standard" ? card.element : card.layout}${design.full ? " full-art" : ""}`;
}
async function generate(kind) {
  if (!requireApi("studio-message")) return;
  const prompt = $("prompt").value.trim(); if (prompt.length < 8) return message("studio-message", "請寫至少 8 個字描述你的原創怪獸。 ");
  message("studio-message", "AI 正在畫圖，請稍候…", true);
  try {
    const result = await api("/api/generate", { method: "POST", body: JSON.stringify({ studentId: student.id, kind, prompt }) });
    student = result.student; localStorage.setItem("starCardStudent", JSON.stringify(student)); artDataUrl = result.artDataUrl;
    $("art").innerHTML = `<img alt="${readCard().name} 的 AI 圖畫" src="${artDataUrl}">`; updateQuota(); message("studio-message", "完成！你可以繼續修改文字或下載卡牌。", true);
  } catch (error) { message("studio-message", error.message); }
}
function drawExport(format) {
  updatePreview(); const canvas = $("export-canvas"), card = readCard(), design = designFor(card), full = design.full;
  canvas.width = design.width; canvas.height = design.height; const ctx = canvas.getContext("2d");
  const finish = () => { const scale = canvas.width / 600; ctx.fillStyle = design.surface; ctx.fillRect(112 * scale, 23 * scale, 460 * scale, 53 * scale); if (full) { ctx.fillStyle = "rgba(15,22,38,.45)"; ctx.fillRect(42 * scale, 650 * scale, 516 * scale, 145 * scale); ctx.fillStyle = "white"; } else { ctx.fillRect(38 * scale, 423 * scale, 524 * scale, 286 * scale); ctx.fillStyle = "#121725"; } ctx.textBaseline = "middle"; ctx.font = `bold ${28 * scale}px sans-serif`; ctx.fillText(card.name.slice(0, 12), 130 * scale, 52 * scale); ctx.font = `bold ${15 * scale}px sans-serif`; ctx.fillText("HP 100", 475 * scale, 52 * scale); ctx.font = `bold ${25 * scale}px sans-serif`; ctx.fillText(card.ability, 62 * scale, (full ? 690 : 495) * scale); ctx.font = `${14 * scale}px sans-serif`; ctx.fillText("造成 70 點星力傷害", 62 * scale, (full ? 730 : 528) * scale); ctx.font = `${12 * scale}px sans-serif`; ctx.fillText("原創學習卡，僅供課堂創作。", 62 * scale, (full ? 775 : 605) * scale); const link = document.createElement("a"); link.download = `${card.name || "star-card"}.${format === "jpeg" ? "jpg" : "png"}`; link.href = canvas.toDataURL(`image/${format}`, .94); link.click(); };
  const template = new Image(); template.onload = () => { ctx.drawImage(template, 0, 0, canvas.width, canvas.height); const scale = canvas.width / 600; const artRect = full ? [35, 92, 530, 590] : [47, 80, 506, 318]; if (!artDataUrl) { ctx.fillStyle = "#88add0"; ctx.fillRect(...artRect.map((value) => value * scale)); ctx.fillStyle = "white"; ctx.font = `bold ${22 * scale}px sans-serif`; ctx.fillText("等待你的 AI 圖畫", 215 * scale, (full ? 385 : 245) * scale); return finish(); } const image = new Image(); image.onload = () => { ctx.drawImage(image, ...artRect.map((value) => value * scale)); finish(); }; image.src = artDataUrl; }; template.src = design.template;
}

$("join-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!requireApi("join-message")) return; try { const result = await api("/api/join", { method: "POST", body: JSON.stringify({ displayName: $("display-name").value.trim(), studentCode: $("student-code").value.trim() }) }); student = result.student; localStorage.setItem("starCardStudent", JSON.stringify(student)); openStudio(); } catch (error) { message("join-message", error.message); } });
["card-name", "element", "card-layout", "ability"].forEach((id) => { $(id).addEventListener("input", updatePreview); $(id).addEventListener("change", updatePreview); });
$("trial-generate").onclick = () => generate("trial"); $("final-generate").onclick = () => generate("final");
$("download-png").onclick = () => drawExport("png"); $("download-jpg").onclick = () => drawExport("jpeg");
$("switch-student").onclick = () => { localStorage.removeItem("starCardStudent"); student = null; $("studio-view").hidden = true; $("join-view").hidden = false; };
$("teacher-open").onclick = () => { $("teacher-view").hidden = false; $("teacher-view").scrollIntoView({ behavior: "smooth" }); }; $("teacher-close").onclick = () => { $("teacher-view").hidden = true; };
function teacherHeaders() { return { "x-teacher-code": $("teacher-code").value }; }
async function loadStudents() { if (!requireApi("teacher-message")) return; try { const { students } = await api("/api/teacher/students", { headers: teacherHeaders() }); $("student-list").innerHTML = students.map((s) => `<div class="teacher-row"><b>${s.displayName}</b><span>草圖：${s.trialRemaining}</span><span>完成圖：${s.finalRemaining}${s.active ? "" : "（已停用）"}</span><span><button data-id="${s.id}" data-action="bonus">+1</button><button data-id="${s.id}" data-action="reset">重設</button><button data-id="${s.id}" data-action="toggle">${s.active ? "停用" : "啟用"}</button></span></div>`).join("") || "尚未有學生加入。"; message("teacher-message", "資料已更新。", true); } catch (error) { message("teacher-message", error.message); } }
$("load-students").onclick = loadStudents;
$("make-codes").onclick = async () => { if (!requireApi("teacher-message")) return; try { const { codes } = await api("/api/teacher/codes", { method: "POST", headers: teacherHeaders(), body: JSON.stringify({ count: 10 }) }); $("new-codes").hidden = false; $("new-codes").textContent = codes.join("\n"); message("teacher-message", "已產生 10 個代碼，請立即記錄。", true); } catch (error) { message("teacher-message", error.message); } };
$("student-list").onclick = async (event) => { const button = event.target.closest("button[data-id]"); if (!button) return; try { await api(`/api/teacher/students/${button.dataset.id}`, { method: "PATCH", headers: teacherHeaders(), body: JSON.stringify({ action: button.dataset.action }) }); loadStudents(); } catch (error) { message("teacher-message", error.message); } };
if (student) openStudio(); updatePreview();
