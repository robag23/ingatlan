const SLIDE_DURATION = 7000;   // property/ad stays visible for 7 seconds
const PHOTO_INTERVAL = 3200;   // property photos rotate more calmly
const root = document.getElementById('display');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const slideEffects = ['fade','slide-left','slide-right','slide-up','zoom','tilt','wipe'];
const photoEffects = ['fade','slide-left','slide-right','zoom','soft-blur','wipe'];
let slideEffectIndex = 0;
let photoEffectIndex = 0;

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

function transitionFrames(effect, entering){
  const neutral = {opacity:1, transform:'none', clipPath:'inset(0 0 0 0)', filter:'blur(0px)'};

  const incoming = {
    fade:          {opacity:0},
    'slide-left':  {opacity:0, transform:'translateX(9%)'},
    'slide-right': {opacity:0, transform:'translateX(-9%)'},
    'slide-up':    {opacity:0, transform:'translateY(8%)'},
    zoom:          {opacity:0, transform:'scale(.94)'},
    tilt:          {opacity:0, transform:'perspective(1200px) rotateY(7deg) scale(.985)'},
    wipe:          {opacity:1, clipPath:'inset(0 100% 0 0)'}
  }[effect] || {opacity:0};

  const outgoing = {
    fade:          {opacity:0},
    'slide-left':  {opacity:0, transform:'translateX(-6%)'},
    'slide-right': {opacity:0, transform:'translateX(6%)'},
    'slide-up':    {opacity:0, transform:'translateY(-5%)'},
    zoom:          {opacity:0, transform:'scale(1.025)'},
    tilt:          {opacity:0, transform:'perspective(1200px) rotateY(-5deg) scale(.99)'},
    wipe:          {opacity:0, clipPath:'inset(0 0 0 100%)'}
  }[effect] || {opacity:0};

  return entering ? [incoming, neutral] : [neutral, outgoing];
}

function photoFrames(effect, entering){
  const neutral = {opacity:1, transform:'none', clipPath:'inset(0 0 0 0)', filter:'blur(0px)'};
  const incoming = {
    fade:          {opacity:0},
    'slide-left':  {opacity:0, transform:'translateX(7%)'},
    'slide-right': {opacity:0, transform:'translateX(-7%)'},
    zoom:          {opacity:0, transform:'scale(1.06)'},
    'soft-blur':   {opacity:0, filter:'blur(10px)', transform:'scale(1.025)'},
    wipe:          {opacity:1, clipPath:'inset(0 100% 0 0)'}
  }[effect] || {opacity:0};
  const outgoing = {
    fade:          {opacity:0},
    'slide-left':  {opacity:0, transform:'translateX(-5%)'},
    'slide-right': {opacity:0, transform:'translateX(5%)'},
    zoom:          {opacity:0, transform:'scale(.97)'},
    'soft-blur':   {opacity:0, filter:'blur(7px)', transform:'scale(.99)'},
    wipe:          {opacity:0, clipPath:'inset(0 0 0 100%)'}
  }[effect] || {opacity:0};

  return entering ? [incoming, neutral] : [neutral, outgoing];
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
    const oldPhoto = photos[i];
    if(dots[i]) dots[i].classList.remove('active-dot');

    i = (i + 1) % photos.length;
    const newPhoto = photos[i];
    const effect = photoEffects[photoEffectIndex++ % photoEffects.length];

    newPhoto.classList.add('active-photo');
    newPhoto.style.zIndex = '4';
    oldPhoto.style.zIndex = '3';

    if(reduceMotion){
      oldPhoto.classList.remove('active-photo');
      oldPhoto.style.zIndex = '';
      newPhoto.style.zIndex = '';
    }else{
      oldPhoto.animate(photoFrames(effect,false), {
        duration:520, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'
      });
      const anim = newPhoto.animate(photoFrames(effect,true), {
        duration:900, easing:'cubic-bezier(.16,1,.3,1)', fill:'both'
      });
      anim.finished.finally(() => {
        oldPhoto.classList.remove('active-photo');
        oldPhoto.getAnimations().forEach(a=>a.cancel());
        newPhoto.getAnimations().forEach(a=>a.cancel());
        oldPhoto.style.zIndex = '';
        newPhoto.style.zIndex = '';
      });
    }

    if(dots[i]) dots[i].classList.add('active-dot');
    if(blur){
      blur.style.backgroundImage = `url('${newPhoto.src}')`;
      if(!reduceMotion){
        blur.animate([{opacity:.55},{opacity:1}], {duration:700,easing:'ease-out'});
      }
    }
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
  slides[0].classList.add('active');
  startPhotoRotation(slides[0]);
  restartProgress();

  function show(nextIndex){
    const oldSlide = slides[current];
    const newSlide = slides[nextIndex];

    if(oldSlide === newSlide) return;

    const effect = slideEffects[slideEffectIndex++ % slideEffects.length];

    newSlide.classList.add('active');
    newSlide.style.zIndex = '4';
    oldSlide.style.zIndex = '3';

    if(reduceMotion){
      oldSlide.classList.remove('active');
      oldSlide.style.zIndex = '';
      newSlide.style.zIndex = '';
    }else{
      oldSlide.animate(transitionFrames(effect,false), {
        duration:650,
        easing:'cubic-bezier(.4,0,.2,1)',
        fill:'forwards'
      });

      const incoming = newSlide.animate(transitionFrames(effect,true), {
        duration:1100,
        easing:'cubic-bezier(.16,1,.3,1)',
        fill:'both'
      });

      incoming.finished.finally(() => {
        oldSlide.classList.remove('active');
        oldSlide.getAnimations().forEach(a=>a.cancel());
        newSlide.getAnimations().forEach(a=>a.cancel());
        oldSlide.style.zIndex = '';
        newSlide.style.zIndex = '';
      });
    }

    current = nextIndex;
    startPhotoRotation(newSlide);
    restartProgress();
  }

  setInterval(() => {
    show((current + 1) % slides.length);
  }, SLIDE_DURATION);
}

init();
