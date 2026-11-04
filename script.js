/* ============================================================
   왜 이 파일이 있는가

   Sveltia CMS 트랙을 선택했다(AGENTS.md). 글은 CMS가 content/posts.json
   한 파일에 저장하고, 이 스크립트가 그 파일을 읽어 목록과 글 화면을 그린다.
   JavaScript가 꺼져 있어도 사이트 이름, 분류, 소개는 보인다.

   - 마크다운 파서는 쓰지 않는다(AGENTS.md). 본문은 일반 텍스트다.
     빈 줄은 문단을 나누고, 한 번의 줄바꿈은 줄바꿈으로 보인다.
   - innerHTML 을 쓰지 않는다. 글 내용은 전부 textContent 로 넣는다.
   ============================================================ */

const SITE_NAME = "정원준의 블로그";
const KIND_LABEL = { novel: "소설", photo: "사진", note: "공부" };
const KIND_SECTION = { novel: "novels", photo: "photos", note: "notes" };

const home = document.getElementById("home");
const post = document.getElementById("post");
const cover = document.querySelector(".cover");
let posts = [];

// 커버의 바람만 제어한다. 글 로딩 실패와 무관하게 멈출 수 있다.
const windToggle = document.querySelector(".wind-toggle");
if (cover && windToggle) {
  const label = windToggle.querySelector(".wind-toggle-label");
  const icon = windToggle.querySelector(".wind-toggle-icon use");
  windToggle.hidden = false;
  windToggle.addEventListener("click", () => {
    const paused = cover.classList.toggle("is-still");
    label.textContent = paused ? "바람 움직이기" : "바람 멈추기";
    // 바람이 멈추면 아이콘의 씨앗 요정이 눈을 감는다.
    icon.setAttribute("href", paused ? "#seed-s-sleep" : "#seed-s-dot");
  });
}

// 지금 위치한 메뉴에 aria-current 를 단다. hash 는 "#novels", "#about" 같은 메뉴 주소.
function markCurrent(hash) {
  for (const link of document.querySelectorAll(".site-nav a")) {
    const active = Boolean(hash) && link.hash === hash;
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

function el(tag, props = {}, text) {
  const node = Object.assign(document.createElement(tag), props);
  if (text !== undefined) node.textContent = text;
  return node;
}

/* "2026-11-03" → <time datetime="2026-11-03">2026. 11. 3.</time> */
function timeEl(date) {
  const t = el("time", { dateTime: date });
  const [y, m, d] = String(date).split("-").map(Number);
  t.textContent = y && m && d ? `${y}. ${m}. ${d}.` : date;
  return t;
}

function imageEl(p) {
  const img = el("img", { src: p.image, alt: p.image_alt || "", loading: "lazy" });
  if (p.image_width && p.image_height) {
    img.width = p.image_width;
    img.height = p.image_height;
  }
  return img;
}

function metaLine(p) {
  const meta = el("p", { className: "meta" });
  if (p.date) meta.append(timeEl(p.date));
  if (p.series) meta.append(`${p.date ? " · " : ""}${p.series}`);
  return meta;
}

function renderLists() {
  for (const list of document.querySelectorAll(".post-list")) {
    const kind = list.dataset.kind;
    const items = posts.filter((p) => p.kind === kind);
    list.replaceChildren();

    if (items.length === 0) {
      list.after(el("p", { className: "empty" }, "아직 올린 글이 없습니다."));
      continue;
    }

    for (const p of items) {
      const li = el("li");
      const link = el("a", { className: "post-link", href: `#p/${p.id}` });
      if (kind === "photo" && p.image) link.append(imageEl(p));
      link.append(el("span", { className: "post-label" }, p.title));
      li.append(link);
      li.append(metaLine(p));
      list.append(li);
    }
  }
}

function showPost(p) {
  post.querySelector(".post-title").textContent = p.title;
  post.querySelector(".post-meta").replaceChildren(...metaLine(p).childNodes);

  const media = post.querySelector(".post-media");
  media.replaceChildren();
  if (p.image) media.append(imageEl(p));

  const body = post.querySelector(".post-body");
  body.replaceChildren();
  const paragraphs = String(p.body || "").replace(/\r\n/g, "\n").split(/\n\s*\n/);
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    const pEl = el("p");
    para.split("\n").forEach((line, i) => {
      if (i > 0) pEl.append(el("br"));
      pEl.append(line);
    });
    body.append(pEl);
  }

  const back = post.querySelector(".post-back a");
  back.href = `#${KIND_SECTION[p.kind] || "novels"}`;
  back.textContent = `${KIND_LABEL[p.kind] || "글"} 목록으로`;

  home.hidden = true;
  if (cover) cover.hidden = true;
  post.hidden = false;
  document.title = `${p.title} — ${SITE_NAME}`;
  markCurrent(`#${KIND_SECTION[p.kind]}`);
  window.scrollTo(0, 0);
  post.querySelector(".post-title").focus();
}

function showHome() {
  post.hidden = true;
  home.hidden = false;
  if (cover) cover.hidden = false;
  document.title = SITE_NAME;
  markCurrent(location.hash);

  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) target.scrollIntoView();
}

function route() {
  const match = location.hash.match(/^#p\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const p = posts.find((x) => x.id === id);
    if (p) return showPost(p);
  }
  showHome();
}

async function init() {
  try {
    const res = await fetch("content/posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    posts = (Array.isArray(data.posts) ? data.posts : [])
      .filter((p) => p && p.id && p.title && KIND_LABEL[p.kind])
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  } catch (err) {
    for (const list of document.querySelectorAll(".post-list")) {
      list.after(el("p", { className: "empty" }, "글 목록을 불러오지 못했습니다."));
    }
    return;
  }

  renderLists();
  window.addEventListener("hashchange", route);
  route();
}

init();
