
const SLIDE_DURATION = 7000;   // each property/ad stays for 7 seconds
const PHOTO_INTERVAL = 2200;   // extra property photos rotate inside the 7 sec slide
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

function propertySlide(p){
  const imgs = propertyImages(p);
  const images = imgs.length ? imgs : ['assets/images/logo-brand.jpeg'];

  return `
    <section class="screen property-slide">
      <div class="photo-stage">
        <div class="photo-blur" style="background-image:url('${imageSrc(images[0])}')"></div>
        <div class="photo-main">
          ${images.map((img,i)=>`
            <img class="property-photo ${i===0?'active-photo':''}"
                 src="${imageSrc(img)}"
                 alt="${p.city} – ${p.type}"
                 onerror="this.src='../assets/images/logo-brand.jpeg'">`
          ).join('')}
        </div>
        ${images.length>1 ? `
          <div class="photo-dots">
            ${images.map((_,i)=>`<span class="${i===0?'active-dot':''}"></span>`).join('')}
          </div>` : ''}
        ${p.badge ? `<div class="tag">${p.badge}</div>` : ''}
      </div>

      <div class="panel">
        <img class="display-logo" src="../assets/images/logo-brand.jpeg" alt="Sziget-Baracsi Ingatlan">
        <div class="property-info">
          <div class="location">${p.city}${p.location ? ' • '+p.location : ''}</div>
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
          7900 Szigetvár, József A. utca 35.
        </div>
      </div>
    </section>`;
}

function adSlide(ad){
  const src = ad.image && /^https?:\/\//i.test(ad.image)
    ? ad.image
    : (ad.image || 'ads/placeholder.png');

  return `
    <section class="screen ad-image">
      <img src="${src}" alt="${ad.alt || 'Sziget-Baracsi Ingatlan reklám'}">
    </section>`;
}

async function loadJson(url, fallback){
  try{
    const r = await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }catch(e){
    console.warn(url,e);
    return fallback;
  }
}

let photoTimer = null;

function startPhotoRotation(slide){
  if(photoTimer){
    clearInterval(photoTimer);
    photoTimer = null;
  }

  if(!slide || !slide.classList.contains('property-slide')) return;

  const photos = [...slide.querySelectorAll('.property-photo')];
  const dots = [...slide.querySelectorAll('.photo-dots span')];
  const blur = slide.querySelector('.photo-blur');

  if(photos.length < 2) return;

  let i = 0;
  photoTimer = setInterval(() => {
    photos[i].classList.remove('active-photo');
    if(dots[i]) dots[i].classList.remove('active-dot');

    i = (i + 1) % photos.length;

    photos[i].classList.add('active-photo');
    if(dots[i]) dots[i].classList.add('active-dot');
    if(blur) blur.style.backgroundImage = `url('${photos[i].src}')`;
  }, PHOTO_INTERVAL);
}

function restartProgress(){
  const bar = root.querySelector('.progress');
  if(!bar) return;
  bar.style.animation = 'none';
  void bar.offsetWidth;
  bar.style.animation = `progress ${SLIDE_DURATION}ms linear forwards`;
}

async function init(){
  const properties = await loadJson('../data/properties.json',[]);
  const ads = (await loadJson('ads.json',[])).filter(x => x.active !== false);
  const active = properties.filter(p => p.status === 'active');

  const sequence = [];
  let adIndex = 0;

  active.forEach((p,index) => {
    sequence.push({type:'property',data:p});

    // 3 properties -> 1 ad
    if((index+1)%3===0 && ads.length){
      sequence.push({type:'ad',data:ads[adIndex % ads.length]});
      adIndex++;
    }
  });

  if(active.length % 3 !== 0 && ads.length){
    sequence.push({type:'ad',data:ads[adIndex % ads.length]});
  }

  root.innerHTML = sequence.map(item =>
    item.type === 'property' ? propertySlide(item.data) : adSlide(item.data)
  ).join('') + '<div class="progress"></div>';

  const slides = [...root.querySelectorAll('.screen')];
  if(!slides.length) return;

  let current = 0;

  function show(i){
    slides.forEach((s,n)=>s.classList.toggle('active',n===i));
    startPhotoRotation(slides[i]);
    restartProgress();
  }

  show(current);

  setInterval(() => {
    current = (current + 1) % slides.length;
    show(current);
  }, SLIDE_DURATION);
}

init();
