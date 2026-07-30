/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { schemaStatements, classSchemaStatements } from "../db/schema";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  OPENROUTER_API_KEY?: string;
  ARK_API_KEY?: string;
  CLASS_ACCESS_CODE?: string;
  TEACHER_ACCESS_CODE?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "https://theonlywind.github.io", "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", "access-control-allow-headers": "content-type,x-teacher-code" },
  });

const now = () => new Date().toISOString();

async function ensureSchema(db: D1Database) {
  await db.batch([...schemaStatements, ...classSchemaStatements].map((statement) => db.prepare(statement)));
}

async function readJson(request: Request) {
  try {
    return await request.json<Record<string, unknown>>();
  } catch {
    return {};
  }
}

function classCode(env: Env) {
  return env.CLASS_ACCESS_CODE || "STAR-CARD-2026";
}

function teacherCode(env: Env) {
  return env.TEACHER_ACCESS_CODE || "teacher-demo";
}

function isSafePrompt(prompt: string) {
  const blocked = /pokemon|pokémon|pikachu|charizard|nintendo|暴力|血腥|裸體|色情|地址|電話/i;
  return prompt.length >= 12 && prompt.length <= 420 && !blocked.test(prompt);
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  try {
    await ensureSchema(env.DB);
  } catch (error) {
    return json({ error: "資料庫初始化失敗。", detail: error instanceof Error ? error.message : String(error) }, 500);
  }

  const clean = (v: unknown, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((x) => x.toString(16).padStart(2, "0")).join("");
  const findStudent = async (code: string) => env.DB.prepare("SELECT s.*, c.active AS code_active FROM class_codes c LEFT JOIN class_students s ON s.code_id=c.id WHERE c.code_hash=?").bind(await digest(code.toUpperCase())).first<Record<string, unknown>>();
  const teacherOk = (request: Request, body: Record<string, unknown>) => clean(request.headers.get("x-teacher-code") || body.teacherCode, 128) === clean(env.TEACHER_ACCESS_CODE, 128) && Boolean(env.TEACHER_ACCESS_CODE);

  if (url.pathname === "/api/join" && request.method === "POST") {
    const body = await readJson(request), displayName = clean(body.displayName, 18), code = clean(body.classCode, 32).toUpperCase();
    const found = await findStudent(code);
    if (!displayName || !found || !found.code_active) return json({ error: "學生代碼不正確或已停用。" }, 401);
    if (found.id) return json({ student: { id:found.id, displayName:found.display_name, videoLimit:found.video_limit, videoUsed:found.video_used, status:found.status } });
    const id=crypto.randomUUID(), stamp=now(); await env.DB.prepare("INSERT INTO class_students (id,code_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(id,found.code_id,displayName,stamp,stamp).run();
    return json({ student:{id,displayName,videoLimit:5,videoUsed:0,status:"active"} },201);
  }

  if (url.pathname === "/api/teacher/codes" && request.method === "POST") {
    const body=await readJson(request); if(!teacherOk(request,body)) return json({error:"教師代碼不正確。"},401);
    const codes:string[]=[]; for(let i=0;i<Math.min(30,Math.max(1,Number(body.count)||10));i++){const code=`MOVIE-${Math.floor(100+Math.random()*900)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,4).toUpperCase()}`;codes.push(code);await env.DB.prepare("INSERT INTO class_codes (id,code_hash,label,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(),await digest(code),`學生 ${i+1}`,now()).run();} return json({codes},201);
  }

  if (url.pathname === "/api/students" && request.method === "POST") {
    const body = await readJson(request);
    const displayName = String(body.displayName || "").trim().slice(0, 16);
    if (String(body.classCode || "") !== classCode(env) || displayName.length < 2) {
      return json({ error: "請輸入正確的班房代碼和 2 至 16 字暱稱。" }, 400);
    }
    const id = crypto.randomUUID();
    const timestamp = now();
    await env.DB.prepare(
      "INSERT INTO students (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).bind(id, displayName, timestamp, timestamp).run();
    return json({ id, displayName, trialLimit: 8, trialUsed: 0, finalLimit: 1, finalUsed: 0, status: "active" });
  }

  if (url.pathname === "/api/generate" && request.method === "POST") {
    const body = await readJson(request);
    const studentId = String(body.studentId || "");
    const kind = body.kind === "final" ? "final" : "trial";
    const prompt = String(body.prompt || "").trim();
    if (!isSafePrompt(prompt)) {
      return json({ error: "請使用原創、合適而且較完整的描述；不要輸入官方角色、個人資料或不適當內容。" }, 400);
    }
    const student = await env.DB.prepare("SELECT * FROM students WHERE id = ?").bind(studentId).first<Record<string, unknown>>();
    if (!student || student.status !== "active") return json({ error: "這個創作代碼已無效，請找老師。" }, 403);
    const usedKey = kind === "final" ? "final_used" : "trial_used";
    const limitKey = kind === "final" ? "final_limit" : "trial_limit";
    if (Number(student[usedKey]) >= Number(student[limitKey])) return json({ error: "這個配額已用完，請向老師申請。" }, 403);

    const updatedAt = now();
    await env.DB.batch([
      env.DB.prepare(`UPDATE students SET ${usedKey} = ${usedKey} + 1, updated_at = ? WHERE id = ?`).bind(updatedAt, studentId),
      env.DB.prepare("INSERT INTO generation_logs (id, student_id, kind, prompt, provider_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), studentId, kind, prompt, env.OPENROUTER_API_KEY ? "openrouter" : "prototype", updatedAt),
    ]);

    if (env.OPENROUTER_API_KEY) {
      const providerPrompt = `Original child-friendly elemental creature concept art for a trading-card illustration. No text, no logos, no existing franchise characters. Centered subject, clean background. ${prompt}`;
      const response = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: kind === "final" ? "black-forest-labs/flux.2-pro" : "black-forest-labs/flux.2-klein-4b", prompt: providerPrompt, output_format: "png" }),
      });
      const payload = await response.json<Record<string, unknown>>();
      const image = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> : undefined;
      if (!response.ok || !image?.b64_json) {
        await env.DB.prepare(`UPDATE students SET ${usedKey} = ${usedKey} - 1 WHERE id = ?`).bind(studentId).run();
        return json({ error: "圖片服務暫時未能完成，這次不會扣除配額。" }, 502);
      }
      return json({ artDataUrl: `data:image/png;base64,${image.b64_json}`, providerMode: "openrouter" });
    }
    return json({ artSeed: Math.floor(Math.random() * 360), providerMode: "prototype" });
  }

  if (url.pathname === "/api/teacher/students" && request.method === "GET") {
    if (url.searchParams.get("code") !== teacherCode(env)) return json({ error: "教師代碼不正確。" }, 403);
    const { results } = await env.DB.prepare(
      "SELECT s.*, (SELECT COUNT(*) FROM generation_logs l WHERE l.student_id = s.id) AS generations FROM students s ORDER BY s.updated_at DESC"
    ).all();
    return json({ students: results || [] });
  }

  if (url.pathname === "/api/teacher/students" && request.method === "PATCH") {
    const body = await readJson(request);
    if (String(body.teacherCode || "") !== teacherCode(env)) return json({ error: "教師代碼不正確。" }, 403);
    const id = String(body.id || "");
    const action = String(body.action || "");
    if (action === "reset") {
      await env.DB.prepare("UPDATE students SET trial_used = 0, final_used = 0, updated_at = ? WHERE id = ?").bind(now(), id).run();
    } else if (action === "toggle") {
      await env.DB.prepare("UPDATE students SET status = CASE WHEN status = 'active' THEN 'paused' ELSE 'active' END, updated_at = ? WHERE id = ?").bind(now(), id).run();
    } else if (action === "bonus") {
      await env.DB.prepare("UPDATE students SET trial_limit = trial_limit + 2, updated_at = ? WHERE id = ?").bind(now(), id).run();
    } else {
      return json({ error: "不支援的教師操作。" }, 400);
    }
    return json({ ok: true });
  }

  return json({ error: "找不到這個服務。" }, 404);
}
