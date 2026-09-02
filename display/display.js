
const PROPERTY_DURATION = 15000;
const INFO_DURATION = 30000;
const PROMO_DURATION = 30000;
const PHOTO_INTERVAL = 5000;
const root = document.getElementById('display');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const slideEffects = ['fade'];
const photoEffects = ['fade'];
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
  const images=propertyImages(p);
  const hasPhotos=images.length>0;
  const imgs=hasPhotos?images:['assets/images/logo-brand-new.png'];
  const rawDescription=(p.description||'').trim();
  const factBits=[
    p.area?`Alapterület: ${p.area}.`:'',
    p.rooms&&p.rooms!=='—'?`Elrendezés: ${p.rooms}.`:'',
    p.plot?`${p.plot}.`:'',
    p.price?`Irányár: ${p.price}.`:''
  ].filter(Boolean);
  const generic=`${p.city}${p.location?', '+p.location:''} területén kínált ${p.type||'ingatlan'}.`;
  const description=((rawDescription||generic)+' '+factBits.join(' ')+' További részletekért és megtekintésért keresse a Sziget-Baracsi Ingatlant.').replace(/\s+/g,' ').trim();
  return `<section class="screen property-slide ${hasPhotos?'has-photo':'missing-photo'}">
    <div class="photo-stage">
      <div class="photo-blur" style="background-image:url('${imageSrc(imgs[0])}')"></div>
      <div class="photo-main">${imgs.map((img,i)=>`<img class="property-photo ${i===0?'active-photo':''}" src="${imageSrc(img)}" alt="${esc(p.city)} – ${esc(p.type)}" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='../assets/images/hero-clean.png';this.closest('.property-slide')?.classList.add('image-fallback')}else{this.style.display='none'}">`).join('')}</div>
      ${!hasPhotos?`<div class="photo-fallback-copy">
        <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
        <strong>${esc(p.city)}${p.location?' • '+esc(p.location):''}</strong>
        <span>${esc(p.type)}</span>
        <p>${esc(description)}</p>
      </div>`:''}
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
        <p class="desc">${esc(description)}</p><div class="property-link">Teljes hirdetés: ingatlan.com/${esc(p.id||'')}</div>
        <div class="details-note">Részletek és megtekintés: keressen minket bizalommal.</div>
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
async function loadJson(url,fallback,timeoutMs=3000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!r.ok) throw new Error(r.status);
    return await r.json();
  }catch(e){
    console.warn('Display adatforrás kihagyva:',url,e);
    return fallback;
  }finally{
    clearTimeout(timer);
  }
}
async function loadLiveData(){
  const weatherUrl='https://api.open-meteo.com/v1/forecast?latitude=46.0487&longitude=17.8055&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBudapest&forecast_days=1';
  const now=new Date(), m=String(now.getMonth()+1), d=String(now.getDate());

  const [w,fx,names,ev,hs,news]=await Promise.all([
    loadJson(weatherUrl,null),
    loadJson('https://api.frankfurter.dev/v2/rate/EUR/HUF?providers=MNB',null),
    loadJson('https://raw.githubusercontent.com/froccsos/nevnapok-json/refs/heads/main/nevnapok.json',null),
    loadJson('local-events.json',{events:[]},2000),
    loadJson('holidays.json',[],2000),
    loadJson('local-news.json',{news:[]},2000)
  ]);

  if(w){
    liveWeather={
      temp:Math.round(w.current.temperature_2m),
      code:w.current.weather_code,
      text:weatherText(w.current.weather_code),
      wind:Math.round(w.current.wind_speed_10m),
      max:Math.round(w.daily.temperature_2m_max[0]),
      min:Math.round(w.daily.temperature_2m_min[0]),
      rain:Math.round(w.daily.precipitation_probability_max[0]||0)
    };
  }
  if(fx){liveRate=Number(fx.rate);rateDate=fx.date;}
  if(names&&names[m]&&names[m][d]) todaysNames=(names[m][d].main||[]).slice(0,4);
  upcomingEvents=(ev?.events||[]).filter(x=>new Date((x.end||x.start)+'T23:59:59')>=new Date()).slice(0,3);
  holidayToday=findHoliday(hs||[]);
  localNews=(news?.news||[]).slice(0,4);
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


function zrinyiProgramSlide(){
  const now=new Date(); now.setHours(12,0,0,0);
  const start=new Date(2026,7,20,12), end=new Date(2026,8,13,23,59,59);
  if(now<start || now>end) return null;
  return `<section class="screen info-slide info-zrinyi-program" data-duration="90000">
    <div class="info-bg"></div><div class="info-shade"></div>
    <div class="info-card program-card">
      <div class="info-eyebrow">KIEMELT HELYI PROGRAM • SZIGETVÁR</div>
      <h1>Zrínyi Napok 2026</h1>
      <p class="lead">2026. szeptember 11–13. • Szigetvár</p>
      <div class="program-scroll"><div class="program-grid">
        <div><b>Szept. 10., csütörtök</b><br>18:00–19:30 • Leskovics Gábor – „Dalok, történetek, emberközelből” • Molnár Imre Városi Könyvtár</div>
        <div><b>Szept. 11., péntek</b><br>19:00–20:30 • Trotty Lee'k • Zrínyi tér<br>21:30–23:00 • B52 • Zrínyi tér</div>
        <div><b>Szept. 12., szombat</b><br>19:30–21:00 • Melody Maker • Zrínyi tér<br>22:00–23:30 • Delta • Zrínyi tér</div>
        <div><b>Szept. 13., vasárnap</b><br>18:00–19:30 • Mohikán – Bódi László „Cipő” emlékkoncert • Zrínyi tér</div>
      </div></div>
      <p class="program-note">A Zrínyi Napok hivatalos rendezvénysorozata szeptember 11–13. között zajlik. A teljes programfüzet a város hivatalos oldaláról érhető el.</p>
      <div class="info-brand">
        <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
        <div><strong>SZIGET-BARACSI INGATLAN</strong><br><small>☎ +36 70 319 6582 • ✉ baracsievike@gmail.com • 🌐 szigetvarhomes.com • 📍 7900 Szigetvár, József A. utca 35.</small></div>
      </div>
    </div>
  </section>`;
}


function zrinyiMemorialSlide(){
  const now=new Date();
  now.setHours(12,0,0,0);

  const year=now.getFullYear();

  // Automatikus Zrínyi-emlékidőszak minden évben:
  // augusztus 25. – szeptember 15.
  const start=new Date(year,7,25,12);
  const end=new Date(year,8,15,23,59,59);

  if(now<start || now>end) return null;

  // Szeptember 7. – kiemelt emléknap.
  const isMemorialDay=now.getMonth()===8 && now.getDate()===7;
  const memorialDuration=isMemorialDay ? 60000 : 45000;

  return `<section class="screen info-slide info-zrinyi-memorial ${isMemorialDay?'zrinyi-main-day':''}" data-duration="${memorialDuration}">
    <div class="info-bg"></div><div class="info-shade"></div>
    <div class="memorial-card">
      <div class="memorial-kicker">1566 • EMLÉKEZZÜNK HŐSEINKRE</div>
      <h1>Zrínyi Miklós és Szigetvár hős várvédői</h1>
      <p>1566 augusztusában Zrínyi Miklós és katonái több mint egy hónapon át védték Szigetvár várát a hatalmas túlerővel szemben. A megadás helyett a végsőkig való küzdelmet választották.</p>
      <p>1566. szeptember 7-én Zrínyi maroknyi megmaradt seregével kitört a belső várból. Helytállásuk a bátorság, az áldozatvállalás és a hazaszeretet maradandó jelképe lett.</p>
      <div class="memorial-line">Örök tisztelet Zrínyi Miklósnak és Szigetvár hős várvédőinek.</div>
      <div class="memorial-source">Sziget-Baracsi Ingatlan • Szigetvár emlékezik</div>
    </div>
  </section>`;
}
function localNewsSlide(){
  if(!localNews.length) return null;
  const rows=localNews.slice(0,4).map(n=>`<div class="news-row"><b>${esc(n.date||'')}</b><span>${esc(n.title||'')}</span></div>`).join('');
  return `<section class="screen info-slide info-local-news" data-duration="${INFO_DURATION}">
    <div class="info-bg"></div><div class="info-shade"></div>
    <div class="info-card news-card">
      <div class="info-eyebrow">AKTUÁLIS • SZIGETVÁR</div>
      <h1>Helyi hírek és közérdekű információk</h1>
      <div class="news-list">${rows}</div>
      <div class="info-extra">Forrás: Szigetvár város hivatalos honlapja • szigetvar.hu</div>
      <div class="info-brand">
        <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
        <div><strong>SZIGET-BARACSI INGATLAN</strong><br><small>☎ +36 70 319 6582 • ✉ baracsievike@gmail.com • 🌐 szigetvarhomes.com</small></div>
      </div>
    </div>
  </section>`;
}

function buildInfoItems(){
  const items=[];
  const memorial=zrinyiMemorialSlide(); if(memorial) items.push({type:'info',html:memorial});
  const newsSlide=localNewsSlide(); if(newsSlide) items.push({type:'info',html:newsSlide});
  const zrinyi=zrinyiProgramSlide(); if(zrinyi) items.push({type:'info',html:zrinyi});
  if(liveWeather.temp!==null) items.push({type:'info',html:infoSlide('weather-'+seasonName(),'IDŐJÁRÁS • SZIGETVÁR',`${weatherIcon(liveWeather.code)} ${liveWeather.temp} °C`,`<p class="lead">${esc(liveWeather.text)}</p><div class="info-stats"><span>Max. <b>${liveWeather.max} °C</b></span><span>Min. <b>${liveWeather.min} °C</b></span><span>Eső <b>${liveWeather.rain}%</b></span><span>Szél <b>${liveWeather.wind} km/h</b></span></div>`,'Forrás: Open-Meteo')});
  items.push({type:'info',html:infoSlide('nameday','MAI NÉVNAP',todaysNames.length?todaysNames.map(esc).join(' • '):'Szép napot kívánunk!',`<p class="lead nameday-lead">Sok szeretettel köszöntjük a mai névnaposokat!</p><p class="nameday-message">Kívánunk örömökben gazdag, szép napot, jó egészséget, szeretetet és sok emlékezetes pillanatot.</p>`,'Boldog névnapot kíván a Sziget-Baracsi Ingatlan!')});
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
function lastSunday(year,monthIndex){
  const d=new Date(year,monthIndex+1,0,12);
  d.setDate(d.getDate()-d.getDay());
  return d;
}
function nthSunday(year,monthIndex,n){
  const d=new Date(year,monthIndex,1,12);
  d.setDate(1+((7-d.getDay())%7)+(n-1)*7);
  return d;
}
function themeForDate(now){
  const y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
  const easter=easterSunday(y), shrove=new Date(easter); shrove.setDate(easter.getDate()-47);
  const childrens=lastSunday(y,4), fathers=nthSunday(y,5,3);
  const dist=(a,b)=>Math.round((a-b)/86400000);

  if(m===2 && d>=12 && d<=15) return 'valentine';
  if(m===3 && d>=7 && d<=9) return 'womensday';
  if(dist(now,easter)>=-3 && dist(now,easter)<=1) return 'easter';
  if(Math.abs(dist(now,childrens))<=1) return 'childrensday';
  if(Math.abs(dist(now,fathers))<=1) return 'fathersday';
  if((m===8 && d>=25) || (m===9 && d<=15)) return 'zrinyi';
  if((m===9 && d>=16) || (m===10 && d<=31)) return 'harvest';
  if(m===12 && d>=5 && d<=6) return 'mikulas';
  if(m===12 && d>=20 && d<=27) return 'christmas';
  if((m===12 && d>=29)||(m===1 && d<=2)) return 'newyear';
  if(m===3 && d>=14 && d<=15) return 'march15';
  if(m===8 && d>=19 && d<=20) return 'aug20';
  if(m===10 && d>=22 && d<=23) return 'oct23';

  // Farsang: vízkereszttől húshagyókeddig; Busójárás: a farsang utolsó napjai.
  const jan6=new Date(y,0,6,12);
  if(now>=jan6 && now<=shrove){
    const busoStart=new Date(shrove); busoStart.setDate(shrove.getDate()-5);
    if(now>=busoStart) return 'buso';
    return 'farsang';
  }
  return '';
}
function applySeasonalTheme(){
  const now=new Date(); now.setHours(12,0,0,0);
  const month=now.getMonth()+1;
  const season=(month>=3&&month<=5)?'spring':(month>=6&&month<=8)?'summer':(month>=9&&month<=11)?'autumn':'winter';
  const special=themeForDate(now);
  [...root.classList].filter(c=>c.startsWith('season-')||c.startsWith('holiday-')).forEach(c=>root.classList.remove(c));
  root.classList.add('season-'+season);
  if(special) root.classList.add('holiday-'+special);
}



function setupFullscreenToggle(){
  let btn=document.getElementById('fullscreen-toggle');

  if(!btn){
    btn=document.createElement('button');
    btn.id='fullscreen-toggle';
    btn.className='fullscreen-toggle';
    btn.type='button';
    btn.setAttribute('aria-label','Teljes képernyő');
    btn.textContent='⛶ Teljes képernyő';
    document.body.appendChild(btn);
  }

  function refreshFullscreenButton(){
    const active=!!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

    btn.style.display=active ? 'none' : 'block';
  }

  btn.addEventListener('click', async ()=>{
    const el=document.documentElement;

    try{
      if(el.requestFullscreen){
        await el.requestFullscreen();
      }else if(el.webkitRequestFullscreen){
        el.webkitRequestFullscreen();
      }else if(el.msRequestFullscreen){
        el.msRequestFullscreen();
      }
    }catch(err){
      console.warn('Fullscreen nem indítható:',err);
    }

    refreshFullscreenButton();
  });

  document.addEventListener('fullscreenchange',refreshFullscreenButton);
  document.addEventListener('webkitfullscreenchange',refreshFullscreenButton);
  document.addEventListener('MSFullscreenChange',refreshFullscreenButton);

  refreshFullscreenButton();
}

function updateOverlay(){
  const clock=document.querySelector('.live-clock');
  const dateEl=document.querySelector('.live-date');
  const temp=document.querySelector('.live-temp');
  const now=new Date();

  if(clock){
    clock.textContent=now.toLocaleTimeString('hu-HU',{
      hour:'2-digit',
      minute:'2-digit'
    });
  }

  if(dateEl){
    dateEl.textContent=new Intl.DateTimeFormat('hu-HU',{
      year:'numeric',
      month:'long',
      day:'numeric',
      weekday:'long'
    }).format(now);
  }

  if(temp){
    if(liveWeather && liveWeather.temp!==null && liveWeather.temp!==undefined){
      temp.textContent=`${weatherIcon(liveWeather.code)} ${Math.round(liveWeather.temp)} °C`;
    }else{
      temp.textContent='— °C';
    }
  }
}

function overlayHtml(){return `
  <div class="live-corner"><span class="live-clock"></span><span class="live-date"></span><span class="live-temp"></span></div>
  <button class="fullscreen-toggle" type="button" aria-label="Teljes képernyő be- vagy kikapcsolása" title="Teljes képernyő">
    <span class="fullscreen-icon">⛶</span>
    <span class="fullscreen-label">TELJES KÉPERNYŐ</span>
    <span class="fullscreen-switch"><i></i></span>
  </button>`;}
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
    newPhoto.getAnimations().forEach(a=>a.cancel());oldPhoto.getAnimations().forEach(a=>a.cancel());
    newPhoto.classList.add('active-photo');newPhoto.style.zIndex='4';oldPhoto.style.zIndex='3';
    if(reduceMotion){
      oldPhoto.classList.remove('active-photo');oldPhoto.style.zIndex='';newPhoto.style.zIndex='';
    }else{
      newPhoto.animate([{opacity:0},{opacity:1}],{duration:850,easing:'ease-out',fill:'both'}).finished.finally(()=>{
        oldPhoto.classList.remove('active-photo');oldPhoto.style.zIndex='';newPhoto.style.zIndex='';
        newPhoto.getAnimations().forEach(a=>a.cancel());
      });
    }
    if(dots[i])dots[i].classList.add('active-dot'); if(blur)blur.style.backgroundImage=`url('${newPhoto.src}')`;
  },PHOTO_INTERVAL);
}
function restartProgress(duration){
  const bar=root.querySelector('.progress');if(!bar)return;
  bar.style.animation='none';void bar.offsetWidth;
  bar.style.animation=`progress ${duration}ms linear forwards`;
}

async function preloadDisplayImages(){
  const imgs=[...root.querySelectorAll('img')];
  await Promise.all(imgs.map(img=>{
    if(img.complete) return Promise.resolve();
    return new Promise(resolve=>{
      img.addEventListener('load',resolve,{once:true});
      img.addEventListener('error',resolve,{once:true});
      setTimeout(resolve,3500);
    });
  }));
}

async function init(){
  if(!root) return;
  root.innerHTML=`<div class="display-loading">
    <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
    <strong>Sziget-Baracsi Ingatlan</strong>
    <span>A kijelző betöltése…</span>
  </div>`;
  applySeasonalTheme();
  await loadLiveData();
  const properties=await loadJson('../data/properties.json',[],3000);
  const active=Array.isArray(properties)?properties.filter(p=>p.status==='active'):[];
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
    const html=propertySlide(p).replace('<section class="screen property-slide ','<section data-duration="'+PROPERTY_DURATION+'" class="screen property-slide ');
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
  await preloadDisplayImages();
  
  updateOverlay();setInterval(updateOverlay,1000);setInterval(applySeasonalTheme,60000);
  const slides=[...root.querySelectorAll('.screen')];
  if(!slides.length){
    root.innerHTML=`<div class="display-error-card">
      <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
      <h1>Sziget-Baracsi Ingatlan</h1>
      <p>☎ +36 70 319 6582 &nbsp; • &nbsp; baracsievike@gmail.com</p>
      <p>szigetvarhomes.com &nbsp; • &nbsp; 7900 Szigetvár, József A. utca 35.</p>
    </div>`+overlayHtml();
    updateOverlay();
    return;
  }
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
      newSlide.getAnimations().forEach(a=>a.cancel());
      oldSlide.getAnimations().forEach(a=>a.cancel());
      newSlide.classList.add('active');
      newSlide.style.zIndex='4';
      oldSlide.style.zIndex='3';
      if(reduceMotion){
        oldSlide.classList.remove('active');
        oldSlide.style.zIndex='';
        newSlide.style.zIndex='';
      }else{
        newSlide.animate([{opacity:0},{opacity:1}],{duration:900,easing:'ease-out',fill:'both'}).finished.finally(()=>{
          oldSlide.classList.remove('active');
          oldSlide.style.zIndex='';
          newSlide.style.zIndex='';
          newSlide.getAnimations().forEach(a=>a.cancel());
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
setupFullscreenToggle();

init().catch(err=>{
  console.error('Display indítási hiba:',err);
  if(root){
    root.innerHTML=`<div class="display-error-card">
      <img src="../assets/images/logo-brand-new.png" alt="Sziget-Baracsi Ingatlan">
      <h1>Sziget-Baracsi Ingatlan</h1>
      <p>A kijelző újraindítása szükséges.</p>
      <p>☎ +36 70 319 6582 • baracsievike@gmail.com • szigetvarhomes.com</p>
    </div>`+overlayHtml();
    try{setupFullscreenToggle();updateOverlay();}catch(e){}
  }
});
