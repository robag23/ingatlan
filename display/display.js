
const INTERVAL=10000, root=document.getElementById('display');
function slide(p){
 return `<section class="slide"><div class="photo"><img src="../${p.image}" alt="${p.type}"><div class="tag">${p.badge}</div></div>
 <div class="panel"><div class="location">${p.city} • ${p.location}</div><h1>${p.type}</h1>
 <div class="meta"><span>${p.area}</span><span>${p.rooms}</span>${p.plot?`<span>${p.plot}</span>`:''}</div>
 <div class="price">${p.price}</div><p class="desc">${p.description}</p>
 <div class="contact"><b>☎ +36 70 319 6582</b><br>7900 Szigetvár, József A. utca 35.<br>www.szigetvaringatlan.hu</div></div></section>`;
}
function ad(){
 return `<section class="house-ad"><div><img class="brandimg" src="../assets/images/logo-brand.jpeg" alt="Sziget-Baracsi Ingatlan">
 <h2>Eladná ingatlanát?</h2><p>Helyi tapasztalat. Személyes ügyintézés.</p><div class="big">☎ +36 70 319 6582</div><p>7900 Szigetvár, József A. utca 35.</p></div></section>`;
}
async function init(){
 const r=await fetch('../data/properties.json',{cache:'no-store'}), data=await r.json(), active=data.filter(p=>p.status==='active');
 let html=''; active.forEach((p,i)=>{html+=slide(p); if((i+1)%3===0) html+=ad();}); if(active.length%3!==0) html+=ad();
 root.innerHTML=html+'<div class="progress"></div>';
 const slides=[...root.querySelectorAll('.slide,.house-ad')]; if(!slides.length)return;
 let n=0; slides[0].classList.add('active');
 setInterval(()=>{slides[n].classList.remove('active');n=(n+1)%slides.length;slides[n].classList.add('active')},INTERVAL);
}
init();
