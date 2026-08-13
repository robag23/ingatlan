
async function loadProperties(status){
  const el=document.querySelector('[data-property-grid]');
  if(!el) return;
  try{
    const r=await fetch('data/properties.json',{cache:'no-store'});
    const data=await r.json();
    const list=data.filter(x=>x.status===status);
    el.innerHTML=list.map(card).join('');
  }catch(e){
    el.innerHTML='<p>Az ingatlanok betöltése nem sikerült. GitHub Pages-en vagy helyi webszerveren nyisd meg az oldalt.</p>';
  }
}
function card(p){
  const sold=p.status==='sold';
  return `<article class="card">
    <div class="ribbon ${sold?'sold':''}">${p.badge||''}</div>
    <img class="card-image" src="${p.image}" alt="${p.city}, ${p.location} – ${p.type}">
    <div class="card-body">
      <div class="loc">📍 ${p.city}${p.location?', '+p.location:''}</div>
      <h3>${p.type}</h3>
      <div class="chips"><span class="chip">${p.area}</span><span class="chip">${p.rooms}</span>${p.plot?`<span class="chip">${p.plot}</span>`:''}</div>
      <p class="desc">${p.description}</p>
      <div class="pricebar">
        <div>${p.oldPrice?`<div class="old">${p.oldPrice}</div>`:''}<div class="price">${p.price}</div></div>
        ${sold?'<span class="more">Sikeresen eladva ✓</span>':`<a class="more" target="_blank" rel="noopener" href="${p.url}">Megnézem →</a>`}
      </div>
      <div class="contact-strip"><span>7900 Szigetvár, József A. u. 35.</span><a href="tel:+36703196582">☎ +36 70 319 6582</a></div>
    </div>
  </article>`;
}
const grid=document.querySelector('[data-property-grid]');
if(grid) loadProperties(grid.dataset.status||'active');
