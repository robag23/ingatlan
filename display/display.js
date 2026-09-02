
const INTERVAL = 12000;
const PHOTO_INTERVAL = 3500;
const root = document.getElementById('display');

function imageSrc(value){
  if(!value) return '../assets/images/logo-brand.jpeg';
  if(/^https?:\/\//i.test(value)) return value;
  return '../' + value.replace(/^\/+/, '');
}

function propertyImages(p){
  if(Array.isArray(p.images) && p.images.length){
    return p.images.filter(Boolean).slice(0,3);
  }
  return p.image ? [p.image] : [];
}

function badgeHtml(p){
  return p.badge ? `<div class="tag">${p.badge}</div>` : '';
}

function propertySlide(p){
  const images = propertyImages(p);
  const imgs = images.length ? images : ['assets/images/logo-brand.jpeg'];

  return `
    <section class="screen property-slide" data-property-id="${p.id}">
      <div class="photo-stage">
        <div class="photo-blur" style="background-image:url('${imageSrc(imgs[0])}')"></div>
        <div class="photo-main">
          ${imgs.map((img,i)=>`
            <img class="property-photo ${i===0?'active-photo':''}"
                 src="${imageSrc(img)}"
                 alt="${p.city} – ${p.type} – ${i+1}. kép"
                 data-photo-index="${i}"
                 onerror="this.src='../assets/images/logo-brand.jpeg'">`
          ).join('')}
        </div>
        ${imgs.length > 1 ? `
          <div class="photo-dots">
            ${imgs.map((_,i)=>`<span class="${i===0?'active-dot':''}"></span>`).join('')}
          </div>` : ''}
        ${badgeHtml(p)}
      </div>

      <div class="panel">
        <img class="display-logo" src="../assets/images/logo-brand.jpeg" alt="Sziget-Baracsi Ingatlan">

        <div class="property-info">
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
        </div>

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
        <img class="ad-logo" src="../assets/images/logo-brand.jpeg" alt="Sziget-Baracsi Ingatlan">
        <div class="ad-eyebrow">${ad.eyebrow || 'Sziget-Baracsi Ingatlan'}</div>
        <h2>${ad.title || ''}</h2>
        <p>${ad.text || ''}</p>
        ${ad.phone ? `<div class="ad-phone">☎ ${ad.phone}</div>` : ''}
        <div class="ad-footer">${ad.address || ''}${ad.address && ad.website ? '<br>' : ''}${ad.website || ''}</div>
      </div>
    </section>`;
}

function imageAd(ad){
  const src = ad.image && /^https?:\/\//i.test(ad.image) ? ad.image : (ad.image || 'ads/placeholder.jpg');
  return `<section class="screen ad-image"><img src="${src}" alt="${ad.alt || 'Sziget-Baracsi Ingatlan reklám'}"></section>`;
}
function adSlide(ad){ return ad.type === 'image' ? imageAd(ad) : textAd(ad); }

async function loadJson(url, fallback){
  try{
    const r = await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }catch(e){ console.warn(url,e); return fallback; }
}

function restartProgress(){
  const bar=root.querySelector('.progress');
  if(!bar)return;
  bar.classList.remove('run');
  void bar.offsetWidth;
  bar.classList.add('run');
}

let photoTimer=null;
function startPhotoRotation(slide){
  if(photoTimer){ clearInterval(photoTimer); photoTimer=null; }
  if(!slide || !slide.classList.contains('property-slide')) return;

  const photos=[...slide.querySelectorAll('.property-photo')];
  const dots=[...slide.querySelectorAll('.photo-dots span')];
  const blur=slide.querySelector('.photo-blur');
  if(photos.length < 2) return;

  let i=0;
  photoTimer=setInterval(()=>{
    photos[i].classList.remove('active-photo');
    if(dots[i]) dots[i].classList.remove('active-dot');
    i=(i+1)%photos.length;
    photos[i].classList.add('active-photo');
    if(dots[i]) dots[i].classList.add('active-dot');
    if(blur) blur.style.backgroundImage=`url('${photos[i].src}')`;
  },PHOTO_INTERVAL);
}

async function init(){
  const properties=await loadJson('../data/properties.json',[]);
  const ads=(await loadJson('ads.json',[])).filter(x=>x.active!==false);
  const active=properties.filter(p=>p.status==='active');

  let html='', adIndex=0;
  active.forEach((p,index)=>{
    html+=propertySlide(p);
    if((index+1)%3===0 && ads.length){
      html+=adSlide(ads[adIndex%ads.length]);
      adIndex++;
    }
  });
  if(active.length && active.length%3!==0 && ads.length) html+=adSlide(ads[adIndex%ads.length]);

  root.innerHTML=html+'<div class="progress"></div>';
  const slides=[...root.querySelectorAll('.screen')];
  if(!slides.length)return;

  let current=0;
  slides[0].classList.add('active');
  startPhotoRotation(slides[0]);
  restartProgress();

  setInterval(()=>{
    slides[current].classList.remove('active');
    current=(current+1)%slides.length;
    slides[current].classList.add('active');
    startPhotoRotation(slides[current]);
    restartProgress();
  },INTERVAL);
}
init();
