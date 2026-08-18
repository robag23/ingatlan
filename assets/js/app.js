
function numericPrice(item){
  if (typeof item.priceValue === 'number') return item.priceValue;
  const digits = String(item.price || '').replace(/[^\d]/g,'');
  return digits ? Number(digits) : 0;
}

const PROPERTY_LANG = {
  en:{
    types:{
      "Családi ház":"Family house","Tégla lakás":"Brick apartment","Panel lakás":"Panel apartment",
      "Lakó- és üzletház":"Residential & commercial building","Családi ház / üzleti célra is":"House / commercial opportunity",
      "Utcai bejáratos üzlethelyiség":"Street-front commercial unit","Tanya":"Farmstead","Egyéb telek":"Land",
      "Szálloda / hotel / panzió":"Hotel / guesthouse"
    },
    view:"View details →", sold:"Successfully sold ✓",
    generic:(p)=>`${p.type} in ${p.city}${p.location?', '+p.location:''}, ${p.area}${p.rooms && p.rooms!=='—'?', '+p.rooms:''}${p.plot?', '+p.plot:''}.`
  },
  de:{
    types:{
      "Családi ház":"Einfamilienhaus","Tégla lakás":"Wohnung in Ziegelbauweise","Panel lakás":"Plattenbauwohnung",
      "Lakó- és üzletház":"Wohn- und Geschäftshaus","Családi ház / üzleti célra is":"Haus / gewerbliche Möglichkeit",
      "Utcai bejáratos üzlethelyiség":"Gewerbeeinheit mit Straßenzugang","Tanya":"Landhaus / Hof","Egyéb telek":"Grundstück",
      "Szálloda / hotel / panzió":"Hotel / Pension"
    },
    view:"Details ansehen →", sold:"Erfolgreich verkauft ✓",
    generic:(p)=>`${p.type} in ${p.city}${p.location?', '+p.location:''}, ${p.area}${p.rooms && p.rooms!=='—'?', '+p.rooms:''}${p.plot?', '+p.plot:''}.`
  },
  nl:{
    types:{
      "Családi ház":"Gezinswoning","Tégla lakás":"Bakstenen appartement","Panel lakás":"Paneelappartement",
      "Lakó- és üzletház":"Woon- en bedrijfspand","Családi ház / üzleti célra is":"Woning / zakelijke mogelijkheid",
      "Utcai bejáratos üzlethelyiség":"Commerciële ruimte aan straatzijde","Tanya":"Boerderij / landhuis","Egyéb telek":"Grond",
      "Szálloda / hotel / panzió":"Hotel / pension"
    },
    view:"Bekijk details →", sold:"Succesvol verkocht ✓",
    generic:(p)=>`${p.type} in ${p.city}${p.location?', '+p.location:''}, ${p.area}${p.rooms && p.rooms!=='—'?', '+p.rooms:''}${p.plot?', '+p.plot:''}.`
  },
  fr:{
    types:{
      "Családi ház":"Maison familiale","Tégla lakás":"Appartement en brique","Panel lakás":"Appartement en immeuble préfabriqué",
      "Lakó- és üzletház":"Immeuble résidentiel et commercial","Családi ház / üzleti célra is":"Maison / opportunité commerciale",
      "Utcai bejáratos üzlethelyiség":"Local commercial avec accès rue","Tanya":"Ferme / maison de campagne","Egyéb telek":"Terrain",
      "Szálloda / hotel / panzió":"Hôtel / pension"
    },
    view:"Voir les détails →", sold:"Vendu avec succès ✓",
    generic:(p)=>`${p.type} à ${p.city}${p.location?', '+p.location:''}, ${p.area}${p.rooms && p.rooms!=='—'?', '+p.rooms:''}${p.plot?', '+p.plot:''}.`
  }
};

function langCode(){
  return window.SiteLanguage?.get?.() || localStorage.getItem('siteLang') || 'hu';
}

function localizeProperty(p){
  const lang = langCode();
  if(lang === 'hu' || !PROPERTY_LANG[lang]) return {...p};

  const q = {...p};
  q.type = PROPERTY_LANG[lang].types[p.type] || p.type;
  q.description = PROPERTY_LANG[lang].generic(q);
  return q;
}

async function loadProperties(status){
  const el=document.querySelector('[data-property-grid]');
  if(!el) return;
  try{
    const r=await fetch('data/properties.json',{cache:'no-store'});
    const data=await r.json();
    let list=data.filter(x=>x.status===status);

    if(el.dataset.homeFeatured === 'true'){
      list = list
        .filter(x => numericPrice(x) >= 50000000)
        .sort((a,b) => numericPrice(b) - numericPrice(a));
    }

    el.innerHTML=list.length
      ? list.map(p => card(localizeProperty(p))).join('')
      : '<p>Jelenleg nincs megjeleníthető ingatlan.</p>';
  }catch(e){
    el.innerHTML='<p>Az ingatlanok betöltése nem sikerült.</p>';
  }
}

function card(p){
  const sold=p.status==='sold';
  const lang=langCode();
  const tr=PROPERTY_LANG[lang];
  const badge=p.badge ? `<div class="ribbon ${sold?'sold':''}">${p.badge}</div>` : '';

  return `<article class="card">
    ${badge}
    <img class="card-image" src="${p.image}" alt="${p.city}, ${p.location||''} – ${p.type}">
    <div class="card-body">
      <div class="loc">📍 ${p.city}${p.location?', '+p.location:''}</div>
      <h3>${p.type}</h3>
      <div class="chips">
        <span class="chip">${p.area}</span>
        <span class="chip">${p.rooms}</span>
        ${p.plot?`<span class="chip">${p.plot}</span>`:''}
      </div>
      <p class="desc">${p.description}</p>
      <div class="pricebar">
        <div>${p.oldPrice?`<div class="old">${p.oldPrice}</div>`:''}<div class="price">${p.price}</div></div>
        ${sold
          ? `<span class="more">${tr?.sold || 'Sikeresen eladva ✓'}</span>`
          : `<a class="more" target="_blank" rel="noopener" href="${p.url}">${tr?.view || 'Megnézem →'}</a>`}
      </div>
      <div class="contact-strip"><span>7900 Szigetvár, József A. u. 35.</span><a href="tel:+36703196582">☎ +36 70 319 6582</a></div>
    </div>
  </article>`;
}

const grid=document.querySelector('[data-property-grid]');
if(grid) loadProperties(grid.dataset.status||'active');

window.addEventListener('siteLanguageChanged', () => {
  if(grid) loadProperties(grid.dataset.status||'active');
});
