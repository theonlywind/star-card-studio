const json = (body, status = 200, origin = "") => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json;charset=UTF-8", ...cors(origin) } });
const cors = (origin) => origin ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type,x-teacher-code", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", vary: "Origin" } : {};
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const id = () => crypto.randomUUID();
const student = (row) => ({ id: row.id, displayName: row.display_name, trialRemaining: row.trial_remaining, finalRemaining: row.final_remaining, active: Boolean(row.active) });
const code = () => `STAR-${String(Math.floor(Math.random() * 90 + 10))}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4).toUpperCase()}`;

function safePrompt(prompt) {
  if (typeof prompt !== "string" || prompt.trim().length < 8 || prompt.length > 300) return "請輸入 8 至 300 個字的描述。";
  if (/pok[eé]mon|皮卡丘|pikachu|寶可夢|住址|地址|電話|色情|裸體|血腥/i.test(prompt)) return "請創作原創、兒童友善的怪獸，且不要輸入個人資料或官方角色名稱。";
  return null;
}
function allowed(request, env) { const origin = request.headers.get("origin"); return !origin || origin === env.ALLOWED_ORIGIN; }
async function teacher(request, env) { return Boolean(env.TEACHER_ACCESS_CODE) && request.headers.get("x-teacher-code") === env.TEACHER_ACCESS_CODE; }

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    if (!allowed(request, env)) return json({ error: "此網域未獲授權使用課堂 API。" }, 403, origin);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    const url = new URL(request.url), path = url.pathname;
    try {
      if (path === "/api/health") return json({ ok: true }, 200, origin);
      if (path === "/api/join" && request.method === "POST") return this.join(request, env, origin);
      if (path === "/api/generate" && request.method === "POST") return this.generate(request, env, origin);
      if (path === "/api/teacher/codes" && request.method === "POST") return this.makeCodes(request, env, origin);
      if (path === "/api/teacher/students" && request.method === "GET") return this.listStudents(request, env, origin);
      const match = path.match(/^\/api\/teacher\/students\/([\w-]+)$/);
      if (match && request.method === "PATCH") return this.updateStudent(request, env, origin, match[1]);
      return json({ error: "找不到 API 路徑。" }, 404, origin);
    } catch (error) { console.error(error); return json({ error: "伺服器發生錯誤，請稍後再試。" }, 500, origin); }
  },
  async join(request, env, origin) {
    const { studentCode, displayName } = await request.json();
    if (typeof displayName !== "string" || !displayName.trim() || displayName.length > 18) return json({ error: "請輸入 1 至 18 個字的名字或暱稱。" }, 400, origin);
    const codeHash = await hash(String(studentCode || "").trim().toUpperCase());
    const found = await env.DB.prepare("SELECT s.* FROM student_codes c LEFT JOIN students s ON s.code_id=c.id WHERE c.code_hash=?").bind(codeHash).first();
    if (!found) return json({ error: "學生代碼不正確。" }, 401, origin);
    if (found.id) { if (!found.active) return json({ error: "這個學生代碼已被老師暫停。" }, 403, origin); return json({ student: student(found) }, 200, origin); }
    const codeRow = await env.DB.prepare("SELECT id FROM student_codes WHERE code_hash=?").bind(codeHash).first();
    const newStudent = { id: id(), displayName: displayName.trim() };
    await env.DB.prepare("INSERT INTO students (id, code_id, display_name) VALUES (?, ?, ?)").bind(newStudent.id, codeRow.id, newStudent.displayName).run();
    return json({ student: { ...newStudent, trialRemaining: 5, finalRemaining: 2, active: true } }, 201, origin);
  },
  async generate(request, env, origin) {
    const { studentId, kind, prompt } = await request.json(), problem = safePrompt(prompt);
    if (problem) return json({ error: problem }, 400, origin);
    if (!["trial", "final"].includes(kind)) return json({ error: "無效的圖片類型。" }, 400, origin);
    const row = await env.DB.prepare("SELECT * FROM students WHERE id=?").bind(studentId).first();
    if (!row || !row.active) return json({ error: "學生資料不存在或已被老師暫停。" }, 403, origin);
    const quota = kind === "trial" ? "trial_remaining" : "final_remaining";
    if (row[quota] < 1) return json({ error: kind === "trial" ? "草圖配額已用完，請請老師加配額。" : "完成圖配額已用完，請請老師加配額。" }, 429, origin);
    const model = kind === "trial" ? "black-forest-labs/flux.2-klein-4b" : "black-forest-labs/flux.2-pro";
    const ai = await fetch("https://openrouter.ai/api/v1/images", { method: "POST", headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model, output_format: "png", prompt: `Create an original, child-friendly fantasy creature trading-card illustration. No copyrighted characters, logos, words, watermarks, or text in the image. Bright, friendly, clean composition. User concept: ${prompt.trim()}` }) });
    const payload = await ai.json().catch(() => ({}));
    const b64 = payload?.data?.[0]?.b64_json;
    if (!ai.ok || !b64) { console.error("OpenRouter image error", ai.status, payload?.error); return json({ error: "AI 暫時未能完成圖片，這次不會扣配額。請改寫描述後再試。" }, 502, origin); }
    await env.DB.batch([
      env.DB.prepare(`UPDATE students SET ${quota}=${quota}-1, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(studentId),
      env.DB.prepare("INSERT INTO generation_logs (student_id, kind) VALUES (?, ?)").bind(studentId, kind),
    ]);
    const updated = await env.DB.prepare("SELECT * FROM students WHERE id=?").bind(studentId).first();
    return json({ student: student(updated), artDataUrl: `data:image/png;base64,${b64}` }, 200, origin);
  },
  async makeCodes(request, env, origin) {
    if (!(await teacher(request, env))) return json({ error: "教師控制碼不正確。" }, 401, origin);
    const { count = 10 } = await request.json(); if (!Number.isInteger(count) || count < 1 || count > 30) return json({ error: "每次可產生 1 至 30 個代碼。" }, 400, origin);
    const codes = []; for (let n = 0; n < count; n += 1) { const plain = code(); codes.push(plain); await env.DB.prepare("INSERT INTO student_codes (code_hash, label) VALUES (?, ?)").bind(await hash(plain), `學生 ${n + 1}`).run(); }
    return json({ codes }, 201, origin);
  },
  async listStudents(request, env, origin) {
    if (!(await teacher(request, env))) return json({ error: "教師控制碼不正確。" }, 401, origin);
    const rows = await env.DB.prepare("SELECT * FROM students ORDER BY created_at ASC").all(); return json({ students: rows.results.map(student) }, 200, origin);
  },
  async updateStudent(request, env, origin, studentId) {
    if (!(await teacher(request, env))) return json({ error: "教師控制碼不正確。" }, 401, origin);
    const { action } = await request.json(); const row = await env.DB.prepare("SELECT * FROM students WHERE id=?").bind(studentId).first(); if (!row) return json({ error: "找不到學生。" }, 404, origin);
    if (action === "bonus") await env.DB.prepare("UPDATE students SET trial_remaining=trial_remaining+1, final_remaining=final_remaining+1, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(studentId).run();
    else if (action === "reset") await env.DB.prepare("UPDATE students SET trial_remaining=5, final_remaining=2, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(studentId).run();
    else if (action === "toggle") await env.DB.prepare("UPDATE students SET active=CASE active WHEN 1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(studentId).run();
    else return json({ error: "無效操作。" }, 400, origin);
    return json({ ok: true }, 200, origin);
  },
};
