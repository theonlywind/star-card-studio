import { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, handleImageOptimization } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

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
  TEACHER_ACCESS_CODE?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type Row = Record<string, unknown>;

const allowedOrigin = "https://theonlywind.github.io";
const now = () => new Date().toISOString();
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const hash = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  return {
    "access-control-allow-origin": origin === allowedOrigin ? origin : allowedOrigin,
    "access-control-allow-headers": "content-type,x-teacher-code",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

async function body(request: Request): Promise<Row> {
  try {
    return await request.json<Row>();
  } catch {
    return {};
  }
}

function safePrompt(prompt: string) {
  return prompt.length >= 8 &&
    prompt.length <= 800 &&
    !/住址|地址|電話|tel|phone|裸體|色情|血腥|成人|裸露/i.test(prompt);
}

function studentView(row: Row) {
  return {
    id: row.id,
    displayName: row.display_name,
    videoLimit: Number(row.video_limit),
    videoUsed: Number(row.video_used),
    status: row.status,
  };
}

async function findStudent(env: Env, classCode: string) {
  return env.DB.prepare(
    "SELECT s.*, c.id AS code_id, c.active AS code_active FROM class_codes c LEFT JOIN class_students s ON s.code_id=c.id WHERE c.code_hash=?",
  ).bind(await hash(classCode.toUpperCase())).first<Row>();
}

function teacherAllowed(request: Request, env: Env, requestBody?: Row) {
  const supplied = clean(request.headers.get("x-teacher-code") || requestBody?.teacherCode, 128);
  const configured = clean(env.TEACHER_ACCESS_CODE, 128);
  return Boolean(configured) && supplied === configured;
}

async function join(request: Request, env: Env) {
  const input = await body(request);
  const displayName = clean(input.displayName, 18);
  const classCode = clean(input.classCode, 32).toUpperCase();
  if (!displayName || !classCode) return json(request, { error: "請輸入創作暱稱及學生代碼。" }, 400);

  const found = await findStudent(env, classCode);
  if (!found || !found.code_active) return json(request, { error: "學生代碼不正確或已停用。" }, 401);
  if (found.id) {
    if (found.status !== "active") return json(request, { error: "學生帳戶已暫停，請找老師。" }, 403);
    return json(request, { student: studentView(found) });
  }

  const id = crypto.randomUUID();
  const stamp = now();
  await env.DB.prepare(
    "INSERT INTO class_students (id,code_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?)",
  ).bind(id, found.code_id, displayName, stamp, stamp).run();
  return json(request, { student: { id, displayName, videoLimit: 5, videoUsed: 0, status: "active" } }, 201);
}

async function makeCodes(request: Request, env: Env) {
  const input = await body(request);
  if (!teacherAllowed(request, env, input)) return json(request, { error: "教師代碼不正確。" }, 401);
  const count = Math.min(30, Math.max(1, Number(input.count) || 10));
  const codes: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const plain = `MOVIE-${Math.floor(100 + Math.random() * 900)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 4).toUpperCase()}`;
    codes.push(plain);
    await env.DB.prepare(
      "INSERT INTO class_codes (id,code_hash,label,created_at) VALUES (?,?,?,?)",
    ).bind(crypto.randomUUID(), await hash(plain), `學生 ${index + 1}`, now()).run();
  }
  return json(request, { codes }, 201);
}

async function listStudents(request: Request, env: Env) {
  if (!teacherAllowed(request, env)) return json(request, { error: "教師代碼不正確。" }, 401);
  const rows = await env.DB.prepare(
    "SELECT s.* FROM class_students s JOIN class_codes c ON c.id=s.code_id ORDER BY s.created_at DESC",
  ).all<Row>();
  return json(request, { students: (rows.results || []).map(studentView) });
}

async function updateStudent(request: Request, env: Env) {
  const input = await body(request);
  if (!teacherAllowed(request, env, input)) return json(request, { error: "教師代碼不正確。" }, 401);
  const id = clean(input.id, 100);
  const action = clean(input.action, 20);
  if (action === "reset") {
    await env.DB.prepare("UPDATE class_students SET video_used=0,updated_at=? WHERE id=?").bind(now(), id).run();
  } else if (action === "bonus") {
    await env.DB.prepare("UPDATE class_students SET video_limit=video_limit+1,updated_at=? WHERE id=?").bind(now(), id).run();
  } else if (action === "toggle") {
    await env.DB.prepare(
      "UPDATE class_students SET status=CASE status WHEN 'active' THEN 'paused' ELSE 'active' END,updated_at=? WHERE id=?",
    ).bind(now(), id).run();
  } else {
    return json(request, { error: "無效操作。" }, 400);
  }
  return json(request, { ok: true });
}

async function generateImage(request: Request, env: Env) {
  const input = await body(request);
  const prompt = clean(input.prompt, 700);
  const classCode = clean(input.classCode, 32).toUpperCase();
  const student = await findStudent(env, classCode);
  if (!student?.id || student.status !== "active") return json(request, { error: "學生帳戶不可使用。" }, 403);
  if (!env.OPENROUTER_API_KEY) return json(request, { error: "未設定圖片生成服務。" }, 503);
  if (!safePrompt(prompt)) return json(request, { error: "請使用原創、兒童友善描述，且不要輸入個人資料。" }, 400);

  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "black-forest-labs/flux.2-klein-4b",
      output_format: "png",
      prompt: `Original child-friendly animation still, 16:9, no real people, no logos, no words, no watermark. ${prompt}`,
    }),
  });
  const payload = await response.json<{ data?: Array<{ b64_json?: string }> }>().catch(() => ({}));
  const encoded = payload.data?.[0]?.b64_json;
  if (!response.ok || !encoded) return json(request, { error: "圖片暫時未能生成，請稍後再試。" }, 502);
  return json(request, { image: `data:image/png;base64,${encoded}` });
}

async function startVideo(request: Request, env: Env) {
  const input = await body(request);
  const classCode = clean(input.classCode, 32).toUpperCase();
  const prompt = clean(input.prompt, 800);
  const firstFrame = clean(input.firstFrame, 10_000_000);
  const lastFrame = clean(input.lastFrame, 10_000_000);
  if (!env.ARK_API_KEY) return json(request, { error: "未設定 ARK_API_KEY。" }, 503);
  if (!safePrompt(prompt)) return json(request, { error: "請先輸入至少 8 個字的原創、兒童友善故事內容。" }, 400);
  if (!firstFrame.startsWith("data:image/") || !lastFrame.startsWith("data:image/")) {
    return json(request, { error: "請先生成開始圖和結尾圖。" }, 400);
  }

  const student = await findStudent(env, classCode);
  if (!student?.id || student.status !== "active") return json(request, { error: "學生帳戶不可使用。" }, 403);
  if (Number(student.video_used) >= Number(student.video_limit)) {
    return json(request, { error: "你的 5 次影片配額已用完，請找老師協助。" }, 429);
  }

  const response = await fetch("https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks", {
    method: "POST",
    headers: { authorization: `Bearer ${env.ARK_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "dreamina-seedance-2-0-mini-260615",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: firstFrame }, role: "first_frame" },
        { type: "image_url", image_url: { url: lastFrame }, role: "last_frame" },
      ],
      resolution: "480p",
      ratio: "16:9",
      duration: 10,
      watermark: false,
      generate_audio: false,
      safety_identifier: student.id,
    }),
  });
  const result = await response.json<{ id?: string; error?: { message?: string } }>().catch(() => ({}));
  if (!response.ok || !result.id) return json(request, { error: result.error?.message || "影片未能開始；這次不會扣配額。" }, 502);

  const jobId = crypto.randomUUID();
  const stamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE class_students SET video_used=video_used+1,updated_at=? WHERE id=?").bind(stamp, student.id),
    env.DB.prepare(
      "INSERT INTO video_jobs (id,student_id,provider_task_id,prompt,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(jobId, student.id, result.id, prompt, "queued", stamp, stamp),
  ]);
  return json(request, { jobId, videoUsed: Number(student.video_used) + 1, videoLimit: Number(student.video_limit) }, 202);
}

async function videoStatus(request: Request, env: Env, jobId: string) {
  const job = await env.DB.prepare("SELECT * FROM video_jobs WHERE id=?").bind(jobId).first<Row>();
  if (!job) return json(request, { error: "找不到影片工作。" }, 404);
  if (job.status === "succeeded" || job.status === "failed") return json(request, { job });
  if (!env.ARK_API_KEY) return json(request, { error: "未設定 ARK_API_KEY。" }, 503);

  const response = await fetch(
    `https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/${job.provider_task_id}`,
    { headers: { authorization: `Bearer ${env.ARK_API_KEY}` } },
  );
  const result = await response.json<{
    status?: string;
    content?: { video_url?: string };
    error?: { message?: string };
  }>().catch(() => ({}));
  if (!response.ok) return json(request, { error: "暫時未能查詢影片狀態。" }, 502);

  const status = result.status || String(job.status);
  const videoUrl = result.content?.video_url || null;
  const errorMessage = result.error?.message || null;
  await env.DB.prepare(
    "UPDATE video_jobs SET status=?,video_url=?,error_message=?,updated_at=? WHERE id=?",
  ).bind(status, videoUrl, errorMessage, now(), jobId).run();
  return json(request, { job: { ...job, status, video_url: videoUrl, error_message: errorMessage } });
}

async function api(request: Request, env: Env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  const path = new URL(request.url).pathname;
  try {
    if (path === "/api/health" && request.method === "GET") return json(request, { ok: true });
    if (path === "/api/join" && request.method === "POST") return await join(request, env);
    if (path === "/api/teacher/codes" && request.method === "POST") return await makeCodes(request, env);
    if (path === "/api/teacher/students" && request.method === "GET") return await listStudents(request, env);
    if (path === "/api/teacher/students" && request.method === "PATCH") return await updateStudent(request, env);
    if (path === "/api/image" && request.method === "POST") return await generateImage(request, env);
    if (path === "/api/video" && request.method === "POST") return await startVideo(request, env);
    if (path.startsWith("/api/video/") && request.method === "GET") return await videoStatus(request, env, path.slice(11));
    return json(request, { error: "找不到服務。" }, 404);
  } catch (error) {
    console.error("Movie API error", error);
    return json(request, { error: "服務暫時發生錯誤，請稍後再試。" }, 500);
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (stream, { width, format, quality }) => {
          const result = await env.IMAGES.input(stream).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
