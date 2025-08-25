document.addEventListener('DOMContentLoaded', () => {
  const TEAMS_DATA_PLACEHOLDER = '{{TEAMS_DATA}}';
  const CONFIG_DATA_PLACEHOLDER = '{{CONFIG_DATA}}';

  let teams = [];
  let config = {};

  // Placeholder replacement (build time injects JSON)
  try {
    teams = TEAMS_DATA_PLACEHOLDER;
    config = CONFIG_DATA_PLACEHOLDER;
  } catch (e) {
    // Fallback fetch for dev
    Promise.all([
      fetch('../teams.yaml').then(r=>r.text()).then(t=>jsyaml.load(t).teams),
      fetch('../config.yaml').then(r=>r.text()).then(t=>jsyaml.load(t))
    ]).then(([t,c])=>{ teams=t; config=c; init(); }).catch(console.error);
    return;
  }
  init();

  function init(){
    const container = document.getElementById('resultsContainer');
    if(!container){ return; }
    if(!config.show_results){
      container.innerHTML = '<p class="text-sm md:text-base text-gray-600">Results are not yet available.</p>';
      return;
    }
    // Filter teams having percent value, treat missing as 0
    teams.forEach(t=>{ if(typeof t.public_vote_percent !== 'number') t.public_vote_percent = 0; });
    // Sort by percent desc
    teams.sort((a,b)=> b.public_vote_percent - a.public_vote_percent);

    renderChart(teams);
    renderWinnersGallery(teams);
    setupModal();
  }

  function renderChart(data){
    const chartWrap = document.getElementById('resultsChart');
    if(!chartWrap) return;
    const total = data.reduce((s,t)=> s + (t.public_vote_percent||0), 0) || 1;
    // Create SVG pie
    const size = 220; const radius = size/2; const cx = radius; const cy = radius; const strokeW = radius;
    let cumulative = 0;
    const svgParts = [];
    data.forEach((t,i)=>{
      const val = t.public_vote_percent || 0;
      const frac = val/total;
      const dash = 2 * Math.PI * radius * frac;
      const gap = 2 * Math.PI * radius - dash;
      const hue = 0; // keep mono; vary lightness
      const light = 20 + Math.round(65 * (1 - i/(data.length||1)));
      svgParts.push(`<circle r="${radius}" cx="${cx}" cy="${cy}" fill="transparent" stroke="hsl(0,0%,${light}%)" stroke-width="${strokeW}" stroke-dasharray="${dash} ${gap}" transform="rotate(${(cumulative*360)-90} ${cx} ${cy})" />`);
      cumulative += frac;
    });
    chartWrap.innerHTML = `<div class="mono-pie inline-block relative"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svgParts.join('')}</svg><div class="absolute inset-0 flex items-center justify-center text-xs font-bold tracking-wide">VOTES</div></div>`;

    const legend = document.getElementById('resultsLegend');
    if(legend){
      legend.innerHTML = data.slice(0,10).map((t,i)=>{
        const light = 20 + Math.round(65 * (1 - i/(data.length||1)));
        return `<div class="flex items-center gap-2 text-xs md:text-sm"><span class="w-4 h-4 inline-block border border-black" style="background:hsl(0,0%,${light}%);"></span><span class="font-mono">${i+1}.</span> <span>${escapeHTML(t.teamName)}</span> <span class="ml-auto font-mono">${t.public_vote_percent.toFixed(1)}%</span></div>`;
      }).join('');
    }
  }

  function renderWinnersGallery(data){
    const gallery = document.getElementById('resultsGallery');
    if(!gallery) return;
    gallery.innerHTML = data.map((t,i)=>{
      const img = (t.images && t.images[0]) || '';
      const rank = i+1;
      const borderShade = 0 + Math.min(90, rank*10);
      const tag = rank <=3 ? `Winner #${rank}` : `Finalist #${rank}`;
      return `<div class="winner-card cursor-pointer" data-index="${i}" style="border:2px solid hsl(0,0%,${borderShade}%);">
        <div class="winner-badge">${tag}</div>
        <div class="winner-img-wrapper"><img src="${img}" alt="${escapeHTML(t.teamName)}" /></div>
        <div class="winner-meta">
          <h3 class="winner-name">${escapeHTML(t.teamName)}</h3>
          <p class="winner-percent font-mono text-xs">${t.public_vote_percent.toFixed(1)}%</p>
        </div>
      </div>`;
    }).join('');
  }

  function setupModal(){
    const modal = document.getElementById('resultImageModal');
    if(!modal) return;
    const modalImg = document.getElementById('resultModalImage');
    const modalName = document.getElementById('resultModalTeam');
    const modalPercent = document.getElementById('resultModalPercent');
    const closeBtn = document.getElementById('closeResultModal');

    document.getElementById('resultsGallery').addEventListener('click', (e)=>{
      const card = e.target.closest('.winner-card');
      if(!card) return;
      const idx = parseInt(card.getAttribute('data-index'),10);
      const team = teams[idx];
      modalImg.src = (team.images && team.images[0]) || '';
      modalName.textContent = team.teamName;
      modalPercent.textContent = (team.public_vote_percent||0).toFixed(1)+'%';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });

    closeBtn.addEventListener('click', ()=>{
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
    modal.addEventListener('click', (e)=>{ if(e.target === modal) closeBtn.click(); });
  }

  function escapeHTML(str){
    return (str||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));
  }
});
