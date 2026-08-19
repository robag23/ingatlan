
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


function parseMetricNumber(value){
  const m = String(value || '').match(/[\d\s.,]+/);
  if(!m) return 0;
  return Number(m[0].replace(/[^\d]/g,'')) || 0;
}

function smartBadge(p){
  // Real/manual labels always win.
  if(p.badge && String(p.badge).trim()) return String(p.badge).trim();

  const price = numericPrice(p);
  const area = parseMetricNumber(p.area);
  const plot = parseMetricNumber(p.plot);
  const type = String(p.type || '').toLowerCase();
  const location = String(p.location || '').toLowerCase();
  const plotText = String(p.plot || '').toLowerCase();

  if(p.oldPrice) return 'ÁRCSÖKKENÉS';
  if(price >= 50000000) return 'KIEMELT';
  if(type.includes('szálloda') || type.includes('üzlet') || type.includes('üzleti')) return 'ÜZLETI LEHETŐSÉG';
  if(plot >= 3000) return 'NAGY TELEK';
  if(price > 0 && price < 10000000) return '10 M ALATT';
  if(price >= 10000000 && price < 20000000) return '20 M ALATT';
  if(type.includes('tanya')) return 'VIDÉKI LEHETŐSÉG';
  if(area >= 150) return 'TÁGAS';
  if(plotText.includes('erkély')) return 'ERKÉLYES';
  if(location.includes('belváros')) return 'BELVÁROSI';
  if(type.includes('lakás')) return 'LAKÁS';
  if(type.includes('ház')) return 'CSALÁDI OTTHON';
  return 'AJÁNLAT';
}

function badgeClass(label){
  const s = String(label || '').toUpperCase();
  if(s.includes('ÁRCSÖKKEN') || s.includes('10 M ALATT') || s.includes('20 M ALATT')) return 'badge-price';
  if(s.includes('ALKUKÉPES')) return 'badge-deal';
  if(s.includes('FELÚJÍTOTT')) return 'badge-renovated';
  if(s.includes('BEFEKTET') || s.includes('ÜZLETI')) return 'badge-investment';
  if(s.includes('TELEK')) return 'badge-land';
  if(s.includes('OTTHON') || s.includes('BELVÁROSI')) return 'badge-home';
  if(s.includes('LAKÁS')) return 'badge-apartment';
  if(s.includes('TÁGAS')) return 'badge-space';
  if(s.includes('VIDÉKI')) return 'badge-rural';
  return 'badge-highlight';
}

function localizeBadge(label, lang){
  const maps = {
    en:{
      'KIEMELT':'FEATURED','ÁRCSÖKKENÉS':'PRICE REDUCED','ALKUKÉPES':'NEGOTIABLE',
      'FELÚJÍTOTT':'RENOVATED','BEFEKTETŐKNEK':'FOR INVESTORS','ÜZLETI LEHETŐSÉG':'BUSINESS OPPORTUNITY',
      'NAGY TELEK':'LARGE PLOT','10 M ALATT':'UNDER 10M HUF','20 M ALATT':'UNDER 20M HUF',
      'VIDÉKI LEHETŐSÉG':'COUNTRYSIDE','TÁGAS':'SPACIOUS','ERKÉLYES':'WITH BALCONY',
      'BELVÁROSI':'CENTRAL','LAKÁS':'APARTMENT','CSALÁDI OTTHON':'FAMILY HOME','AJÁNLAT':'OFFER'
    },
    de:{
      'KIEMELT':'HIGHLIGHT','ÁRCSÖKKENÉS':'PREIS GESENKT','ALKUKÉPES':'VERHANDELBAR',
      'FELÚJÍTOTT':'RENOVIERT','BEFEKTETŐKNEK':'FÜR INVESTOREN','ÜZLETI LEHETŐSÉG':'GESCHÄFTSCHANCE',
      'NAGY TELEK':'GROSSES GRUNDSTÜCK','10 M ALATT':'UNTER 10 MIO. HUF','20 M ALATT':'UNTER 20 MIO. HUF',
      'VIDÉKI LEHETŐSÉG':'LÄNDLICH','TÁGAS':'GROSSZÜGIG','ERKÉLYES':'MIT BALKON',
      'BELVÁROSI':'ZENTRAL','LAKÁS':'WOHNUNG','CSALÁDI OTTHON':'FAMILIENHAUS','AJÁNLAT':'ANGEBOT'
    },
    nl:{
      'KIEMELT':'UITGELICHT','ÁRCSÖKKENÉS':'PRIJS VERLAAGD','ALKUKÉPES':'BESPREEKBAAR',
      'FELÚJÍTOTT':'GERENOVEERD','BEFEKTETŐKNEK':'VOOR INVESTEERDERS','ÜZLETI LEHETŐSÉG':'ZAKELIJKE KANS',
      'NAGY TELEK':'GROOT PERCEEL','10 M ALATT':'ONDER 10M HUF','20 M ALATT':'ONDER 20M HUF',
      'VIDÉKI LEHETŐSÉG':'LANDELIJK','TÁGAS':'RUIM','ERKÉLYES':'MET BALKON',
      'BELVÁROSI':'CENTRAAL','LAKÁS':'APPARTEMENT','CSALÁDI OTTHON':'GEZINSWONING','AJÁNLAT':'AANBOD'
    },
    fr:{
      'KIEMELT':'EN VEDETTE','ÁRCSÖKKENÉS':'PRIX RÉDUIT','ALKUKÉPES':'NÉGOCIABLE',
      'FELÚJÍTOTT':'RÉNOVÉ','BEFEKTETŐKNEK':'INVESTISSEURS','ÜZLETI LEHETŐSÉG':'OPPORTUNITÉ COMMERCIALE',
      'NAGY TELEK':'GRAND TERRAIN','10 M ALATT':'MOINS DE 10M HUF','20 M ALATT':'MOINS DE 20M HUF',
      'VIDÉKI LEHETŐSÉG':'CAMPAGNE','TÁGAS':'SPACIEUX','ERKÉLYES':'AVEC BALCON',
      'BELVÁROSI':'CENTRAL','LAKÁS':'APPARTEMENT','CSALÁDI OTTHON':'MAISON FAMILIALE','AJÁNLAT':'OFFRE'
    }
  };
  return lang === 'hu' ? label : (maps[lang]?.[label] || label);
}

function card(p){
  const sold=p.status==='sold';
  const lang=langCode();
  const tr=PROPERTY_LANG[lang];
  const rawBadge = smartBadge(p);
  const shownBadge = localizeBadge(rawBadge, lang);
  const badge = rawBadge ? `<div class="ribbon ${sold?'sold':''} ${badgeClass(rawBadge)}">${shownBadge}</div>` : '';

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
