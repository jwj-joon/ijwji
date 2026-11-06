/* ============================================================
   왜 이 파일이 있는가

   Sveltia CMS 트랙을 선택했다(AGENTS.md). 글은 CMS가 content/posts.json
   한 파일에 저장하고, 이 스크립트가 그 파일을 읽어 첫 화면의 대표작, 갈래 화면의
   전체 목록, 글 화면을 그린다. 화면은 주소 끝(#writing, #p/글-id 등)으로 나뉜다.
   JavaScript가 꺼져 있어도 사이트 이름, 분류, 소개는 보인다.

   - 마크다운 파서는 쓰지 않는다(AGENTS.md). 본문은 일반 텍스트다.
     빈 줄은 문단을 나누고, 한 번의 줄바꿈은 줄바꿈으로 보인다.
   - innerHTML 을 쓰지 않는다. 글 내용은 전부 textContent 로 넣는다.
   ============================================================ */

const SITE_NAME = "정원준의 블로그";
const KIND_LABEL = { writing: "글밭", photo: "사진", note: "공부" };
const KIND_VIEW = { writing: "writing", photo: "photos", note: "notes" };
const OLD_KIND = { novel: "writing" };          // 예전 이름 "소설"로 저장된 글도 글밭으로 읽는다
const VIEW_LABEL = { writing: "글밭", photos: "사진", notes: "공부", about: "소개" };
const OLD_VIEW = { novels: "writing" };          // 예전 주소 #novels 도 글밭으로 간다
const MORE_TEXT = {
  writing: (n) => `글 ${n}편 모두 보기`,
  photo: (n) => `사진 ${n}장 모두 보기`,
  note: (n) => `공부 기록 ${n}편 모두 보기`,
};
const EMPTY_TEXT = { writing: "아직 올린 글이 없습니다.", photo: "아직 올린 사진이 없습니다.", note: "아직 올린 기록이 없습니다." };

const home = document.getElementById("home");
const post = document.getElementById("post");
const views = [...document.querySelectorAll(".view")];
const SVG_NS = "http://www.w3.org/2000/svg";
let posts = [];

// 바람 멈추기: 스위치 자체는 CSS 만으로 동작하고, 여기서는 고른 상태를 기억만 한다.
const windStill = document.getElementById("wind-still");
if (windStill) {
  try {
    windStill.checked = localStorage.getItem("wind") === "still";
    windStill.addEventListener("change", () => {
      localStorage.setItem("wind", windStill.checked ? "still" : "blow");
    });
  } catch (err) {
    // 저장소를 못 쓰는 브라우저에서도 스위치는 그대로 동작한다.
  }
}

// 지금 보고 있는 갈래의 메뉴에 aria-current 를 단다. view 는 "writing", "about" 같은 화면 이름.
function markCurrent(view) {
  for (const link of document.querySelectorAll(".site-nav a")) {
    if (view && link.hash === `#${view}`) link.setAttribute("aria-current", "page");
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
  if (p.place) meta.append(`${meta.childNodes.length ? " · " : ""}${p.place}`);
  return meta;
}

/* 도트 그림 하나를 <use> 로 가져온다. 장식이라 스크린리더는 읽지 않는다. */
function spriteEl(className, viewBox, id) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", id);
  svg.append(use);
  return svg;
}

/* 사진 벽의 한 칸: 액자(사진 + 앉을 자리의 씨앗 요정)와 그 아래 작품 라벨.
   라벨은 미술관 벽의 작품 설명처럼 제목 / 장소 / 날짜를 줄을 나눠 쓴다.
   링크 하나가 사진과 라벨을 함께 감싸서, 스크린리더는 사진 설명 다음에 제목을 읽는다. */
function wallItem(p) {
  const li = el("li", { className: "wall-item" });
  li.dataset.size = ["l", "m", "s"].includes(p.size) ? p.size : "m";
  li.dataset.shape = (p.image_height || 0) > (p.image_width || 0) ? "tall" : "wide";

  const link = el("a", { className: "wall-link", href: `#p/${p.id}` });
  const frame = el("span", { className: "frame" });
  const img = imageEl(p);
  if (p.image_small) {
    img.src = p.image_small;
    img.srcset = `${p.image_small} 800w, ${p.image} 1600w`;
    img.sizes = "(min-width: 50em) 30vw, 90vw";
  }
  frame.append(img, spriteEl("perch", "0 0 11 10", "#seed-s-dot"));

  const label = el("span", { className: "label" });
  label.append(el("span", { className: "label-title" }, p.title));
  if (p.place) label.append(el("span", { className: "label-line" }, p.place));
  if (p.date) {
    const line = el("span", { className: "label-line" });
    line.append(timeEl(p.date));
    label.append(line);
  }

  link.append(frame, label);
  li.append(link);
  return li;
}

/* 첫 화면의 대표작: "첫 화면에 걸기"를 고른 것부터, 모자라면 최신 글로 채운다. */
function pickForHome(items, n) {
  const featured = items.filter((p) => p.featured);
  const rest = items.filter((p) => !p.featured);
  return [...featured, ...rest].slice(0, n);
}

function renderLists() {
  for (const list of document.querySelectorAll(".post-list")) {
    const kind = list.dataset.kind;
    const all = posts.filter((p) => p.kind === kind);
    const show = Number(list.dataset.show) || 0;
    const items = show ? pickForHome(all, show) : all;
    list.replaceChildren();

    // 첫 화면의 "모두 보기"는 대표작 말고도 더 볼 것이 있을 때만 남긴다.
    const more = list.parentElement.querySelector(".more");
    if (more) {
      more.hidden = all.length <= items.length;
      more.querySelector("a").textContent = MORE_TEXT[kind](all.length);
    }

    if (items.length === 0) {
      list.after(el("p", { className: "empty" }, EMPTY_TEXT[kind]));
      continue;
    }

    for (const p of items) {
      if (kind === "photo" && p.image) {
        list.append(wallItem(p));
        continue;
      }
      const li = el("li");
      const link = el("a", { className: "post-link", href: `#p/${p.id}` });
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
  back.href = `#${KIND_VIEW[p.kind]}`;
  back.textContent = `${KIND_LABEL[p.kind]} 목록으로`;

  post.dataset.kind = p.kind;
  showOnly(post);
  document.title = `${p.title} — ${SITE_NAME}`;
  markCurrent(KIND_VIEW[p.kind]);
  window.scrollTo(0, 0);
  post.querySelector(".post-title").focus();
}

/* 첫 화면, 갈래 화면 넷, 글 화면 가운데 하나만 보인다. */
function showOnly(target) {
  home.hidden = target !== home;
  post.hidden = target !== post;
  for (const v of views) v.hidden = v !== target;
  // 첫 화면의 "날아와 앉기"는 처음 한 번만. 다른 화면에 다녀오면 반복하지 않는다.
  if (target !== home) document.documentElement.classList.add("seen");
}

/* 화면마다 보던 위치를 기억해 두었다가, 돌아오면 그 자리로 간다(글 화면은 늘 맨 위에서). */
const scrollMemory = new Map();
let currentKey = null;

function route() {
  if (currentKey !== null) scrollMemory.set(currentKey, window.scrollY);
  const hash = location.hash.slice(1);

  const match = hash.match(/^p\/(.+)$/);
  if (match) {
    const p = posts.find((x) => x.id === decodeURIComponent(match[1]));
    if (p) {
      currentKey = hash;
      return showPost(p);
    }
  }

  const name = OLD_VIEW[hash] || hash;
  const view = VIEW_LABEL[name] && document.getElementById(name);
  if (view) {
    showOnly(view);
    document.title = `${VIEW_LABEL[name]} — ${SITE_NAME}`;
    markCurrent(name);
    currentKey = name;
    window.scrollTo(0, scrollMemory.get(name) || 0);
    view.querySelector(".view-title").focus({ preventScroll: true });
    return;
  }

  showOnly(home);
  document.title = SITE_NAME;
  markCurrent(null);
  currentKey = "home";
  window.scrollTo(0, scrollMemory.get("home") || 0);
}

async function init() {
  try {
    const res = await fetch("content/posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    posts = (Array.isArray(data.posts) ? data.posts : [])
      .map((p) => (p && OLD_KIND[p.kind] ? { ...p, kind: OLD_KIND[p.kind] } : p))
      .filter((p) => p && p.id && p.title && KIND_LABEL[p.kind])
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  } catch (err) {
    for (const list of document.querySelectorAll(".post-list")) {
      list.after(el("p", { className: "empty" }, "글 목록을 불러오지 못했습니다."));
    }
    // 목록이 없어도 소개 화면으로는 갈 수 있어야 한다.
    window.addEventListener("hashchange", route);
    route();
    return;
  }

  renderLists();
  window.addEventListener("hashchange", route);
  route();
}

init();
