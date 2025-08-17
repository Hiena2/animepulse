
// Data store
const store = {
  get(k, fb){ try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

// Initial seed
const INITIAL = [
  { id:'op', title:'One Piece', dayISO:7, time:'09:30', timezone:'Asia/Tokyo', latestEpisode:1121, genres:['adventure','fantasy'] },
  { id:'mha-s7', title:'My Hero Academia (Season 7)', dayISO:6, time:'17:30', timezone:'Asia/Tokyo', latestEpisode:12, genres:['action','school'] },
  { id:'frieren', title:\"Frieren: Beyond Journey's End\", dayISO:5, time:'23:00', timezone:'Asia/Tokyo', latestEpisode:28, genres:['fantasy','adventure'] }
];

const GENRES = ['action','adventure','fantasy','supernatural','romance','slice of life','school','comedy','sports','mecha','sci-fi','mystery','psychological','horror'];

let settings = store.get('ap:settings', { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, defaultReminderMinutes:15, vapidPublicKey:'' });
let anime = store.get('ap:anime', INITIAL);
let favorites = new Set(store.get('ap:favorites', []));
let news = store.get('ap:news', [
  { id:'n1', date:new Date(Date.now()-2*864e5).toISOString(), title:'Frieren S2 Announced', body:'Season 2 confirmed for 2026.', tags:[\"Frieren: Beyond Journey's End\"], url:'' }
]);
let liked = new Set(store.get('ap:liked', ['action','fantasy']));

// Tabs
const releasesBtn = document.getElementById('tabReleases');
const newsBtn = document.getElementById('tabNews');
const aiBtn = document.getElementById('tabAI');
const pageReleases = document.getElementById('pageReleases');
const pageNews = document.getElementById('pageNews');
const pageAI = document.getElementById('pageAI');

function setTab(key){
  for (const btn of [releasesBtn, newsBtn, aiBtn]) btn.classList.remove('active');
  for (const sec of [pageReleases, pageNews, pageAI]) sec.classList.add('hidden');
  if (key==='releases'){ releasesBtn.classList.add('active'); pageReleases.classList.remove('hidden'); }
  if (key==='news'){ newsBtn.classList.add('active'); pageNews.classList.remove('hidden'); }
  if (key==='ai'){ aiBtn.classList.add('active'); pageAI.classList.remove('hidden'); }
}
releasesBtn.onclick = ()=> setTab('releases');
newsBtn.onclick = ()=> setTab('news');
aiBtn.onclick = ()=> setTab('ai');

// Settings
const settingsPanel = document.getElementById('settingsPanel');
document.getElementById('openSettings').onclick = ()=> { 
  document.getElementById('setMins').value = settings.defaultReminderMinutes;
  document.getElementById('setTZ').value = settings.timezone;
  document.getElementById('setVapid').value = settings.vapidPublicKey || '';
  settingsPanel.classList.remove('hidden');
};
document.getElementById('closeSettings').onclick = ()=> {
  settings.defaultReminderMinutes = Number(document.getElementById('setMins').value)||15;
  settings.timezone = document.getElementById('setTZ').value;
  settings.vapidPublicKey = document.getElementById('setVapid').value.trim();
  store.set('ap:settings', settings);
  settingsPanel.classList.add('hidden');
  render();
};

document.getElementById('btnPush').onclick = async ()=> {
  const vapid = document.getElementById('setVapid').value.trim();
  const msg = document.getElementById('pushMsg');
  if (!vapid){ msg.textContent = 'Enter VAPID public key first.'; return; }
  try {
    const reg = await ensureSW();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) });
    await fetch('/api/push/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(sub) });
    msg.textContent = 'Push enabled ✔';
  } catch(e){ msg.textContent = 'Push failed: ' + e.message; }
};

// Utilities
const DateTime = luxon.DateTime;
function parseTimeToNext(a){
  const zone = a.timezone || 'Asia/Tokyo';
  if (a.nextUnix && a.nextUnix*1000 > Date.now()) {
    const nextInZone = DateTime.fromSeconds(a.nextUnix).setZone(zone);
    const nextLocal = nextInZone.setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return { nextInZone, nextLocal };
  }
  const [hh,mm] = (a.time||'00:00').split(':').map(Number);
  const nowInZone = DateTime.now().setZone(zone);
  let cand = nowInZone.set({ weekday: a.dayISO||5, hour: hh, minute:mm, second:0, millisecond:0 });
  if (cand <= nowInZone.minus({minutes:1})) cand = cand.plus({ weeks:1 });
  return { nextInZone: cand, nextLocal: cand.setZone(Intl.DateTimeFormat().resolvedOptions().timeZone) };
}
function fmtCountdown(nextLocal){
  const diff = nextLocal.diffNow(['days','hours','minutes']).toObject();
  const d = Math.max(0, Math.floor(diff.days||0));
  const h = Math.max(0, Math.floor(diff.hours||0));
  const m = Math.max(0, Math.ceil(diff.minutes||0));
  if (d>0) return `${d}d ${h}h ${m}m`;
  if (h>0) return `${h}h ${m}m`;
  return `${m}m`;
}
async function ensureSW(){
  if (!('serviceWorker' in navigator)) throw new Error('No SW');
  return await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('sw.js');
}
async function notify(title, body){
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted'){
    const res = await Notification.requestPermission();
    if (res !== 'granted') return false;
  }
  const reg = await ensureSW();
  if (reg && reg.showNotification) { await reg.showNotification(title, { body }); return true; }
  new Notification(title, { body }); return true;
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
function makeICS(a, nextLocal){
  const dtStartUTC = nextLocal.toUTC();
  const dtEndUTC = dtStartUTC.plus({ minutes: 30 });
  const fmt = (dt)=> dt.toFormat(\"yyyyLLdd'T'HHmmss'Z'\");
  const ics = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AnimePulse//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:${a.id}-${Date.now()}@animepulse`,
    `DTSTAMP:${fmt(luxon.DateTime.utc())}`,
    `DTSTART:${fmt(dtStartUTC)}`,
    `DTEND:${fmt(dtEndUTC)}`,
    `SUMMARY:${a.title} — New Episode`,
    `DESCRIPTION:New episode reminder for ${a.title}.`, 'END:VEVENT','END:VCALENDAR'
  ].join('\\r\\n');
  return URL.createObjectURL(new Blob([ics], { type:'text/calendar' }));
}

// AniList
async function anilistQuery(query, variables={}){
  const res = await fetch('https://graphql.anilist.co', {
    method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors && data.errors.length) throw new Error(data.errors[0].message);
  return data.data;
}
async function anilistSearchTitle(title){
  const q = `query ($search: String){ Page(perPage:5){ media(search:$search, type:ANIME){ id title{ romaji english native } nextAiringEpisode{ episode airingAt } } } }`;
  const d = await anilistQuery(q, { search:title });
  return (d.Page && d.Page.media) || [];
}
async function anilistNext(id){
  const q = `query($id:Int){ Media(id:$id,type:ANIME){ id title{romaji} nextAiringEpisode{ episode airingAt } } }`;
  const d = await anilistQuery(q, { id });
  return d.Media;
}

// Releases UI
const animeGrid = document.getElementById('animeGrid');
const searchBox = document.getElementById('searchBox');
const addAnimeToggle = document.getElementById('addAnimeToggle');
const addAnimeForm = document.getElementById('addAnimeForm');

addAnimeToggle.onclick = ()=> addAnimeForm.classList.toggle('hidden');
document.getElementById('saveNewAnime').onclick = ()=> {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) return;
  const a = {
    id: 'custom-'+Date.now(),
    title, dayISO: Number(document.getElementById('newDay').value)||5,
    time: document.getElementById('newTime').value || '21:00',
    timezone: document.getElementById('newTZ').value||'Asia/Tokyo',
    latestEpisode: 0,
    genres: (document.getElementById('newGenres').value||'').split(',').map(s=>s.trim()).filter(Boolean)
  };
  anime = [a, ...anime];
  store.set('ap:anime', anime);
  addAnimeForm.classList.add('hidden');
  render();
};

function animeCard(a){
  const { nextLocal, nextInZone } = parseTimeToNext(a);
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="row" style="justify-content: space-between">
      <div>
        <div class="title">${a.title}</div>
        <div class="small muted" style="margin-top:4px">
          <span>${nextLocal.toFormat('EEE HH:mm')} (you)</span> ·
          <span>${nextInZone.toFormat('EEE HH:mm')} (${a.timezone})</span>
        </div>
      </div>
      <div class="row">
        <button class="btn secondary small fav">${ favorites.has(a.id) ? 'Unfollow' : 'Follow' }</button>
        <button class="btn secondary small edit">Edit</button>
        <button class="btn warn small del">Del</button>
      </div>
    </div>
    <div class="row" style="justify-content: space-between; margin-top:8px">
      <div class="small">Next in <span class="badge">${fmtCountdown(nextLocal)}</span></div>
      <div class="small muted">Ep. <b>${a.latestEpisode}</b> aired</div>
    </div>
    <div class="row-wrap" style="margin-top:6px">${(a.genres||[]).map(g=>`<span class="badge">${g}</span>`).join('')}</div>
    <div class="row" style="justify-content: space-between; margin-top:8px">
      <div class="row small">
        <button class="btn secondary small remind">Test Reminder</button>
        <a class="btn secondary small ics" download="${a.title.replace(/[^a-z0-9]+/gi,'_')}_next.ics">Add to calendar</a>
      </div>
      <div class="row small">
        <input class="alink small" placeholder="AniList ID" value="${a.anilistId||''}" style="width:120px">
        <button class="btn secondary small find">Find by title</button>
        <button class="btn small sync">Link & Sync</button>
      </div>
    </div>
  `;
  // actions
  card.querySelector('.fav').onclick = ()=> {
    if (favorites.has(a.id)) favorites.delete(a.id); else favorites.add(a.id);
    store.set('ap:favorites', Array.from(favorites)); render();
  };
  card.querySelector('.del').onclick = ()=> {
    if (!confirm('Delete this anime?')) return;
    anime = anime.filter(x=>x.id!==a.id);
    favorites.delete(a.id);
    store.set('ap:anime', anime); store.set('ap:favorites', Array.from(favorites));
    render();
  };
  card.querySelector('.edit').onclick = ()=> {
    const day = prompt('Day of week (1..7):', a.dayISO); if (day===null) return;
    const time = prompt('Time HH:MM:', a.time); if (time===null) return;
    const tz = prompt('Timezone:', a.timezone); if (tz===null) return;
    const ep = prompt('Latest episode aired:', a.latestEpisode); if (ep===null) return;
    a.dayISO = Number(day)||a.dayISO; a.time = time||a.time; a.timezone = tz||a.timezone; a.latestEpisode = Number(ep)||a.latestEpisode;
    store.set('ap:anime', anime); render();
  };
  card.querySelector('.remind').onclick = ()=> notify('New episode: '+a.title, `Airing ${nextLocal.toFormat('EEE, dd LLL HH:mm')} (your time)`);
  const ics = card.querySelector('.ics'); ics.href = makeICS(a, nextLocal);
  const alink = card.querySelector('.alink');
  card.querySelector('.find').onclick = async ()=> {
    try {
      const hits = await anilistSearchTitle(a.title);
      if (!hits.length) { alert('No match on AniList'); return; }
      alink.value = hits[0].id;
    } catch(e){ alert('Search failed: ' + e.message); }
  };
  card.querySelector('.sync').onclick = async ()=> {
    try {
      const id = Number(alink.value);
      if (!id) { alert('Enter AniList ID'); return; }
      const m = await anilistNext(id);
      const next = m && m.nextAiringEpisode;
      a.anilistId = id;
      a.nextUnix = next ? next.airingAt : null;
      if (next && typeof next.episode === 'number') a.latestEpisode = Math.max(0, next.episode - 1);
      store.set('ap:anime', anime); render();
    } catch(e){ alert('Sync failed: ' + e.message); }
  };
  return card;
}

function render(){
  // Releases
  const q = (searchBox.value||'').toLowerCase();
  animeGrid.innerHTML = '';
  anime.filter(a => (a.title+' '+(a.genres||[]).join(' ')).toLowerCase().includes(q))
       .forEach(a=> animeGrid.appendChild(animeCard(a)));

  // News
  const newsList = document.getElementById('newsList');
  newsList.innerHTML = '';
  news.sort((a,b)=> new Date(b.date) - new Date(a.date)).forEach(n => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="row" style="justify-content: space-between">
        <div>
          <div class="title">${n.title}</div>
          <div class="small muted" style="margin-top:4px">${new Date(n.date).toLocaleDateString()}</div>
        </div>
        <div class="row-wrap">${(n.tags||[]).map(t=>`<span class="badge">${t}</span>`).join('')}</div>
      </div>
      <div class="small" style="margin-top:6px">${n.body}</div>
      ${n.link? `<div class="small" style="margin-top:6px"><a class="link" href="${n.link}" target="_blank">Read more</a></div>`:''}
    `;
    newsList.appendChild(el);
  });

  // AI tastes
  const gp = document.getElementById('genrePills');
  gp.innerHTML = '';
  GENRES.forEach(g => {
    const b = document.createElement('button');
    b.textContent = g;
    b.className = 'badge';
    if (liked.has(g)) b.style.borderColor = '#38bdf8';
    b.onclick = ()=> { liked.has(g)? liked.delete(g): liked.add(g); store.set('ap:liked', Array.from(liked)); render(); };
    gp.appendChild(b);
  });

  // AI matches
  const tokens = (document.getElementById('aiSearch').value||'').toLowerCase().split(/\s+/).filter(Boolean);
  const scored = anime.map(a=> ({ a, s: scoreAnime(a, tokens, liked) })).sort((x,y)=> y.s - x.s).slice(0,10);
  const aiMatches = document.getElementById('aiMatches');
  aiMatches.innerHTML = '';
  scored.forEach(({a,s}) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<div class="row" style="justify-content: space-between">
      <div><div class="title">${a.title}</div><div class="small muted">Match score: ${s}</div></div>
      <div class="row-wrap">${(a.genres||[]).map(g=>`<span class="badge">${g}</span>`).join('')}</div>
    </div>`;
    aiMatches.appendChild(el);
  });
}

function scoreAnime(a, queryTokens=[], likedGenres=new Set()){
  const titleTokens = (a.title||'').toLowerCase().split(/\s+/);
  let score = 0;
  for (const t of queryTokens) if (titleTokens.includes(t)) score += 3;
  for (const g of (a.genres||[])) if (likedGenres.has(g)) score += 2;
  const nextLocal = parseTimeToNext(a).nextLocal;
  const minutes = nextLocal.diffNow('minutes').minutes;
  if (minutes < 60*24*2) score += 1;
  return score;
}

// Search and News handlers
searchBox.oninput = render;
document.getElementById('publishNews').onclick = ()=> {
  const title = document.getElementById('newsTitle').value.trim();
  if (!title) return;
  const body = document.getElementById('newsBody').value.trim();
  const date = document.getElementById('newsDate').value || new Date().toISOString().slice(0,10);
  const tag = document.getElementById('newsTag').value.trim();
  news = [{ id:'n-'+Date.now(), title, body, date: new Date(date).toISOString(), tags: tag?[tag]:[], url:'' }, ...news];
  store.set('ap:news', news);
  document.getElementById('newsTitle').value = ''; document.getElementById('newsBody').value=''; document.getElementById('newsTag').value='';
  render();
};

// Backup/Restore
document.getElementById('btnExport').onclick = ()=> {
  const data = { anime, favorites: Array.from(favorites), news, settings, liked: Array.from(liked) };
  document.getElementById('brJson').value = JSON.stringify(data, null, 2);
};
document.getElementById('btnImport').onclick = ()=> {
  try {
    const obj = JSON.parse(document.getElementById('brJson').value);
    if (obj.anime) anime = obj.anime;
    if (obj.favorites) favorites = new Set(obj.favorites);
    if (obj.news) news = obj.news;
    if (obj.settings) settings = obj.settings;
    if (obj.liked) liked = new Set(obj.liked);
    store.set('ap:anime', anime);
    store.set('ap:favorites', Array.from(favorites));
    store.set('ap:news', news);
    store.set('ap:settings', settings);
    store.set('ap:liked', Array.from(liked));
    render();
  } catch { alert('Invalid JSON'); }
};

// AI offline suggestion
document.getElementById('askAI').onclick = ()=> {
  const prompt = document.getElementById('aiPrompt').value||'';
  const picks = anime.filter(a => Array.from(liked).some(g => (a.genres||[]).includes(g))).slice(0,3).map(a=> '- '+a.title).join('\\n');
  document.getElementById('aiOut').textContent = `Based on your tastes (${Array.from(liked).join(', ')}), try:\\n${picks || '- Add more anime first'}`;
};
document.getElementById('aiSearch').oninput = render;

// Default dates/values
document.getElementById('newsDate').valueAsDate = new Date();

// Initial render
render();
setTab('releases');
