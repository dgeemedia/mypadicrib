// public/js/main.js
(() => {
  // mobile drawer
  const openBtn = document.getElementById('drawer-open');
  const drawer = document.getElementById('mobile-drawer');
  const closeBtn = document.getElementById('drawer-close');
  if (openBtn && drawer) {
    openBtn.addEventListener('click', () => { drawer.style.display='block'; drawer.setAttribute('aria-hidden','false'); });
    closeBtn && closeBtn.addEventListener('click', () => { drawer.style.display='none'; drawer.setAttribute('aria-hidden','true'); });
    drawer.addEventListener('click', (e) => { if (e.target === drawer) { drawer.style.display='none'; }});
  }

  // gallery modal (open first image preview -> show modal with all images)
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.matches('.thumb img') || target.closest('.thumb')) {
      const card = target.closest('.card');
      if (!card) return;
      const imagesData = card.dataset.images; // JSON string
      let images = [];
      try { images = JSON.parse(imagesData || '[]'); } catch (err) { images = []; }
      openGallery(images);
    }
    if (target.matches('.gallery-close')) closeGallery();
  });

  function openGallery(images){
    if (!images || images.length === 0) return;
    let modal = document.getElementById('gallery-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'gallery-modal';
      modal.className = 'gallery-modal';
      modal.innerHTML = `
        <div class="gallery-inner" role="dialog" aria-modal="true">
          <button class="gallery-close" style="float:right;border:none;background:none;font-size:20px">✕</button>
          <img id="gallery-main" src="" alt="gallery">
          <div id="gallery-thumbs" style="display:flex;gap:6px;margin-top:8px;overflow:auto"></div>
        </div>`;
      document.body.appendChild(modal);
    }
    const main = modal.querySelector('#gallery-main');
    const thumbs = modal.querySelector('#gallery-thumbs');
    main.src = images[0];
    thumbs.innerHTML = images.map(src => `<img src="${src}" style="width:80px;height:60px;object-fit:cover;cursor:pointer" />`).join('');
    Array.from(thumbs.children).forEach((el, idx) => {
      el.addEventListener('click', () => main.src = images[idx]);
    });
    modal.style.display='flex';
  }
  function closeGallery(){ const m = document.getElementById('gallery-modal'); if (m) m.style.display='none'; }

  // image file size validation on create listing form
  const listingForm = document.querySelector('form[action="/listings/new"]');
  if (listingForm) {
    const maxMb = parseFloat((document.querySelector('input[name="MAX_IMAGE_MB"]') || {value: null}).value) || (window.MAX_IMAGE_MB || 5);
    listingForm.addEventListener('submit', (e) => {
      const files = listingForm.querySelector('input[type="file"][name="images"]').files;
      if (!files) return;
      for (let f of files) {
        const mb = f.size / (1024*1024);
        if (mb > maxMb) {
          e.preventDefault();
          alert(`Image ${f.name} is ${mb.toFixed(2)}MB — max allowed is ${maxMb}MB`);
          return false;
        }
      }
    });
  }

  // preload locations/Nigeria-state.json into create listing form
  (async function loadStates(){
    const stateSel = document.getElementById('state-select');
    const lgaSel = document.getElementById('lga-select');
    if (!stateSel) return;
    try {
      const res = await fetch('/locations/Nigeria-state.json');
      const data = await res.json();
      window._STATES = data;
      const states = Object.keys(data);
      stateSel.innerHTML = '<option value="">Select state</option>' + states.map(s => `<option value="${s}">${s}</option>`).join('');
      stateSel.addEventListener('change', () => {
        const lg = data[stateSel.value] || [];
        lgaSel.innerHTML = '<option value="">Select LGA</option>' + lg.map(l => `<option value="${l}">${l}</option>`).join('');
      });
    } catch (err) {
      console.error('Failed to load states', err);
    }
  })();

  // AJAX submit review
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form.matches('.review-form')) return;
    e.preventDefault();
    const url = form.action;
    const fd = new FormData(form);
    const body = {};
    fd.forEach((v,k) => body[k]=v);
    try {
      const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)});
      const data = await res.json();
      if (data.ok) {
        location.reload(); // quick: reload to fetch new review
      } else {
        alert(data.error || 'Unable to post review');
      }
    } catch (err) {
      console.error(err);
      alert('Network error posting review');
    }
  });

})();
