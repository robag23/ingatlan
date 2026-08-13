
const INTERVAL = 10000;
const root = document.getElementById('display');

function imageSrc(value){
  if(!value) return '../assets/images/logo-brand.jpeg';

  // Absolute ingatlan.com / CDN image URL -> use directly.
  if(/^https?:\/\//i.test(value)) return value;

  // Existing project path from properties.json.
  return '../' + value.replace(/^\/+/, '');
}

function badgeHtml(p){
  return p.badge ? `<div class="tag">${p.badge}</div>` : '';
}

function propertySlide(p){
  return `
    <section class="screen property-slide">
      <div class="photo">
        <img src="${imageSrc(p.image)}" alt="${p.city} – ${p.type}"
             onerror="this.src='../assets/images/logo-brand.jpeg'">
        ${badgeHtml(p)}
      </div>

      <div class="panel">
        <div class="location">${p.city}${p.location ? ' • ' + p.location : ''}</div>
        <h1>${p.type}</h1>

        <div class="meta">
          ${p.area ? `<span>${p.area}</span>` : ''}
          ${p.rooms && p.rooms !== '—' ? `<span>${p.rooms}</span>` : ''}
          ${p.plot ? `<span>${p.plot}</span>` : ''}
        </div>

        ${p.oldPrice ? `<div class="old">${p.oldPrice}</div>` : ''}
        <div class="price">${p.price}</div>
        <p class="desc">${p.description || ''}</p>

        <div class="contact">
          <strong>☎ +36 70 319 6582</strong>
          7900 Szigetvár, József A. utca 35.<br>
          www.szigetvaringatlan.hu
        </div>
      </div>
    </section>`;
}

function textAd(ad){
  return `
    <section class="screen ad-text">
      <div class="ad-inner">
        <div class="ad-eyebrow">${ad.eyebrow || 'Sziget-Baracsi Ingatlan'}</div>
        <h2>${ad.title || ''}</h2>
        <p>${ad.text || ''}</p>
        ${ad.phone ? `<div class="ad-phone">☎ ${ad.phone}</div>` : ''}
        <div class="ad-footer">
          ${ad.address || ''}${ad.address && ad.website ? '<br>' : ''}${ad.website || ''}
        </div>
      </div>
    </section>`;
}

function imageAd(ad){
  const src = ad.image && /^https?:\/\//i.test(ad.image)
    ? ad.image
    : (ad.image ? ad.image : 'ads/placeholder.jpg');

  return `
    <section class="screen ad-image">
      <img src="${src}" alt="${ad.alt || 'Sziget-Baracsi Ingatlan reklám'}">
    </section>`;
}

function adSlide(ad){
  return ad.type === 'image' ? imageAd(ad) : textAd(ad);
}

async function loadJson(url, fallback){
  try{
    const r = await fetch(url, {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }catch(e){
    console.warn('Nem sikerült betölteni:', url, e);
    return fallback;
  }
}

function restartProgress(){
  const bar = root.querySelector('.progress');
  if(!bar) return;
  bar.classList.remove('run');
  void bar.offsetWidth;
  bar.classList.add('run');
}

async function init(){
  const properties = await loadJson('../data/properties.json', []);
  const ads = (await loadJson('ads.json', [])).filter(x => x.active !== false);
  const active = properties.filter(p => p.status === 'active');

  let html = '';
  let adIndex = 0;

  // 3 ingatlanonként egy saját reklám.
  active.forEach((p, index) => {
    html += propertySlide(p);

    if((index + 1) % 3 === 0 && ads.length){
      html += adSlide(ads[adIndex % ads.length]);
      adIndex++;
    }
  });

  // Ha maradt a végén ingatlan, tegyünk utána is egy reklámot.
  if(active.length && active.length % 3 !== 0 && ads.length){
    html += adSlide(ads[adIndex % ads.length]);
  }

  if(!html){
    html = `
      <section class="screen ad-text active">
        <div class="ad-inner">
          <div class="ad-eyebrow">Sziget-Baracsi Ingatlan</div>
          <h2>Aktuális kínálatunk hamarosan frissül.</h2>
          <div class="ad-phone">☎ +36 70 319 6582</div>
        </div>
      </section>`;
  }

  root.innerHTML = html + '<div class="progress"></div>';

  const slides = [...root.querySelectorAll('.screen')];
  if(!slides.length) return;

  let current = 0;
  slides[0].classList.add('active');
  restartProgress();

  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
    restartProgress();
  }, INTERVAL);
}

init();
