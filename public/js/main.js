// public/js/main.js
document.addEventListener('DOMContentLoaded', () => {

  // ---------- Mobile drawer (robust and DOM-safe) ----------
  const openBtn = document.getElementById('drawer-open');
  const drawer = document.getElementById('mobile-drawer');
  const drawerPanel = drawer ? drawer.querySelector('.mobile-drawer-panel') : null;
  const closeBtn = document.getElementById('drawer-close');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    // focus on close button for accessibility
    setTimeout(() => { if (closeBtn) closeBtn.focus(); }, 120);
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (openBtn) openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });

  // close when clicking outside panel
  if (drawer) drawer.addEventListener('click', (e) => {
    if (e.target === drawer) closeDrawer();
  });

  // close on Escape
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && drawer && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  // ---------- Listing detail gallery (unchanged logic) ----------
  const thumbsContainer = document.getElementById('gallery-thumbs');
  const mainImage = document.getElementById('gallery-main');

  let images = [];
  if (thumbsContainer) {
    const thumbItems = Array.from(thumbsContainer.querySelectorAll('.thumb-item'));
    images = thumbItems.map(t => t.getAttribute('data-src'));
    thumbItems.forEach((t, idx) => {
      t.addEventListener('click', () => {
        const src = t.getAttribute('data-src');
        if (!src) return;
        setMainImage(src, idx);
        thumbItems.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        t.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      });
      t.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t.click(); }});
    });
    if (!thumbItems.some(t => t.classList.contains('active')) && thumbItems[0]) thumbItems[0].classList.add('active');
  } else {
    images = mainImage ? [mainImage.src] : [];
  }

  function setMainImage(src, index) {
    if (!mainImage) return;
    mainImage.src = src;
    mainImage.dataset.currentIndex = (typeof index === 'number') ? index : images.indexOf(src);
  }

  if (mainImage) {
    mainImage.addEventListener('click', () => {
      const idx = parseInt(mainImage.dataset.currentIndex || '0', 10);
      openLightbox(idx);
    });
  }

  // ---------- Lightbox ----------
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbClose = document.getElementById('lightbox-close');
  const lbPrev = document.getElementById('lightbox-prev');
  const lbNext = document.getElementById('lightbox-next');

  let currentIndex = 0;
  function openLightbox(startIndex) {
    if (!lbImg || !images || images.length === 0) return;
    currentIndex = (typeof startIndex === 'number') ? startIndex : 0;
    currentIndex = Math.max(0, Math.min(currentIndex, images.length - 1));
    lbImg.src = images[currentIndex];
    if (lightbox) { lightbox.style.display = 'flex'; lightbox.setAttribute('aria-hidden', 'false'); }
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.style.display = 'none';
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function showNext() {
    if (!images || images.length === 0) return;
    currentIndex = (currentIndex + 1) % images.length;
    lbImg.src = images[currentIndex];
    syncActiveThumb();
  }
  function showPrev() {
    if (!images || images.length === 0) return;
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    lbImg.src = images[currentIndex];
    syncActiveThumb();
  }

  function syncActiveThumb() {
    if (!thumbsContainer) return;
    const thumbItems = Array.from(thumbsContainer.querySelectorAll('.thumb-item'));
    thumbItems.forEach((t, idx) => t.classList.toggle('active', idx === currentIndex));
    const active = thumbItems[currentIndex];
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    if (mainImage) mainImage.src = images[currentIndex];
    if (mainImage) mainImage.dataset.currentIndex = currentIndex;
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbNext) lbNext.addEventListener('click', showNext);
  if (lbPrev) lbPrev.addEventListener('click', showPrev);
  if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', (ev) => {
    if (!lightbox || lightbox.style.display === 'none') return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowRight') showNext();
    if (ev.key === 'ArrowLeft') showPrev();
  });

  // ---------- Preload states, review AJAX, image size check ----------
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
    } catch (err) { console.error('Failed to load states', err); }
  })();

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
        location.reload();
      } else {
        alert(data.error || 'Unable to post review');
      }
    } catch (err) {
      console.error(err);
      alert('Network error posting review');
    }
  });

  const listingForm = document.querySelector('form[action="/listings/new"]');
  if (listingForm) {
    const maxMb = (window.APP_CONFIG && window.APP_CONFIG.MAX_IMAGE_MB) ? parseFloat(window.APP_CONFIG.MAX_IMAGE_MB) : 5;
    listingForm.addEventListener('submit', (e) => {
      const input = listingForm.querySelector('input[type="file"][name="images"]');
      if (!input || !input.files) return;
      for (let f of input.files) {
        const mb = f.size / (1024*1024);
        if (mb > maxMb) {
          e.preventDefault();
          alert(`Image ${f.name} is ${mb.toFixed(2)}MB — max allowed is ${maxMb}MB`);
          return false;
        }
      }
    });
  }

}); // DOMContentLoaded
