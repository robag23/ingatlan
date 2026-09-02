
const PROPERTY_DURATION = 10000;
const INFO_DURATION = 15000;
const PROMO_DURATION = 15000;
const PHOTO_INTERVAL = 4000;
const root = document.getElementById('display');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const slideEffects = ['fade','slide-left','slide-right','slide-up','zoom','tilt','wipe'];
const photoEffects = ['fade','slide-left','slide-right','zoom','soft-blur','wipe'];
let slideEffectIndex = 0, photoEffectIndex = 0;
let liveWeather = {temp:null, code:null, text:'', max:null, min:null, wind:null, rain:null};
let liveRate = null, rateDate = null;
let todaysNames = [];
let upcomingEvents = [];
let holidayToday = null;

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function imageSrc(value){
  if(!value) return '../assets/images/logo-brand-new.png';
  if(/^https?:\/\//i.test(value)) return value;
  return '../' + value.replace(/^\/+/, '');
}
function propertyImages(p){
  if(Array.isArray(p.images)&&p.images.length) return p.images.filter(Boolean).slice(0,3);
  return p.image?[p.image]:[];
}
function propertySlide(p){
  const images=propertyImages(p); const imgs=images.length?images:['assets/images/logo-brand.jpeg'];
  return `<section class="screen property-slide">
    <div class="photo-stage">
      <div class="photo-blur" style="background-image:url('${imageSrc(imgs[0])}')"></div>
      <div class="photo-main">${imgs.map((img,i)=>`<img class="property-photo ${i===0?'active-photo':''}" src="${imageSrc(img)}" alt="${esc(p.city)} – ${esc(p.type)}" onerror="this.src='../assets/images/logo-brand-new.png'">`).join('')}</div>
      ${imgs.length>1?`<div class="photo-dots">${imgs.map((_,i)=>`<span class="${i===0?'active-dot':''}"></span>`).join('')}</div>`:''}
      ${p.badge?`<div class="tag">${esc(p.badge)}</div>`:''}
    </div>
    <div class="panel">
      <img class="display-logo" src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
      <div class="property-info">
        <div class="location">${esc(p.city)}${p.location?' • '+esc(p.location):''}</div>
        <h1>${esc(p.type)}</h1>
        <div class="meta">${p.area?`<span>${esc(p.area)}</span>`:''}${p.rooms&&p.rooms!=='—'?`<span>${esc(p.rooms)}</span>`:''}${p.plot?`<span>${esc(p.plot)}</span>`:''}</div>
        ${p.oldPrice?`<div class="old">${esc(p.oldPrice)}</div>`:''}<div class="price">${esc(p.price)}</div>
        <p class="desc">${esc(p.description||'')}</p>
      </div>
      <div class="contact"><strong>☎ +36 70 319 6582</strong><span>✉ baracsievike@gmail.com</span><span>🌐 szigetvarhomes.com</span><span>📍 7900 Szigetvár, József A. utca 35.</span></div>
    </div>
  </section>`;
}
function adSlide(ad){
  const src=ad.image&&/^https?:\/\//i.test(ad.image)?ad.image:(ad.image||'ads/placeholder.png');
  return `<section class="screen ad-image"><img src="${src}" alt="${esc(ad.alt||'Sziget-Baracsi Ingatlan reklám')}"></section>`;
}

function seasonName(){
  const m=new Date().getMonth()+1;
  return (m>=3&&m<=5)?'spring':(m>=6&&m<=8)?'summer':(m>=9&&m<=11)?'autumn':'winter';
}

function infoSlide(kind, eyebrow, title, body, extra=''){
  return `<section class="screen info-slide info-${kind}" data-duration="${INFO_DURATION}">
    <div class="info-bg"></div><div class="info-shade"></div>
    <div class="info-card">
      <div class="info-eyebrow">${eyebrow}</div>
      <h1>${title}</h1>${body}<div class="info-extra">${extra}</div>
      <div class="info-brand">
        <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
        <div><strong>SZIGET-BARACSI INGATLAN</strong><span>•</span> Otthon. Érték. Bizalom.<br>
        <small>☎ +36 70 319 6582 &nbsp; • &nbsp; ✉ baracsievike@gmail.com &nbsp; • &nbsp; 🌐 szigetvarhomes.com &nbsp; • &nbsp; 📍 7900 Szigetvár, József A. utca 35.</small></div>
      </div>
    </div>
  </section>`;
}
function weatherIcon(code){
  if(code===0) return '☀️'; if([1,2].includes(code)) return '🌤️'; if(code===3) return '☁️';
  if([45,48].includes(code)) return '🌫️'; if([51,53,55,61,63,65,80,81,82].includes(code)) return '🌧️';
  if([71,73,75,77,85,86].includes(code)) return '❄️'; if([95,96,99].includes(code)) return '⛈️'; return '🌤️';
}
function weatherText(code){
  if(code===0)return'Napos'; if([1,2].includes(code))return'Részben felhős'; if(code===3)return'Borult';
  if([45,48].includes(code))return'Ködös'; if([51,53,55].includes(code))return'Szitálás';
  if([61,63,65,80,81,82].includes(code))return'Esős'; if([71,73,75,77,85,86].includes(code))return'Havas';
  if([95,96,99].includes(code))return'Zivataros'; return'Változó idő';
}
async function loadJson(url,fallback){
  try{const r=await fetch(url,{cache:'no-store'}); if(!r.ok)throw new Error(r.status); return await r.json();}catch(e){console.warn(url,e);return fallback;}
}
async function loadLiveData(){
  const weatherUrl='https://api.open-meteo.com/v1/forecast?latitude=46.0487&longitude=17.8055&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBudapest&forecast_days=1';
  try{
    const w=await loadJson(weatherUrl,null);
    if(w){liveWeather={temp:Math.round(w.current.temperature_2m),code:w.current.weather_code,text:weatherText(w.current.weather_code),wind:Math.round(w.current.wind_speed_10m),max:Math.round(w.daily.temperature_2m_max[0]),min:Math.round(w.daily.temperature_2m_min[0]),rain:Math.round(w.daily.precipitation_probability_max[0]||0)};}
  }catch(e){}
  try{
    const fx=await loadJson('https://api.frankfurter.dev/v2/rate/EUR/HUF?providers=MNB',null);
    if(fx){liveRate=Number(fx.rate);rateDate=fx.date;}
  }catch(e){}
  const now=new Date(), m=String(now.getMonth()+1), d=String(now.getDate());
  try{
    const names=await loadJson('https://raw.githubusercontent.com/froccsos/nevnapok-json/refs/heads/main/nevnapok.json',null);
    if(names&&names[m]&&names[m][d]) todaysNames=(names[m][d].main||[]).slice(0,4);
  }catch(e){}
  const ev=await loadJson('local-events.json',{events:[]});
  upcomingEvents=(ev.events||[]).filter(x=>new Date((x.end||x.start)+'T23:59:59')>=new Date()).slice(0,3);
  const hs=await loadJson('holidays.json',[]);
  holidayToday=findHoliday(hs);
}
function findHoliday(list){
  const now=new Date(); now.setHours(12,0,0,0);
  for(const h of list){
    let target=new Date(now.getFullYear(),h.month-1,h.day,12);
    let start=new Date(target); start.setDate(start.getDate()-(h.daysBefore||0));
    let end=new Date(target); end.setDate(end.getDate()+(h.daysAfter||0));
    if(now>=start&&now<=end)return h;
  } return null;
}

function promoSlide(kind, eyebrow, title, text, bullets=[]){
  return `<section class="screen promo-slide promo-${kind}" data-duration="${PROMO_DURATION}">
    <div class="promo-bg"></div><div class="promo-shade"></div>
    <div class="promo-inner">
      <div class="promo-copy">
        <div class="info-eyebrow">${eyebrow}</div>
        <h1>${title}</h1>
        <p class="promo-lead">${text}</p>
        ${bullets.length?`<div class="promo-points">${bullets.map(x=>`<span>✓ ${x}</span>`).join('')}</div>`:''}
        <div class="promo-contact">
          <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
          <div><strong>Baracsi Éva • Sziget-Baracsi Ingatlan</strong><br>
          ☎ +36 70 319 6582 &nbsp; • &nbsp; ✉ baracsievike@gmail.com<br>
          🌐 szigetvarhomes.com &nbsp; • &nbsp; 📍 7900 Szigetvár, József A. utca 35.</div>
        </div>
      </div>
    </div>
  </section>`;
}
function buildPromoItems(){
  return [
    {type:'promo',html:promoSlide('sell','ELADNÁ INGATLANÁT?','Beszéljük át személyesen.','Az ingatlan értékesítése nem csak egy hirdetés. Helyismeret, tapasztalat és személyes odafigyelés kell hozzá.',['Személyes ingatlanközvetítés','Szigetvár és Baranya','Lakás • ház • telek • üzleti ingatlan'])},
    {type:'promo',html:promoSlide('about','RÓLUNK','Baracsi Éva','A Sziget-Baracsi Ingatlan tulajdonosaként és ingatlanközvetítőjeként személyesen kísérem végig ügyfeleimet az értékesítés vagy a megfelelő ingatlan megtalálásának folyamatán.',['Sokéves helyi tapasztalat','Őszinte kommunikáció','Személyes ügyintézés'])},
    {type:'promo',html:promoSlide('service','SZOLGÁLTATÁS','Ingatlanközvetítés','Lakások, családi házak, telkek, üzleti ingatlanok, földek és befektetési lehetőségek közvetítése Szigetváron és környékén.',['Bemutatás és értékesítés','Helyi piaci ismeret','Személyes kapcsolattartás'])},
    {type:'promo',html:promoSlide('legal','MEGBÍZHATÓ HÁTTÉR','Ügyvédi segítség','Igény esetén megbízható ügyvédi kapcsolatot ajánlunk az adásvétel jogi hátteréhez.',['Rugalmas egyeztetés','Külföldi ügyfelek támogatása','Megbízható szakmai kapcsolatok'])},
    {type:'promo',html:promoSlide('finance','HITEL & BIZTOSÍTÁS','Segítség a megfelelő szakember megtalálásában','Megbízható szakmai kapcsolatainkon keresztül hitel- és biztosítási ügyintézéshez is tudunk segítséget ajánlani.',['Partneri segítség','Nem kell mindent egyedül intézni','Egy helyi kapcsolati háló'])},
    {type:'promo',html:promoSlide('partners','EGY INGATLAN • SOK FELADAT','Megbízható szakmai kapcsolatok','Ha műszaki, karbantartási vagy ügyintézési segítségre van szükség, segítünk megtalálni a megfelelő helyi szakembert.',['Mérnök és dokumentáció','Villany • víz • karbantartás','Kert • tereprendezés • ügyintézés'])}
  ];
}

function buildInfoItems(){
  const items=[];
  if(liveWeather.temp!==null) items.push({type:'info',html:infoSlide('weather-'+seasonName(),'IDŐJÁRÁS • SZIGETVÁR',`${weatherIcon(liveWeather.code)} ${liveWeather.temp} °C`,`<p class="lead">${esc(liveWeather.text)}</p><div class="info-stats"><span>Max. <b>${liveWeather.max} °C</b></span><span>Min. <b>${liveWeather.min} °C</b></span><span>Eső <b>${liveWeather.rain}%</b></span><span>Szél <b>${liveWeather.wind} km/h</b></span></div>`,'Forrás: Open-Meteo')});
  items.push({type:'info',html:infoSlide('nameday','MAI NÉVNAP',todaysNames.length?todaysNames.map(esc).join(' • '):'Szép napot kívánunk!',`<p class="lead">Boldog névnapot kíván a Sziget-Baracsi Ingatlan!</p>`,'Egy kis figyelmesség mindig otthonosabbá teszi a napot.')});
  if(liveRate) items.push({type:'info',html:infoSlide('currency','MAI EUR / HUF ÁRFOLYAM',`1 EUR = ${liveRate.toLocaleString('hu-HU',{minimumFractionDigits:2,maximumFractionDigits:2})} Ft`,`<p class="lead">Magyar Nemzeti Bank referenciaadat</p>`,`Frissítés: ${esc(rateDate||'mai munkanap')} • Forrás: MNB / Frankfurter`)});
  if(upcomingEvents.length){
    const e=upcomingEvents[0], date=e.start===e.end?formatDate(e.start):`${formatDate(e.start)} – ${formatDate(e.end)}`;
    items.push({type:'info',html:infoSlide('events','SZIGETVÁR • KÖZELGŐ PROGRAM',esc(e.title),`<p class="lead">${date}</p><p>${esc(e.location||'Szigetvár')}</p><p>${esc(e.description||'')}</p>`,'Forrás: Szigetvár város hivatalos programoldala')});
  }
  if(holidayToday) items.push({type:'info',html:infoSlide('holiday','EMLÉKNAP • ÜNNEP',esc(holidayToday.title),`<p class="lead">${esc(holidayToday.subtitle)}</p>`,'Sziget-Baracsi Ingatlan • Szigetvár')});
  return items;
}
function formatDate(s){try{return new Intl.DateTimeFormat('hu-HU',{month:'long',day:'numeric'}).format(new Date(s+'T12:00:00'));}catch(e){return s;}}

function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,
        f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1;
  return new Date(year,month,day,12);
}
function dayDistance(a,b){ return Math.round((a-b)/86400000); }
function applySeasonalTheme(){
  const now=new Date(); now.setHours(12,0,0,0);
  const month=now.getMonth()+1, day=now.getDate();
  let season = (month>=3&&month<=5)?'spring':(month>=6&&month<=8)?'summer':(month>=9&&month<=11)?'autumn':'winter';
  let special = '';

  // Fixed Hungarian and Szigetvár dates. These override the normal seasonal frame.
  if(month===3 && day>=14 && day<=15) special='march15';
  else if(month===8 && day>=19 && day<=20) special='aug20';
  else if(month===9 && day>=5 && day<=7) special='zrinyi';
  else if(month===10 && day>=22 && day<=23) special='oct23';
  else if(month===12 && day>=20 && day<=27) special='christmas';
  else if((month===12 && day>=29) || (month===1 && day<=2)) special='newyear';
  else {
    const easter=easterSunday(now.getFullYear());
    const dist=dayDistance(now,easter);
    if(dist>=-2 && dist<=1) special='easter';
  }

  root.classList.remove(
    'season-spring','season-summer','season-autumn','season-winter',
    'holiday-march15','holiday-aug20','holiday-zrinyi','holiday-oct23',
    'holiday-christmas','holiday-newyear','holiday-easter'
  );
  root.classList.add('season-'+season);
  if(special) root.classList.add('holiday-'+special);
}

function overlayHtml(){return `<div class="live-corner"><span class="live-clock"></span><span class="live-date"></span><span class="live-temp"></span></div>`;}
function updateOverlay(){
  const now=new Date();
  document.querySelectorAll('.live-clock').forEach(x=>x.textContent=now.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}));
  document.querySelectorAll('.live-date').forEach(x=>x.textContent=now.toLocaleDateString('hu-HU',{year:'numeric',month:'long',day:'numeric',weekday:'long'}));
  document.querySelectorAll('.live-temp').forEach(x=>x.textContent=liveWeather.temp!==null?`${weatherIcon(liveWeather.code)} ${liveWeather.temp} °C • Szigetvár`:'Szigetvár');
}
function transitionFrames(effect,entering){
  const neutral={opacity:1,transform:'none',clipPath:'inset(0 0 0 0)',filter:'blur(0px)'};
  const incoming={fade:{opacity:0},'slide-left':{opacity:0,transform:'translateX(9%)'},'slide-right':{opacity:0,transform:'translateX(-9%)'},'slide-up':{opacity:0,transform:'translateY(8%)'},zoom:{opacity:0,transform:'scale(.94)'},tilt:{opacity:0,transform:'perspective(1200px) rotateY(7deg) scale(.985)'},wipe:{opacity:1,clipPath:'inset(0 100% 0 0)'}}[effect]||{opacity:0};
  const outgoing={fade:{opacity:0},'slide-left':{opacity:0,transform:'translateX(-6%)'},'slide-right':{opacity:0,transform:'translateX(6%)'},'slide-up':{opacity:0,transform:'translateY(-5%)'},zoom:{opacity:0,transform:'scale(1.025)'},tilt:{opacity:0,transform:'perspective(1200px) rotateY(-5deg) scale(.99)'},wipe:{opacity:0,clipPath:'inset(0 0 0 100%)'}}[effect]||{opacity:0};
  return entering?[incoming,neutral]:[neutral,outgoing];
}
function photoFrames(effect,entering){
  const neutral={opacity:1,transform:'none',clipPath:'inset(0 0 0 0)',filter:'blur(0px)'};
  const incoming={fade:{opacity:0},'slide-left':{opacity:0,transform:'translateX(7%)'},'slide-right':{opacity:0,transform:'translateX(-7%)'},zoom:{opacity:0,transform:'scale(1.06)'},'soft-blur':{opacity:0,filter:'blur(10px)',transform:'scale(1.025)'},wipe:{opacity:1,clipPath:'inset(0 100% 0 0)'}}[effect]||{opacity:0};
  const outgoing={fade:{opacity:0},'slide-left':{opacity:0,transform:'translateX(-5%)'},'slide-right':{opacity:0,transform:'translateX(5%)'},zoom:{opacity:0,transform:'scale(.97)'},'soft-blur':{opacity:0,filter:'blur(7px)',transform:'scale(.99)'},wipe:{opacity:0,clipPath:'inset(0 0 0 100%)'}}[effect]||{opacity:0};
  return entering?[incoming,neutral]:[neutral,outgoing];
}
let photoTimer=null;
function startPhotoRotation(slide){
  if(photoTimer){clearInterval(photoTimer);photoTimer=null;}
  if(!slide||!slide.classList.contains('property-slide'))return;
  const photos=[...slide.querySelectorAll('.property-photo')],dots=[...slide.querySelectorAll('.photo-dots span')],blur=slide.querySelector('.photo-blur');
  if(photos.length<2)return; let i=0;
  photoTimer=setInterval(()=>{
    const oldPhoto=photos[i]; if(dots[i])dots[i].classList.remove('active-dot');
    i=(i+1)%photos.length; const newPhoto=photos[i],effect=photoEffects[photoEffectIndex++%photoEffects.length];
    newPhoto.classList.add('active-photo');newPhoto.style.zIndex='4';oldPhoto.style.zIndex='3';
    if(reduceMotion){oldPhoto.classList.remove('active-photo');}else{
      oldPhoto.animate(photoFrames(effect,false),{duration:520,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      newPhoto.animate(photoFrames(effect,true),{duration:900,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}).finished.finally(()=>{oldPhoto.classList.remove('active-photo');oldPhoto.getAnimations().forEach(a=>a.cancel());newPhoto.getAnimations().forEach(a=>a.cancel());});
    }
    if(dots[i])dots[i].classList.add('active-dot'); if(blur)blur.style.backgroundImage=`url('${newPhoto.src}')`;
  },PHOTO_INTERVAL);
}
function restartProgress(duration){
  const bar=root.querySelector('.progress');if(!bar)return;
  bar.style.animation='none';void bar.offsetWidth;
  bar.style.animation=`progress ${duration}ms linear forwards`;
}
async function init(){
  applySeasonalTheme();
  await loadLiveData();
  const properties=await loadJson('../data/properties.json',[]);
  const active=properties.filter(p=>p.status==='active');
  const info=buildInfoItems();
  const promos=buildPromoItems();
  const fillers=[];
  const maxFill=Math.max(info.length,promos.length);
  for(let i=0;i<maxFill;i++){
    if(promos[i]) fillers.push(promos[i]);
    if(info[i]) fillers.push(info[i]);
  }

  const sequence=[];
  let fillerIndex=0;
  active.forEach((p,index)=>{
    const html=propertySlide(p).replace('<section class="screen property-slide">','<section class="screen property-slide" data-duration="'+PROPERTY_DURATION+'">');
    sequence.push({type:'property',html});
    // 3 properties -> one own agency/live-information screen
    if((index+1)%3===0 && fillers.length){
      sequence.push(fillers[fillerIndex%fillers.length]);
      fillerIndex++;
    }
  });
  // Make sure every own promo and live-info screen appears at least once per full loop.
  while(fillerIndex<fillers.length){
    sequence.push(fillers[fillerIndex++]);
  }

  root.innerHTML=sequence.map(x=>x.html).join('')+overlayHtml()+'<div class="progress"></div>';
  updateOverlay();setInterval(updateOverlay,1000);setInterval(applySeasonalTheme,60000);
  const slides=[...root.querySelectorAll('.screen')];if(!slides.length)return;
  let current=0, slideTimer=null;

  function durationFor(slide){
    return Number(slide.dataset.duration || PROPERTY_DURATION);
  }
  function scheduleNext(){
    if(slideTimer) clearTimeout(slideTimer);
    const duration=durationFor(slides[current]);
    restartProgress(duration);
    slideTimer=setTimeout(()=>show((current+1)%slides.length),duration);
  }
  function show(nextIndex){
    const oldSlide=slides[current],newSlide=slides[nextIndex];
    if(oldSlide!==newSlide){
      const effect=slideEffects[slideEffectIndex++%slideEffects.length];
      newSlide.classList.add('active');newSlide.style.zIndex='4';oldSlide.style.zIndex='3';
      if(reduceMotion){oldSlide.classList.remove('active');}
      else{
        oldSlide.animate(transitionFrames(effect,false),{duration:700,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
        newSlide.animate(transitionFrames(effect,true),{duration:1200,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}).finished.finally(()=>{
          oldSlide.classList.remove('active');oldSlide.getAnimations().forEach(a=>a.cancel());newSlide.getAnimations().forEach(a=>a.cancel());
          oldSlide.style.zIndex='';newSlide.style.zIndex='';
        });
      }
      current=nextIndex;
    }
    startPhotoRotation(slides[current]);
    scheduleNext();
  }

  slides[0].classList.add('active');
  startPhotoRotation(slides[0]);
  scheduleNext();
}
init();
