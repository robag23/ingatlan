(function(){
  const root = document.getElementById('homeMiniSlider');
  if(!root) return;

  const SLIDE_DURATION = 6500;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let items = [];
  let current = 0;
  let effectIndex = 0;

  const effects = ['fade','slide-left','slide-right','slide-up','zoom','tilt','wipe'];

  function priceValue(p){
    if(typeof p.priceValue === 'number') return p.priceValue;
    const digits = String(p.price || '').replace(/[^\d]/g,'');
    return digits ? Number(digits) : 0;
  }

  function markup(p){
    return `
      <a class="mini-property" href="${p.url}" target="_blank" rel="noopener">
        <div class="mini-property-image">
          <img src="${p.image}" alt="${p.city} – ${p.type}">
          <span class="mini-badge">${p.badge || 'KIEMELT'}</span>
        </div>
        <div class="mini-property-body">
          <div class="mini-location">${p.city}${p.location ? ' • ' + p.location : ''}</div>
          <h3>${p.type}</h3>
          <div class="mini-meta">
            ${p.area ? `<span>${p.area}</span>` : ''}
            ${p.rooms && p.rooms !== '—' ? `<span>${p.rooms}</span>` : ''}
          </div>
          <div class="mini-price">${p.price}</div>
        </div>
      </a>`;
  }

  function frames(effect, entering){
    const start = {
      fade:        {opacity:0},
      'slide-left':{opacity:0, transform:'translateX(12%)'},
      'slide-right':{opacity:0, transform:'translateX(-12%)'},
      'slide-up':  {opacity:0, transform:'translateY(10%)'},
      zoom:        {opacity:0, transform:'scale(.92)'},
      tilt:        {opacity:0, transform:'perspective(900px) rotateY(9deg) scale(.97)'},
      wipe:        {opacity:1, clipPath:'inset(0 100% 0 0)'}
    }[effect] || {opacity:0};

    const end = {opacity:1, transform:'none', clipPath:'inset(0 0 0 0)'};

    if(entering) return [start, end];

    const out = {
      fade:        {opacity:0},
      'slide-left':{opacity:0, transform:'translateX(-8%)'},
      'slide-right':{opacity:0, transform:'translateX(8%)'},
      'slide-up':  {opacity:0, transform:'translateY(-7%)'},
      zoom:        {opacity:0, transform:'scale(1.035)'},
      tilt:        {opacity:0, transform:'perspective(900px) rotateY(-7deg) scale(.98)'},
      wipe:        {opacity:0, clipPath:'inset(0 0 0 100%)'}
    }[effect] || {opacity:0};

    return [end, out];
  }

  async function render(animated = true){
    if(!items.length){
      root.innerHTML = '<div class="mini-placeholder">Jelenleg nincs kiemelt ingatlan.</div>';
      return;
    }

    const p = items[current];
    const oldCard = root.querySelector('.mini-property');
    const effect = effects[effectIndex % effects.length];
    effectIndex++;

    if(animated && oldCard && !reduceMotion){
      try{
        await oldCard.animate(frames(effect, false), {
          duration: 360,
          easing: 'cubic-bezier(.4,0,.2,1)',
          fill: 'forwards'
        }).finished;
      }catch(e){}
    }

    root.innerHTML = markup(p);
    const newCard = root.querySelector('.mini-property');

    if(animated && newCard && !reduceMotion){
      newCard.animate(frames(effect, true), {
        duration: 760,
        easing: 'cubic-bezier(.16,1,.3,1)',
        fill: 'both'
      });
    }

    current = (current + 1) % items.length;
  }

  fetch('data/properties.json', {cache:'no-store'})
    .then(r => r.json())
    .then(data => {
      items = data
        .filter(p => p.status === 'active' && (p.featured === true || priceValue(p) >= 50000000))
        .sort((a,b) => priceValue(b) - priceValue(a));

      render(false);
      if(items.length > 1) setInterval(() => render(true), SLIDE_DURATION);
    })
    .catch(() => {
      root.innerHTML = '<div class="mini-placeholder">Az ajánlatok betöltése nem sikerült.</div>';
    });
})();
