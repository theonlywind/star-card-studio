"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Student = {
  id: string;
  displayName: string;
  trialLimit: number;
  trialUsed: number;
  finalLimit: number;
  finalUsed: number;
  status: string;
};

type TeacherStudent = {
  id: string;
  display_name: string;
  trial_limit: number;
  trial_used: number;
  final_limit: number;
  final_used: number;
  status: string;
  generations: number;
};

const classCodeHint = "STAR-CARD-2026";
const defaultPrompt = "一隻水和電屬性的原創小精靈，圓形身體，藍色鱗片，尾巴像閃電，在雨後海邊跳起來，明亮兒童插畫風";

export default function Home() {
  const [mode, setMode] = useState<"student" | "teacher">("student");
  const [student, setStudent] = useState<Student | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [name, setName] = useState("雨電獸");
  const [element, setElement] = useState("水・電");
  const [hp, setHp] = useState("80");
  const [skill, setSkill] = useState("閃浪衝擊");
  const [story, setStory] = useState("暴雨過後，牠會用尾巴的電光為迷路的人照路。 ");
  const [artSeed, setArtSeed] = useState(196);
  const [artDataUrl, setArtDataUrl] = useState("");
  const [notice, setNotice] = useState("先設計你的原創精靈，再開始試畫。 ");
  const [busy, setBusy] = useState(false);
  const [teacherStudents, setTeacherStudents] = useState<TeacherStudent[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("star-card-student");
    if (saved) setStudent(JSON.parse(saved));
  }, []);

  const trialLeft = student ? Math.max(0, student.trialLimit - student.trialUsed) : 0;
  const finalLeft = student ? Math.max(0, student.finalLimit - student.finalUsed) : 0;
  const artStyle = useMemo(() => ({ "--hue": artSeed } as React.CSSProperties), [artSeed]);

  async function join(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName, classCode }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error);
    const next: Student = { id: result.id, displayName: result.displayName, trialLimit: result.trialLimit, trialUsed: result.trialUsed, finalLimit: result.finalLimit, finalUsed: result.finalUsed, status: result.status };
    setStudent(next);
    window.localStorage.setItem("star-card-student", JSON.stringify(next));
    setNotice("歡迎！先完成卡牌資料，再按「快速試畫」。");
  }

  async function generate(kind: "trial" | "final") {
    if (!student) return;
    setBusy(true);
    const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: student.id, kind, prompt }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(result.error);
    const next = { ...student, trialUsed: student.trialUsed + (kind === "trial" ? 1 : 0), finalUsed: student.finalUsed + (kind === "final" ? 1 : 0) };
    setStudent(next);
    window.localStorage.setItem("star-card-student", JSON.stringify(next));
    if (result.artDataUrl) setArtDataUrl(result.artDataUrl);
    if (result.artSeed !== undefined) setArtSeed(result.artSeed);
    setNotice(kind === "trial" ? "試畫完成！想一想：下一版只要改哪一個元素？" : "最終插圖完成！現在可下載你的卡。 ");
  }

  async function loadTeacher() {
    const response = await fetch(`/api/teacher/students?code=${encodeURIComponent(teacherCode)}`);
    const result = await response.json();
    if (!response.ok) return setNotice(result.error);
    setTeacherStudents(result.students);
  }

  async function adjust(id: string, action: "reset" | "toggle" | "bonus") {
    const response = await fetch("/api/teacher/students", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherCode, id, action }) });
    const result = await response.json();
    if (!response.ok) return setNotice(result.error);
    await loadTeacher();
  }

  async function download(format: "png" | "jpeg") {
    const canvas = document.createElement("canvas");
    canvas.width = 1488;
    canvas.height = 2078;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const hue = artSeed;
    ctx.fillStyle = `hsl(${hue}, 68%, 17%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff9e8";
    roundRect(ctx, 58, 58, 1372, 1962, 72); ctx.fill();
    ctx.fillStyle = `hsl(${hue}, 70%, 91%)`;
    roundRect(ctx, 92, 220, 1304, 1080, 48); ctx.fill();
    if (artDataUrl) {
      const image = new Image(); image.src = artDataUrl; await image.decode();
      ctx.drawImage(image, 112, 240, 1264, 1040);
    } else drawCreature(ctx, 744, 760, hue);
    ctx.fillStyle = "#17111d"; ctx.font = "bold 92px Arial"; ctx.fillText(name || "未命名精靈", 112, 168);
    ctx.font = "bold 66px Arial"; ctx.textAlign = "right"; ctx.fillText(`HP ${hp || "?"}`, 1366, 168); ctx.textAlign = "left";
    ctx.fillStyle = `hsl(${hue}, 54%, 32%)`; ctx.font = "bold 48px Arial"; ctx.fillText(element || "元素", 112, 1372);
    ctx.fillStyle = "#17111d"; ctx.font = "bold 58px Arial"; ctx.fillText(skill || "特殊技能", 112, 1510);
    ctx.font = "42px Arial"; wrapText(ctx, story || "寫下這隻精靈的故事。", 112, 1592, 1260, 58);
    ctx.fillStyle = "#514b57"; ctx.font = "32px Arial"; ctx.fillText("原創精靈對戰卡・小小 AI 創作家", 112, 1940);
    const href = canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.95);
    const link = document.createElement("a"); link.href = href; link.download = `${name || "精靈卡"}.${format === "png" ? "png" : "jpg"}`; link.click();
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span>✦</span><div><strong>精靈卡創作室</strong><small>小小 AI 創作家</small></div></div>
        <div className="mode-switch"><button className={mode === "student" ? "selected" : ""} onClick={() => setMode("student")}>學生創作室</button><button className={mode === "teacher" ? "selected" : ""} onClick={() => setMode("teacher")}>教師控制台</button></div>
      </header>
      {mode === "teacher" ? <section className="teacher-shell"><div className="teacher-head"><p className="eyebrow">教師控制台</p><h1>班房配額，一眼掌握。</h1><p>你可獎勵多 2 次試畫、暫停學生，或重設其配額。</p></div><div className="teacher-login"><input type="password" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} placeholder="教師代碼"/><button onClick={loadTeacher}>查看班房</button></div><TeacherTable students={teacherStudents} onAdjust={adjust}/></section> : !student ? <section className="join-shell"><div><p className="eyebrow">第一堂・原創精靈卡</p><h1>設計一隻<br/>從未出現過的精靈。</h1><p>今天你會用清楚 prompt 創作角色，再把它變成可下載、可列印的對戰卡。</p><div className="rules"><span>不輸入個人資料</span><span>不用官方角色或標誌</span><span>AI 結果要自己檢查</span></div></div><form className="join-card" onSubmit={join}><p className="eyebrow">開始創作</p><label>你的創作暱稱<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：小宇" required/></label><label>班房代碼<input value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder={classCodeHint} required/></label><button disabled={busy}>{busy ? "正在加入…" : "進入創作室"}</button><small>原型班房代碼：{classCodeHint}</small></form></section> : <section className="studio"><aside className="brief"><p className="eyebrow">你好，{student.displayName}</p><h1>先想清楚，<br/>再讓 AI 幫你畫。</h1><div className="quota"><div><span>快速試畫</span><strong>{trialLeft}<small> / {student.trialLimit}</small></strong></div><div><span>最終成品</span><strong>{finalLeft}<small> / {student.finalLimit}</small></strong></div></div><p className="notice">{notice}</p><button className="ghost" onClick={() => { localStorage.removeItem("star-card-student"); setStudent(null); }}>更換學生</button></aside><section className="editor"><div className="form-grid"><label>精靈名稱<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>屬性<input value={element} onChange={(e) => setElement(e.target.value)} /></label><label>HP<input value={hp} onChange={(e) => setHp(e.target.value)} /></label><label>技能<input value={skill} onChange={(e) => setSkill(e.target.value)} /></label><label className="wide">精靈故事<textarea value={story} onChange={(e) => setStory(e.target.value)} rows={2}/></label><label className="wide">AI 繪圖 prompt<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}/><small>提示：描述角色、特徵、動作、場景和畫風；不要用官方角色名稱。</small></label></div><div className="actions"><button className="secondary" onClick={() => generate("trial")} disabled={busy || !trialLeft}>✦ 快速試畫（餘 {trialLeft}）</button><button onClick={() => generate("final")} disabled={busy || !finalLeft}>★ 製作最終圖（餘 {finalLeft}）</button></div></section><section className="preview-column"><div className="card" ref={cardRef}><div className="card-top"><strong>{name || "未命名精靈"}</strong><b>HP {hp || "?"}</b></div><div className="card-art" style={artDataUrl ? { backgroundImage: `url(${artDataUrl})` } : artStyle}><div className="creature"><i/><i/><i/></div></div><p className="element">{element || "元素"}</p><h2>{skill || "特殊技能"}</h2><p className="story">{story || "寫下這隻精靈的故事。"}</p><footer>原創精靈對戰卡</footer></div><div className="download"><button onClick={() => download("png")}>下載 PNG</button><button className="ghost" onClick={() => download("jpeg")}>下載 JPEG</button></div><p className="print-note">PNG 適合列印；可用 63 × 88 mm 卡牌尺寸。</p></section></section>}
    </main>
  );
}

function TeacherTable({ students, onAdjust }: { students: TeacherStudent[]; onAdjust: (id: string, action: "reset" | "toggle" | "bonus") => void }) {
  if (!students.length) return <div className="empty">輸入教師代碼後，這裡會顯示學生的生成次數和配額。</div>;
  return <div className="table-wrap"><table><thead><tr><th>學生</th><th>試畫</th><th>成品</th><th>總生成</th><th>狀態</th><th>操作</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.display_name}</td><td>{student.trial_used} / {student.trial_limit}</td><td>{student.final_used} / {student.final_limit}</td><td>{student.generations}</td><td><span className={`status ${student.status}`}>{student.status === "active" ? "可創作" : "已暫停"}</span></td><td className="row-actions"><button onClick={() => onAdjust(student.id, "bonus")}>+2 次</button><button onClick={() => onAdjust(student.id, "reset")}>重設</button><button onClick={() => onAdjust(student.id, "toggle")}>{student.status === "active" ? "暫停" : "恢復"}</button></td></tr>)}</tbody></table></div>;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.closePath(); }
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) { let line = ""; let currentY = y; for (const char of text) { const test = line + char; if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, currentY); line = char; currentY += lineHeight; } else line = test; } ctx.fillText(line, x, currentY); }
function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, hue: number) { ctx.fillStyle = `hsl(${hue}, 78%, 53%)`; ctx.beginPath(); ctx.ellipse(x, y, 350, 310, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; [[x-120,y-70],[x+120,y-70]].forEach(([ex,ey]) => { ctx.beginPath(); ctx.arc(ex, ey, 80, 0, Math.PI*2); ctx.fill(); ctx.fillStyle="#1b2035"; ctx.beginPath(); ctx.arc(ex, ey, 34, 0, Math.PI*2); ctx.fill(); ctx.fillStyle="#fff"; }); ctx.strokeStyle = "#1b2035"; ctx.lineWidth=30; ctx.beginPath(); ctx.arc(x, y+80, 100, 0, Math.PI); ctx.stroke(); }
