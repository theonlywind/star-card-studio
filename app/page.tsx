"use client";

import { useMemo, useState } from "react";

const choices = {
  hero: ["小貓", "小狗", "機械人", "小恐龍", "小怪獸", "魔法小孩"],
  place: ["彩虹森林", "海底世界", "太空站", "魔法學校", "糖果城市", "雨天街道"],
  event: ["發現一扇魔法門", "遇到一位新朋友", "找到發光寶物", "追著一隻蝴蝶", "打開神奇雨傘", "聽到求救聲"],
  ending: ["飛到彩虹天空", "到達一座雲上城堡", "和朋友一起跳舞", "變成勇敢的小英雄", "找到一片星光海", "把寶物送回家"],
  style: ["3D 兒童動畫", "明亮卡通插畫", "積木玩具世界", "柔和水彩動畫", "可愛像素遊戲"],
  action: ["慢慢向前走", "輕輕飛上天空", "轉身望向鏡頭", "打開手中的物品", "和朋友揮手", "開心地跳起來"],
};

type Key = keyof typeof choices;

export default function Home() {
  const [picked, setPicked] = useState<Record<Key, string>>({
    hero: choices.hero[0], place: choices.place[0], event: choices.event[0], ending: choices.ending[0], style: choices.style[0], action: choices.action[0],
  });
  const [title, setTitle] = useState("我的小電影");
  const [copied, setCopied] = useState("");

  const startPrompt = useMemo(() => `請生成一張 ${picked.style}、兒童友善、16:9 橫向的圖片：${picked.hero} 在 ${picked.place}，${picked.event}。畫面明亮、角色表情清楚、沒有文字、沒有水印。`, [picked]);
  const endPrompt = useMemo(() => `請生成一張 ${picked.style}、兒童友善、16:9 橫向的圖片：${picked.hero} ${picked.ending}。和第一張圖保持相同角色、服裝和畫風；畫面明亮、沒有文字、沒有水印。`, [picked]);
  const videoPrompt = useMemo(() => `${picked.hero} 在 ${picked.place} ${picked.action}，因為 ${picked.event}，最後 ${picked.ending}。動作自然連續，鏡頭平穩跟隨，保持 ${picked.style}，不加文字。`, [picked]);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  }
  function choose(key: Key, value: string) { setPicked((old) => ({ ...old, [key]: value })); }

  return <main>
    <header className="topbar">
      <div className="brand"><span>▶</span><div><strong>小小 AI 電影工作室</strong><small>兩張圖，變成一段小電影</small></div></div>
      <div className="header-tip">先揀選，再生成</div>
    </header>
    <section className="hero">
      <div><p className="eyebrow">最後一堂・AI 影片創作</p><h1>你的故事，<br/><em>現在開拍！</em></h1><p>不用寫長句子。先按圖卡選故事，網站會幫你寫好首幀、尾幀和影片指示。</p></div>
      <div className="movie-card"><span className="clap">🎬</span><b>第 1 張圖</b><i>故事開始</i><div className="arrow">↓</div><b>第 2 張圖</b><i>精彩結局</i></div>
    </section>

    <section className="workflow" aria-label="電影創作步驟">
      <div className="step active"><span>1</span> 揀故事圖卡</div><div className="line"/><div className="step"><span>2</span> 生成兩張圖</div><div className="line"/><div className="step"><span>3</span> 製作影片</div>
    </section>

    <section className="builder">
      <div className="picker-panel">
        <p className="eyebrow">步驟 1</p><h2>揀選你的故事</h2><p className="soft">每一行揀一張圖卡，便完成構思！</p>
        <Choice title="誰是主角？" icon="🧑‍🚀" values={choices.hero} selected={picked.hero} onChoose={(v) => choose("hero", v)}/>
        <Choice title="故事在哪裏開始？" icon="📍" values={choices.place} selected={picked.place} onChoose={(v) => choose("place", v)}/>
        <Choice title="一開始發生甚麼？" icon="✨" values={choices.event} selected={picked.event} onChoose={(v) => choose("event", v)}/>
        <Choice title="最後會怎樣？" icon="🏁" values={choices.ending} selected={picked.ending} onChoose={(v) => choose("ending", v)}/>
        <Choice title="選擇畫風" icon="🎨" values={choices.style} selected={picked.style} onChoose={(v) => choose("style", v)}/>
        <Choice title="影片中的動作" icon="🎞️" values={choices.action} selected={picked.action} onChoose={(v) => choose("action", v)}/>
      </div>
      <aside className="plan-panel">
        <p className="eyebrow">你的故事</p>
        <label>電影名稱<input value={title} maxLength={18} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="storyboard"><div className="frame start"><span>第 1 幀・開始</span><strong>{picked.hero}</strong><small>{picked.place}<br/>{picked.event}</small></div><div className="frame end"><span>最後 1 幀・結局</span><strong>{picked.hero}</strong><small>{picked.ending}</small></div></div>
        <p className="say-it">我拍的《{title || "我的小電影"}》：{picked.hero} 在 {picked.place}，{picked.event}，最後 {picked.ending}！</p>
      </aside>
    </section>

    <section className="make-section">
      <div><p className="eyebrow">步驟 2</p><h2>生成兩張關鍵圖片</h2><p>把提示詞複製到老師指定的 AI 繪圖工具。完成後，下載並保留兩張橫向圖片。</p></div>
      <PromptCard number="A" title="生成第 1 幀：故事開始" text={startPrompt} copied={copied === "首幀"} onCopy={() => copy("首幀", startPrompt)}/>
      <PromptCard number="B" title="生成最後 1 幀：故事結局" text={endPrompt} copied={copied === "尾幀"} onCopy={() => copy("尾幀", endPrompt)}/>
    </section>

    <section className="video-section">
      <div><p className="eyebrow">步驟 3</p><h2>讓兩張圖動起來</h2><p>在老師指定的 AI 影片工具，上載「第 1 幀」和「最後 1 幀」，然後貼上以下影片指示。</p></div>
      <PromptCard number="▶" title="影片動作指示" text={videoPrompt} copied={copied === "影片"} onCopy={() => copy("影片", videoPrompt)}/>
      <div className="checklist"><h3>交片前檢查</h3><p>□ 兩張圖都是橫向</p><p>□ 主角在兩張圖中看起來一樣</p><p>□ 沒有個人資料、校名或真實相片</p><p>□ 影片能播放</p></div>
    </section>
    <footer>小小 AI 電影工作室　•　AI 會幫忙，但故事是你創作的。</footer>
  </main>;
}

function Choice({ title, icon, values, selected, onChoose }: { title: string; icon: string; values: readonly string[]; selected: string; onChoose: (value: string) => void }) {
  return <fieldset className="choice"><legend>{icon} {title}</legend><div>{values.map((value) => <button type="button" className={selected === value ? "picked" : ""} onClick={() => onChoose(value)} key={value}>{value}</button>)}</div></fieldset>;
}
function PromptCard({ number, title, text, copied, onCopy }: { number: string; title: string; text: string; copied: boolean; onCopy: () => void }) {
  return <article className="prompt-card"><span className="number">{number}</span><div><h3>{title}</h3><p>{text}</p><button onClick={onCopy}>{copied ? "✓ 已複製！" : "複製提示詞"}</button></div></article>;
}
