const API = (window.CARD_API_BASE_URL || "").replace(/\/$/, "");
const $ = (id) => document.getElementById(id);
let student = JSON.parse(localStorage.getItem("starCardStudent") || "null");
let artDataUrl = "";

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
function readCard() { return { name: $("card-name").value.trim() || "無名怪獸", element: $("element").value, ability: $("ability").value.trim() || "星光技能" }; }
function updatePreview() {
  const card = readCard();
  $("preview-name").textContent = card.name; $("preview-element").textContent = card.element; $("preview-ability").textContent = card.ability;
  $("card").className = `card element-${card.element}`;
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
  updatePreview(); const canvas = $("export-canvas"), ctx = canvas.getContext("2d"), card = readCard();
  ctx.fillStyle = "#f5d363"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#d9f0d1"; ctx.fillRect(55, 55, canvas.width - 110, canvas.height - 110);
  ctx.fillStyle = "#162640"; ctx.font = "bold 82px sans-serif"; ctx.fillText(card.name, 110, 180); ctx.font = "42px sans-serif"; ctx.fillText(card.element, 1120, 180);
  const finish = () => { ctx.fillStyle = "#fffdf4"; ctx.fillRect(110, 1370, 1268, 320); ctx.fillStyle = "#17233a"; ctx.font = "bold 66px sans-serif"; ctx.fillText(card.ability, 155, 1485); ctx.font = "42px sans-serif"; ctx.fillText("造成 70 點星力傷害", 155, 1575); ctx.font = "29px sans-serif"; ctx.fillText("原創學習卡，不是官方 Pokémon 卡", 155, 1840); ctx.fillText("星級怪獸卡工作室 · 2026", 155, 1930); const link = document.createElement("a"); link.download = `${card.name || "star-card"}.${format === "jpeg" ? "jpg" : "png"}`; link.href = canvas.toDataURL(`image/${format}`, .94); link.click(); };
  if (!artDataUrl) { ctx.fillStyle = "#88add0"; ctx.fillRect(110, 260, 1268, 1020); ctx.fillStyle = "white"; ctx.font = "bold 54px sans-serif"; ctx.fillText("等待你的 AI 圖畫", 445, 790); return finish(); }
  const image = new Image(); image.onload = () => { ctx.drawImage(image, 110, 260, 1268, 1020); finish(); }; image.src = artDataUrl;
}

$("join-form").addEventListener("submit", async (event) => { event.preventDefault(); if (!requireApi("join-message")) return; try { const result = await api("/api/join", { method: "POST", body: JSON.stringify({ displayName: $("display-name").value.trim(), studentCode: $("student-code").value.trim() }) }); student = result.student; localStorage.setItem("starCardStudent", JSON.stringify(student)); openStudio(); } catch (error) { message("join-message", error.message); } });
["card-name", "element", "ability"].forEach((id) => $(id).addEventListener("input", updatePreview));
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
