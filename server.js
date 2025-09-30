// server.js (ESM)

/*
 *
 * expressがない場合、以下実行
 * > npm install express
 * 
 */

import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== 起動時の最上位（これより上へは行かない）======
const START_DIR = path.resolve("./");
// 現在の BASE_DIR（クリックで変化）
let CURRENT_BASE = START_DIR;
// 除外したいディレクトリ名
const EXCLUDES = new Set([".git", ".deleted","node_modules",".gitignore"]);

function isExcluded(name) {
  // 除外リストに一致、または ~ で終わるものを除外
  if (EXCLUDES.has(name)) return true;
  if (name.endsWith("~")) return true;
  return false;
}



app.use(express.json());
app.use(express.urlencoded({ extended: true })); // （任意）フォーム対応


app.use("/__content/:dir", (req, res, next) => {
  const raw = req.params.dir;
  let dir; try { dir = decodeURIComponent(raw); } catch { dir = raw; }

  if (EXCLUDES.has(dir)) return res.status(404).send("directory not found");

  const base = path.join(CURRENT_BASE, dir);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    return res.status(404).send("directory not found");
  }

  // このハンドラ内の req.path は「残りのパス」
  const subPath = req.path.replace(/^\/+/, ""); // "" なら直下

  // ★ 直下に _index.html があるかを先に判定
  const hasCustomIndex = fs.existsSync(path.join(base, "_index.html"));

  // 直下アクセス：_index.html を最優先（dist より優先）
  if (subPath === "" && hasCustomIndex) {
    return res.sendFile(path.join(base, "_index.html"));
  }

  // ★ 重要：_index.html があれば “配下のリクエストも base を優先”
  // そうでなければ dist 優先
  const dist = path.join(base, "dist");
  const root = hasCustomIndex
    ? base
    : (fs.existsSync(dist) && fs.statSync(dist).isDirectory()) ? dist : base;

  const targetPath = path.join(root, subPath);

  // ディレクトリ：index/_index があれば配信、無ければリンク一覧
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    const idx = ["_index.html","index.html"].find(f => fs.existsSync(path.join(targetPath, f)));
    if (idx) {
      return express.static(root, { index: ["_index.html","index.html"], extensions: ["html"] })(req, res, next);
    }

    // const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const entries = fs
      .readdirSync(targetPath, { withFileTypes: true })
      .filter(ent => !isExcluded(ent.name));



    const baseUrl = `/__content/${encodeURIComponent(dir)}/${subPath ? encodeURI(subPath) + "/" : ""}`;
    const rows = entries
      .sort((a,b)=> (a.isDirectory()===b.isDirectory()) ? a.name.localeCompare(b.name) : (a.isDirectory()? -1:1))
      .map(ent => {
        const href = baseUrl + encodeURIComponent(ent.name) + (ent.isDirectory()? "/" : "");
        const mark = ent.isDirectory() ? "📁" : "📄";
        return `<div style="padding:2px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          <a href="${href}" style="text-decoration:none;color:#06c">${mark} ${ent.name}</a>
        </div>`;
      }).join("");
    const upHref = baseUrl.replace(/[^/]+\/?$/, "");
    const upLink = subPath ? `<div style="margin-bottom:6px;"><a href="${upHref}" style="color:#06c;">⬆ 上へ</a></div>` : "";

    return res.send(`<!doctype html><meta charset="utf-8"><title>${dir}${subPath?" / "+subPath:""}</title>
    <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-size:14px; margin:8px;">
      <div style="max-width:480px;">
        <div style="font-weight:600; margin-bottom:6px;">${dir}${subPath?" / "+subPath:""}</div>
        ${upLink}
        <div>${rows || "<em>（空のディレクトリ）</em>"}</div>
      </div>
    </body>`);
  }

  // ファイルはそのまま
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    return res.sendFile(targetPath);
  }

  // それ以外 → 通常 static に委譲（拡張子補完など）
  return express.static(root, { index: ["_index.html","index.html"], extensions: ["html"] })(req, res, next);
});



// 安全に子孫パスか判定
const isSubPath = (child, parent) => {
  const rChild = path.resolve(child);
  const rParent = path.resolve(parent);
  return rChild === rParent || rChild.startsWith(rParent + path.sep);
};

// dist 優先で配信する静的関数
const serveDistFirst = (root) =>
  express.static(root, { index: ["index.html", "_index.html"], extensions: ["html"] });

// ====== UI（一覧） ======
app.get("/", (req, res) => {
  // const dirs = fs.readdirSync(CURRENT_BASE).filter(name =>
  //   fs.statSync(path.join(CURRENT_BASE, name)).isDirectory()
  // );

  const dirs = fs.readdirSync(CURRENT_BASE).filter(name => {
    const full = path.join(CURRENT_BASE, name);
    return (
      fs.statSync(full).isDirectory() &&
      !EXCLUDES.has(name)
    );
  });



  const canGoUp = CURRENT_BASE !== START_DIR;
  const tiles = dirs.map((name) => {
    const base = path.join(CURRENT_BASE, name);
    const hasDist = fs.existsSync(path.join(base, "dist")) && fs.statSync(path.join(base, "dist")).isDirectory();
    const enc = encodeURIComponent(name);
    const label = hasDist ? `${name}/dist` : name;

    return `
      <div class="tile">
        <div class="label"><a href="/${enc}/">${label}</a></div>
        <iframe src="/__content/${enc}/" width="200" height="200" class="thumb"></iframe>

        
        <button class="dot" title="このディレクトリをBASE_DIRにする"
            onclick="event.preventDefault(); event.stopPropagation(); setBase('${enc}')">●</button>


      </div>
    `;
  }).join("");

  res.send(`<!doctype html>
<html lang="ja"><meta charset="utf-8"><title>Dist-first Viewer</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:16px}
  h2{font-size:16px;margin:0 0 12px}
  .wrap{display:flex;flex-wrap:wrap;gap:8px}
  .tile{position:relative;display:inline-block;text-align:center}
  .label{width:200px;font-size:12px;line-height:1.3;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .label a{text-decoration:none;color:#06c}
  .thumb{border:1px solid #ccc; position:relative; z-index:1}
  .dot{
    position:absolute; right:6px; bottom:10px; 
    width:18px; height:18px; border-radius:50%;
    border:0; background:#333; color:#fff; cursor:pointer; font-size:11px; line-height:18px; padding:0;
    opacity:.85; z-index:5
  }
  .dot:hover{opacity:1}
  .up{
    position:fixed; right:12px; top:12px; z-index:9999;
    padding:10px 14px; border-radius:18px; border:1px solid #ccc; background:#fff; cursor:pointer;
    box-shadow:0 2px 8px rgba(0,0,0,.1)
  }
  .path{font-size:12px;color:#555;margin-bottom:8px}
</style>
<body>
  <a target="_blank" href="http://test02.i-elements.net:5173/">5173</a>
  <div class="path">BASE_DIR: ${CURRENT_BASE.replaceAll("&","&amp;")}</div>
  <h2>フォルダ一覧（dist があれば dist を配信、無ければ _index.html / index.html、無ければリンク一覧）</h2>
  <div class="wrap">${tiles || "<em>フォルダがありません</em>"}</div>
  ${canGoUp ? `<button class="up" onclick="goUp()">⬆ 一つ上へ</button>` : ""}
<script>
  async function setBase(encName){
    const name = decodeURIComponent(encName);
    const res = await fetch('/api/set-base', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name })
    });
    if(res.ok){ location.reload(); } else { alert('切替に失敗しました'); }
  }
  async function goUp(){
    const res = await fetch('/api/go-up', { method:'POST' });
    if(res.ok){ location.reload(); } else { alert('これ以上は上に行けません'); }
  }
</script>
</body></html>`);
});

// ====== API: BASE_DIR 切替 ======
app.post("/api/set-base", (req, res) => {
  const name = req.body?.name;
  if (!name) return res.status(400).send("name required");

  // 現在の直下のみを対象（深い階層にしたいなら調整可）
  const target = path.join(CURRENT_BASE, name);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    return res.status(404).send("directory not found");
  }
  // START_DIR 配下のみ許可
  if (!isSubPath(target, START_DIR)) {
    return res.status(403).send("forbidden");
  }
  CURRENT_BASE = path.resolve(target);
  return res.sendStatus(200);
});

// ====== API: 1つ上へ（START_DIRより上は不可）======
app.post("/api/go-up", (req, res) => {
  if (CURRENT_BASE === START_DIR) return res.status(400).send("already at root");
  const parent = path.dirname(CURRENT_BASE);
  if (!isSubPath(parent, START_DIR)) return res.status(403).send("forbidden");
  CURRENT_BASE = parent;
  return res.sendStatus(200);
});


// 見た目URLはラッパー（/dir/ → フル画面 iframe）
app.get("/:dir/", (req, res) => {
  const raw = req.params.dir;
  let dir; try { dir = decodeURIComponent(raw); } catch { dir = raw; }

  const base = path.join(CURRENT_BASE, dir);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    return res.status(404).send("directory not found");
  }
  const enc = encodeURIComponent(dir);
  res.send(`<!doctype html><meta charset="utf-8"><title>${dir}</title>
  <body style="margin:0">
    <iframe src="/__content/${enc}/" style="border:0;width:100vw;height:100vh"></iframe>
  </body>`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server http://0.0.0.0:${PORT}`);
});
