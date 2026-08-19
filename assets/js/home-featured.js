
(function(){
  const root = document.getElementById('homeMiniSlider');
  if(!root) return;

  let items = [];
  let current = 0;

  function priceValue(p){
    if(typeof p.priceValue === 'number') return p.priceValue;
    const digits = String(p.price || '').replace(/[^\d]/g,'');
    return digits ? Number(digits) : 0;
  }

  function render(){
    if(!items.length){
      root.innerHTML = '<div class="mini-placeholder">Jelenleg nincs kiemelt ingatlan.</div>';
      return;
    }

    const p = items[current];
    root.innerHTML = `
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

    current = (current + 1) % items.length;
  }

  fetch('data/properties.json', {cache:'no-store'})
    .then(r => r.json())
    .then(data => {
      items = data
        .filter(p => p.status === 'active' && (p.featured === true || priceValue(p) >= 50000000))
        .sort((a,b) => priceValue(b) - priceValue(a));

      render();
      if(items.length > 1) setInterval(render, 4500);
    })
    .catch(() => {
      root.innerHTML = '<div class="mini-placeholder">Az ajánlatok betöltése nem sikerült.</div>';
    });
})();
