
function numericPrice(item){
  if (typeof item.priceValue === 'number') return item.priceValue;
  const digits = String(item.price || '').replace(/[^\d]/g,'');
  return digits ? Number(digits) : 0;
}

async function loadProperties(status){
  const el = document.querySelector('[data-property-grid]');
  if(!el) return;

  try{
    const r = await fetch('data/properties.json', {cache:'no-store'});
    const data = await r.json();

    let list = data.filter(x => x.status === status);

    // FŐOLDAL: csak 50M+ aktív ingatlanok.
    if(el.dataset.homeFeatured === 'true'){
      list = list
        .filter(x => numericPrice(x) >= 50000000)
        .sort((a,b) => numericPrice(b) - numericPrice(a));
    }

    el.innerHTML = list.length
      ? list.map(card).join('')
      : '<p>Jelenleg nincs megjeleníthető ingatlan.</p>';
  }catch(e){
    el.innerHTML = '<p>Az ingatlanok betöltése nem sikerült.</p>';
  }
}

function card(p){
  const sold = p.status === 'sold';
  const badge = p.badge
    ? `<div class="ribbon ${sold ? 'sold' : ''}">${p.badge}</div>`
    : '';

  return `<article class="card">
    ${badge}
    <img class="card-image" src="${p.image}" alt="${p.city}${p.location ? ', '+p.location : ''} – ${p.type}">
    <div class="card-body">
      <div class="loc">📍 ${p.city}${p.location ? ', '+p.location : ''}</div>
      <h3>${p.type}</h3>
      <div class="chips">
        <span class="chip">${p.area}</span>
        <span class="chip">${p.rooms}</span>
        ${p.plot ? `<span class="chip">${p.plot}</span>` : ''}
      </div>
      <p class="desc">${p.description}</p>
      <div class="pricebar">
        <div>
          ${p.oldPrice ? `<div class="old">${p.oldPrice}</div>` : ''}
          <div class="price">${p.price}</div>
        </div>
        ${sold
          ? '<span class="more">Sikeresen eladva ✓</span>'
          : `<a class="more" target="_blank" rel="noopener" href="${p.url}">Megnézem →</a>`}
      </div>
      <div class="contact-strip">
        <span>7900 Szigetvár, József A. u. 35.</span>
        <a href="tel:+36703196582">☎ +36 70 319 6582</a>
      </div>
    </div>
  </article>`;
}

const grid = document.querySelector('[data-property-grid]');
if(grid) loadProperties(grid.dataset.status || 'active');
