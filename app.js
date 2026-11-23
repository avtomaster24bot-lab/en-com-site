/* Сайт сервисного центра: витрина услуг + лента постов, которые публикует бот (data/posts.json). Без сборки. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const TBD = '<span class="tbd">уточняется</span>';
let CFG = {}, POSTS = [], shown = 12, rubric = "";

const fmtDate = iso => { try { return new Date(iso).toLocaleDateString("ru-RU", {day: "numeric", month: "long"}); } catch { return ""; } };
const postPath = (p, f) => `posts/${encodeURIComponent(p.slug)}/${f}`;
const coverOf = p => p.files?.cover ? postPath(p, p.files.cover) : (p.files?.slides?.[0] ? postPath(p, p.files.slides[0]) : "");
const cleanCaption = (p) => { let c = p.caption || ""; (p.hashtags || []).forEach(t => c = c.split(t).join("")); return c.trim(); };
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 1800); }

function contactLinks() {
  const out = [];
  const msg = encodeURIComponent("Здравствуйте! Хочу записаться на диагностику.");
  if (CFG.whatsapp) out.push({cls: "wa", label: "WhatsApp", href: `https://wa.me/${String(CFG.whatsapp).replace(/\D/g, "")}?text=${msg}`});
  if (CFG.telegram_contact) out.push({cls: "tg", label: "Написать в Telegram", href: CFG.telegram_contact.startsWith("http") ? CFG.telegram_contact : `https://t.me/${CFG.telegram_contact.replace(/^@/, "")}`});
  if (CFG.phone) out.push({cls: "call", label: `📞 ${CFG.phone}`, href: `tel:${String(CFG.phone).replace(/[^\d+]/g, "")}`});
  return out;
}
const channelUrl = () => CFG.telegram_channel ? (CFG.telegram_channel.startsWith("http") ? CFG.telegram_channel : `https://t.me/${CFG.telegram_channel.replace(/^@/, "")}`) : "";

function ctaButtons(extraCls = "") {
  const links = contactLinks();
  if (!links.length) return `<a class="btn ${extraCls}" href="#contacts" data-goto="contacts">🔧 Записаться на диагностику</a>`;
  return links.map(l => `<a class="btn ${l.cls} ${extraCls}" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
}

function renderStatic() {
  const brand = CFG.brand || "Сервисный центр";
  $("#brandName").textContent = brand; $("#footBrand").textContent = brand;
  document.title = `${brand} — ${CFG.tagline || "ремонт техники"}`;
  $("#heroCity").textContent = CFG.city ? `Сервисный центр · ${CFG.city}` : "Сервисный центр";
  $("#heroPoints").innerHTML = (CFG.hero_points || []).map(t => `<li>${esc(t)}</li>`).join("");
  $("#svcGrid").innerHTML = (CFG.services || []).map(s => `
    <div class="svc"><div class="ico">${esc(s.emoji || "🔧")}</div><h3>${esc(s.title)}</h3>
      <ul>${(s.items || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul>
      <div class="price">Стоимость: ${s.price ? `<b>${esc(s.price)}</b>` : "после диагностики"}</div></div>`).join("");
  $("#steps").innerHTML = (CFG.steps || []).map(s => `<li><b>${esc(s.title)}</b><span>${esc(s.text)}</span></li>`).join("");
  $("#priceList").innerHTML = (CFG.prices || []).map(p => `<div class="prow"><span>${esc(p.name)}</span>${p.price ? `<b>${esc(p.price)}</b>` : TBD}</div>`).join("");
  $("#faqList").innerHTML = (CFG.faq || []).map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  $("#symChips").innerHTML = (CFG.symptoms || []).map((s, i) => `<button class="chip" data-sym="${i}">${esc(s.label)}</button>`).join("");
  // contacts
  const links = contactLinks(), ch = channelUrl();
  $("#contactBtns").innerHTML = links.map(l => `<a class="btn ${l.cls} big" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")
    + (ch ? `<a class="btn ghost big" href="${esc(ch)}" target="_blank" rel="noopener">✈️ Наш Telegram-канал</a>` : "");
  const rows = [["Телефон", CFG.phone], ["WhatsApp", CFG.whatsapp], ["Telegram", CFG.telegram_contact], ["Адрес", CFG.address], ["Часы работы", CFG.hours]];
  $("#contactList").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v ? esc(v) : TBD}</dd>`).join("")
    + (CFG.map_url ? `<dt>Карта</dt><dd><a href="${esc(CFG.map_url)}" target="_blank" rel="noopener">Открыть на карте</a></dd>` : "");
  if (!links.length) { const t = $("#contactTodo"); t.hidden = false; t.textContent = "Контакты для записи скоро появятся здесь."; }
  if (ch) { $("#tgFeedBtn").href = ch; $("#mobileTg").href = ch; $("#mobileTg").textContent = "✈️ Telegram"; $("#mobileTg").target = "_blank"; }
  else { $("#tgFeedBtn").hidden = true; }
  const direct = links[0];
  if (direct) document.querySelectorAll("[data-cta]").forEach(a => { a.href = direct.href; a.target = "_blank"; a.rel = "noopener"; });
}

function card(p) {
  const img = coverOf(p);
  return `<a class="card" href="#/p/${encodeURIComponent(p.slug)}">
    <div class="img" style="background-image:url('${esc(img)}')">${p.rubric ? `<span class="badge">${esc(p.rubric)}</span>` : ""}
      ${p.files?.video ? `<span class="play">▶ ${p.duration ? Math.round(p.duration) + " с" : "видео"}</span>` : ""}</div>
    <div class="body"><h3>${esc(p.title)}</h3><span class="date">${fmtDate(p.date)}</span></div></a>`;
}

function renderFeed() {
  const rubs = [...new Map(POSTS.filter(p => p.rubric).map(p => [p.rubric_id, p.rubric])).entries()];
  $("#rubChips").innerHTML = rubs.length > 1 ? [`<button class="chip ${rubric ? "" : "active"}" data-rub="">Все</button>`]
    .concat(rubs.map(([id, n]) => `<button class="chip ${rubric === id ? "active" : ""}" data-rub="${esc(id)}">${esc(n)}</button>`)).join("") : "";
  const list = POSTS.filter(p => !rubric || p.rubric_id === rubric);
  $("#feedGrid").innerHTML = list.length ? list.slice(0, shown).map(card).join("") : `<div class="empty">Скоро здесь появятся первые ролики.</div>`;
  $("#moreBtn").hidden = list.length <= shown;
  const hero = POSTS.find(p => p.files?.video) || POSTS[0];
  if (hero) {
    $("#heroMedia").innerHTML = hero.files?.video
      ? `<video src="${postPath(hero, hero.files.video)}" poster="${esc(coverOf(hero))}" autoplay muted loop playsinline preload="metadata"></video><span class="lbl">▶ Новое в ленте</span>`
      : `<img src="${esc(coverOf(hero))}" alt=""><span class="lbl">Новое в ленте</span>`;
    $("#heroMedia").onclick = () => location.hash = `#/p/${hero.slug}`;
    $("#heroMedia").style.cursor = "pointer";
  }
}

function renderSymptom(i) {
  const s = (CFG.symptoms || [])[i]; if (!s) return;
  document.querySelectorAll("[data-sym]").forEach(b => b.classList.toggle("active", +b.dataset.sym === i));
  const q = s.q.toLowerCase();
  const hits = POSTS.filter(p => [p.title, p.hook, p.caption, ...(p.points || []), ...(p.facts || [])].join(" ").toLowerCase().includes(q)).slice(0, 4);
  $("#symResult").innerHTML = `<div class="sym-res">
    <b>${esc(s.label)}: ${hits.length ? "посмотрите полезные ролики по теме" : "ролик по этой теме скоро появится в ленте"}</b>
    ${hits.length ? `<div class="grid">${hits.map(card).join("")}</div>` : ""}
    <div class="share">${ctaButtons()}</div></div>`;
}

function renderDetail(slug) {
  const p = POSTS.find(x => x.slug === slug);
  const el = $("#detail");
  $("#page").hidden = true; el.hidden = false; window.scrollTo(0, 0);
  if (!p) { el.innerHTML = `<a class="btn ghost back" href="#/">← На главную</a><div class="empty">Пост не найден — возможно, он ещё публикуется. Обновите страницу через минуту.</div>`; return; }
  document.title = `${p.title} — ${CFG.brand || "Сервис"}`;
  const slides = (p.files?.slides || []).map(f => `<img src="${postPath(p, f)}" alt="" loading="lazy">`).join("");
  const url = location.href;
  el.innerHTML = `<a class="btn ghost back" href="#/">← Все услуги и лента</a>
  <div class="detail">
    <div>${p.files?.video ? `<video class="vplayer" src="${postPath(p, p.files.video)}" poster="${esc(coverOf(p))}" controls playsinline preload="metadata"></video>` : ""}
      ${slides ? `<div class="carousel"><div class="track">${slides}</div></div>` : ""}</div>
    <div class="d-txt"><span class="rub">${esc(p.rubric || "")}</span> <span class="date mut">${fmtDate(p.date)}</span>
      <h1>${esc(p.title)}</h1>${p.hook && p.hook !== p.title ? `<p class="hook">${esc(p.hook)}</p>` : ""}
      <p class="cap">${esc(cleanCaption(p))}</p>
      ${p.points?.length ? `<div class="box"><b>Коротко</b><ul>${p.points.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${p.facts?.length ? `<div class="box"><b>Важно знать</b><ul>${p.facts.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <div class="cta-box"><p>Похожая проблема? Покажите технику мастеру.</p><div class="share">${ctaButtons()}</div></div>
      <p class="tags">${esc((p.hashtags || []).join(" "))}</p>
      <div class="share"><button class="ghost" id="copyLink">🔗 Скопировать ссылку</button>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(p.title)}">Поделиться в Telegram</a></div>
    </div></div>`;
  $("#copyLink").onclick = () => navigator.clipboard?.writeText(url).then(() => toast("Ссылка скопирована"));
}

function route() {
  const h = location.hash;
  if (h.startsWith("#/p/")) return renderDetail(decodeURIComponent(h.slice(4)));
  $("#detail").hidden = true; $("#page").hidden = false;
  document.title = `${CFG.brand || "Сервис"} — ${CFG.tagline || "ремонт техники"}`;
  const id = h.replace(/^#\/?/, "");
  if (id) { const t = document.getElementById(id); if (t) setTimeout(() => t.scrollIntoView(), 0); }
}

document.addEventListener("click", e => {
  const r = e.target.closest("[data-rub]"); if (r) { rubric = r.dataset.rub; shown = 12; renderFeed(); }
  const s = e.target.closest("[data-sym]"); if (s) renderSymptom(+s.dataset.sym);
  const g = e.target.closest("[data-goto]"); if (g) { e.preventDefault(); if (location.hash.startsWith("#/p/")) location.hash = "#/"; setTimeout(() => document.getElementById(g.dataset.goto)?.scrollIntoView(), 50); }
});
$("#moreBtn").onclick = () => { shown += 12; renderFeed(); };
window.addEventListener("hashchange", route);

(async () => {
  try { CFG = await (await fetch("site.json", {cache: "no-cache"})).json(); } catch { CFG = {}; }
  renderStatic();
  try { const d = await (await fetch("data/posts.json", {cache: "no-cache"})).json(); POSTS = d.posts || [];
    if (d.updated) $("#updated").textContent = `Лента обновлена: ${new Date(d.updated).toLocaleString("ru-RU", {timeZone: "Asia/Almaty"})} (Алматы)`; } catch { POSTS = []; }
  renderFeed(); route();
})();
