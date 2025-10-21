// public/js/main.js
document.addEventListener('DOMContentLoaded', () => {

  /* ============================
     Mobile drawer (robust)
     ============================ */
  const openBtn = document.getElementById('drawer-open');
  const drawer = document.getElementById('mobile-drawer');
  const drawerPanel = drawer ? drawer.querySelector('.mobile-drawer-panel') : null;
  const closeBtn = document.getElementById('drawer-close');

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.style.display = 'flex';
    drawer.setAttribute('aria-hidden', 'false');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { if (closeBtn) closeBtn.focus(); }, 120);
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.style.display = 'none';
    drawer.setAttribute('aria-hidden', 'true');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (openBtn) openBtn.focus();
  }

  if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); openDrawer(); });
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });

  // click outside panel to close
  if (drawer) drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });

  // close on Escape
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (drawer && drawer.classList.contains('open')) closeDrawer();
      // if lightbox open -> close it (handled later)
      const lb = document.getElementById('lightbox');
      if (lb && lb.style.display === 'flex') closeLightbox();
      const cm = document.getElementById('comments-modal');
      if (cm && cm.style.display === 'flex') closeCommentsModal();
    }
  });

  /* ============================
     Utility helpers
     ============================ */
  function escapeHtml(s){
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function renderStars(rating){
    let out = '';
    for (let i=1;i<=5;i++) out += (i <= rating) ? '<span class="star filled">★</span>' : '<span class="star">☆</span>';
    return out;
  }

  /* ============================
     Lightbox / Gallery (single shared modal)
     - Creates DOM if missing
     - Supports prev/next
     ============================ */
  let galleryImages = []; // current images array of src strings
  let galleryStartIndex = 0;
  let currentGalleryThumbsContainer = null; // optional for syncing
  function ensureLightboxDom(){
    let lb = document.getElementById('lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.style.display = 'none';
    lb.setAttribute('aria-hidden','true');
    lb.innerHTML = `
      <div class="lightbox-inner" role="dialog" aria-modal="true">
        <button id="lightbox-close" class="lightbox-close" aria-label="Close image viewer">✕</button>
        <button id="lightbox-prev" class="lightbox-prev" aria-label="Previous image">‹</button>
        <div class="lightbox-stage">
          <img id="lightbox-img" src="" alt="Image view">
        </div>
        <button id="lightbox-next" class="lightbox-next" aria-label="Next image">›</button>
        <div id="lightbox-thumbs" class="lightbox-thumbs" aria-hidden="false"></div>
      </div>
    `;
    document.body.appendChild(lb);
    return lb;
  }

  function openGalleryModal(images, startIndex = 0, thumbsContainer = null){
    if (!images || !images.length) return;
    galleryImages = images.slice();
    galleryStartIndex = Math.max(0, Math.min(startIndex, images.length-1));
    currentGalleryThumbsContainer = thumbsContainer || null;

    const lb = ensureLightboxDom();
    const img = lb.querySelector('#lightbox-img');
    const thumbs = lb.querySelector('#lightbox-thumbs');
    img.src = galleryImages[galleryStartIndex];
    img.dataset.index = galleryStartIndex;
    // thumbs
    thumbs.innerHTML = galleryImages.map((src, i) => `<img class="light-thumb ${i===galleryStartIndex ? 'active' : ''}" data-index="${i}" src="${src}" alt="thumb">`).join('');
    lb.style.display = 'flex';
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';

    // wire thumb clicks
    Array.from(thumbs.querySelectorAll('.light-thumb')).forEach(t => {
      t.addEventListener('click', (ev) => {
        const idx = parseInt(t.dataset.index,10);
        showGalleryIndex(idx);
      });
    });

    // wire close/prev/next
    const closeBtn = lb.querySelector('#lightbox-close');
    const prevBtn = lb.querySelector('#lightbox-prev');
    const nextBtn = lb.querySelector('#lightbox-next');
    closeBtn && closeBtn.addEventListener('click', closeLightbox);
    prevBtn && prevBtn.addEventListener('click', showPrevFromLightbox);
    nextBtn && nextBtn.addEventListener('click', showNextFromLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  }

  function closeLightbox(){
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.style.display = 'none';
    lb.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }
  function showGalleryIndex(idx){
    const lb = document.getElementById('lightbox'); if (!lb) return;
    idx = Math.max(0, Math.min(idx, galleryImages.length-1));
    const img = lb.querySelector('#lightbox-img');
    const thumbs = lb.querySelector('#lightbox-thumbs');
    img.src = galleryImages[idx];
    img.dataset.index = idx;
    Array.from(thumbs.querySelectorAll('.light-thumb')).forEach((t,i) => t.classList.toggle('active', i===idx));
    // if we have a thumbs container on page, sync active there
    if (currentGalleryThumbsContainer) {
      Array.from(currentGalleryThumbsContainer.querySelectorAll('.thumb-item')).forEach((t,i) => t.classList.toggle('active', i===idx));
    }
  }
  function showNextFromLightbox(){ const idx = parseInt(document.querySelector('#lightbox-img').dataset.index || '0',10); showGalleryIndex((idx+1)%galleryImages.length); }
  function showPrevFromLightbox(){ const idx = parseInt(document.querySelector('#lightbox-img').dataset.index || '0',10); showGalleryIndex((idx-1+galleryImages.length)%galleryImages.length); }

  // wire keyboard for lightbox (left/right handled in global Escape handler above)
  document.addEventListener('keydown', (ev) => {
    const lb = document.getElementById('lightbox'); if (!lb || lb.style.display === 'none') return;
    if (ev.key === 'ArrowRight') showNextFromLightbox();
    if (ev.key === 'ArrowLeft') showPrevFromLightbox();
  });

  // If user clicks a .card thumb or .card a (index) open gallery with the card's data-images
  document.addEventListener('click', (e) => {
  const cardThumb = e.target.closest('.card .thumb') || e.target.closest('.card .thumb img');
  if (cardThumb) {
    const card = cardThumb.closest('.card');
    if (!card) return;
    const data = card.dataset.images;
    let imgs = [];
    try { imgs = JSON.parse(data || '[]'); } catch (err) { imgs = []; }
    if (imgs.length) {
      // try to find the thumbs container matching templates
      const thumbsContainer = card.querySelector('.gallery-thumbs') || card.querySelector('.thumbs') || card.querySelector('.thumbs-inline') || null;
      openGalleryModal(imgs, 0, thumbsContainer);
    }
  }

    // if any element has data-gallery attribute with JSON
     const galleryTrigger = e.target.closest('[data-gallery]');
  if (galleryTrigger) {
    let imgs = [];
    try { imgs = JSON.parse(galleryTrigger.dataset.gallery || '[]'); } catch(err) { imgs = []; }
    const idx = parseInt(galleryTrigger.datasetIndex || galleryTrigger.dataset.index || galleryTrigger.dataset['index'] || '0', 10);
    if (imgs.length) {
      const thumbsContainer = galleryTrigger.closest('.card') ? galleryTrigger.closest('.card').querySelector('.gallery-thumbs') : null;
      openGalleryModal(imgs, idx, thumbsContainer);
    }
  }
});


  /* ============================
     Listing detail thumbnails -> main image + lightbox open
     (Assumes markup: #gallery-thumbs .thumb-item[data-src="..."] and #gallery-main img)
     ============================ */
  const thumbsContainer = document.getElementById('gallery-thumbs');
  const mainImage = document.getElementById('gallery-main');

  let detailImages = [];
  if (thumbsContainer) {
    const thumbItems = Array.from(thumbsContainer.querySelectorAll('.thumb-item'));
    detailImages = thumbItems.map(t => t.getAttribute('data-src'));
    thumbItems.forEach((t, idx) => {
      t.addEventListener('click', () => {
        const src = t.getAttribute('data-src');
        if (!src) return;
        if (mainImage) {
          mainImage.src = src;
          mainImage.dataset.currentIndex = idx;
        }
        thumbItems.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        t.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      });
      t.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t.click(); }});
    });
    if (!thumbItems.some(t => t.classList.contains('active')) && thumbItems[0]) thumbItems[0].classList.add('active');
    if (mainImage) {
      mainImage.addEventListener('click', () => {
        const idx = parseInt(mainImage.dataset.currentIndex || '0', 10);
        openGalleryModal(detailImages, idx, thumbsContainer);
      });
    }
  } else {
    // single main image case
    if (mainImage) {
      mainImage.addEventListener('click', () => {
        const src = mainImage.src;
        if (src) openGalleryModal([src], 0, null);
      });
    }
  }

  /* ============================
     Comments modal (index + detail)
     - Creates DOM once, fetches /reviews/:listingId
     - Renders threaded replies
     ============================ */

  // create comments modal DOM lazily
  function ensureCommentsModal(){
    let modal = document.getElementById('comments-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'comments-modal';
    modal.className = 'comments-modal';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML = `
      <div class="comments-dialog" role="dialog" aria-modal="true">
        <button id="comments-close" class="comments-close" aria-label="Close comments">✕</button>
        <div class="comments-inner">
          <header class="comments-header">
            <h3 id="comments-title">Comments</h3>
            <small id="comments-sub"></small>
          </header>
          <div id="comments-body" class="comments-body"></div>
          <div class="comments-post" id="comments-post-area"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // close wiring
    modal.querySelector('#comments-close').addEventListener('click', closeCommentsModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeCommentsModal(); });
    return modal;
  }

  function openCommentsModal(listingId, listingTitle){
    const modal = ensureCommentsModal();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
    document.getElementById('comments-title').textContent = listingTitle || 'Comments';
    document.getElementById('comments-sub').textContent = `Listing #${listingId}`;
    modal.dataset.listingId = listingId;
    document.body.style.overflow = 'hidden';
    loadComments(listingId);
  }

  function closeCommentsModal(){
    const modal = document.getElementById('comments-modal'); if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    document.getElementById('comments-body').innerHTML = '';
    document.getElementById('comments-post-area').innerHTML = '';
    document.body.style.overflow = '';
  }

  async function loadComments(listingId){
    const body = document.getElementById('comments-body');
    const postArea = document.getElementById('comments-post-area');
    body.innerHTML = '<p>Loading...</p>';
    postArea.innerHTML = '';

    try {
      const res = await fetch(`/reviews/${listingId}`);
      const json = await res.json();
      if (!json.ok) { body.innerHTML = `<p class="error">${json.error || 'Unable to load comments'}</p>`; return; }

      if (!json.reviews || json.reviews.length === 0) {
        body.innerHTML = '<p>No comments yet.</p>';
      } else {
        body.innerHTML = json.reviews.map(r => renderTopLevelReview(r)).join('');
        // wire reply buttons
        Array.from(body.querySelectorAll('.reply-btn')).forEach(btn => {
          btn.addEventListener('click', () => {
            const parentId = btn.dataset.parentId;
            showReplyForm(parentId);
          });
        });
      }

      // Post form (if logged in)
      if (window.APP_USER && window.APP_USER.id) {
        postArea.innerHTML = `
          <form id="post-review-form" class="review-form-ajax">
            <input type="hidden" name="listing_id" value="${listingId}">
            <label>
              Rating
              <select name="rating" required>
                <option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>
              </select>
            </label>
            <label>
              Comment
              <textarea name="comment" rows="3" required></textarea>
            </label>
            <button type="submit">Post comment</button>
          </form>
        `;
        document.getElementById('post-review-form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const f = ev.target;
          const fd = new FormData(f);
          const payload = {};
          fd.forEach((v,k) => payload[k]=v);
          try {
            const r = await fetch('/reviews', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            const j = await r.json();
            if (j.ok) { loadComments(listingId); } else { alert(j.error || 'Unable to post'); }
          } catch (err) { console.error(err); alert('Network error'); }
        });
      } else {
        postArea.innerHTML = `<p><a href="/auth/login">Sign in</a> to post a comment</p>`;
      }

    } catch (err) {
      console.error('loadComments error', err);
      body.innerHTML = '<p>Error loading comments</p>';
    }
  }

  function renderTopLevelReview(r){
    const repliesHtml = (r.replies || []).map(rep => `
      <div class="reply-item">
        <div class="reply-head"><strong>${escapeHtml(rep.name)}</strong> <small>${new Date(rep.created_at).toLocaleString()}</small></div>
        <div class="reply-body">${escapeHtml(rep.comment)}</div>
      </div>
    `).join('');
    return `
      <div class="comment-item" id="review-${r.id}">
        <div class="comment-head">
          <div><strong>${escapeHtml(r.name)}</strong></div>
          <div><small>${new Date(r.created_at).toLocaleString()}</small></div>
        </div>
        <div class="comment-rating">${renderStars(r.rating)}</div>
        <div class="comment-body">${escapeHtml(r.comment)}</div>
        <div class="comment-actions">
          <button class="reply-btn" data-parent-id="${r.id}">Reply</button>
          <button class="view-all-replies-btn" data-parent-id="${r.id}">${(r.replies && r.replies.length) ? 'View replies (' + r.replies.length + ')' : 'No replies'}</button>
        </div>
        <div class="replies">${repliesHtml}</div>
      </div>
    `;
  }

  function showReplyForm(parentId){
    if (!window.APP_USER || !window.APP_USER.id) { alert('Sign in to reply'); window.location = '/auth/login'; return; }
    const el = document.getElementById(`review-${parentId}`);
    if (!el) return;
    if (el.querySelector('.reply-form-ajax')) return;
    const fwrap = document.createElement('div');
    fwrap.innerHTML = `
      <form class="reply-form-ajax" data-parent-id="${parentId}">
        <input type="hidden" name="listing_id" value="${document.getElementById('comments-modal').dataset.listingId}">
        <input type="hidden" name="parent_id" value="${parentId}">
        <label>
          Reply
          <textarea name="comment" rows="2" required></textarea>
        </label>
        <button type="submit">Reply</button>
      </form>
    `;
    el.appendChild(fwrap);
    const form = el.querySelector('.reply-form-ajax');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = {};
      fd.forEach((v,k)=>payload[k]=v);
      try {
        const r = await fetch('/reviews/reply', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const j = await r.json();
        if (j.ok) loadComments(document.getElementById('comments-modal').dataset.listingId);
        else alert(j.error || 'Unable to post reply');
      } catch(err){ console.error(err); alert('Network error'); }
    });
  }

  // delegate click: .view-comments-btn should have data-listing-id and data-listing-title
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-comments-btn');
    if (btn) {
      const listingId = btn.dataset.listingId;
      const title = btn.dataset.listingTitle || btn.dataset.listingTitleRaw || 'Comments';
      openCommentsModal(listingId, title);
      return;
    }
  });

  /* ============================
     Preload states JSON for create listing form
     ============================ */
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

  /* ============================
     AJAX simple review form fallback (pages that have .review-form)
     - keeps compatibility with non-modal forms
     ============================ */
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

  /* ============================
     Image size validation on listing create
     ============================ */
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

  /* ============================
     Helper: expose closeLightbox & closeCommentsModal to global (optional)
     ============================ */
  window.closeLightbox = closeLightbox;
  window.openGalleryModal = openGalleryModal;
  window.openCommentsModal = openCommentsModal;
  window.closeCommentsModal = closeCommentsModal;


  /* ============================
     Checkout live total
     - updates/creates #estimated-total near booking checkout form
     - supports base price pulled from #listing-price (text), or hidden input[name="base_price"]
     - listens to start/end date, laundry/food checkboxes and provider selects
     ============================ */
  (function setupCheckoutLiveTotal(){
    const form = document.querySelector('form[action="/payments/initiate"]');
    if (!form) return;

    // helpers to read base price
    function parseNumber(str, fallback=0) {
      if (str === null || typeof str === 'undefined') return fallback;
      const cleaned = String(str).replace(/[^\d.-]/g,'').trim();
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : fallback;
    }

    // try hidden base_price input first
    const basePriceInput = form.querySelector('input[name="base_price"]');
    // fallback: element with id listing-price (innerText contains price)
    const listingPriceEl = document.getElementById('listing-price');

    // service prices from server-injected JS/data or data attributes
    const laundryPriceAttr = parseFloat(form.dataset.laundryPrice || window.LAUNDRY_PRICE || (typeof LAUNDRY_PRICE !== 'undefined' ? LAUNDRY_PRICE : NaN));
    const foodPriceAttr = parseFloat(form.dataset.foodPrice || window.FOOD_PRICE || (typeof FOOD_PRICE !== 'undefined' ? FOOD_PRICE : NaN));
    const laundryPrice = Number.isFinite(laundryPriceAttr) ? laundryPriceAttr : parseNumber(null, 3000);
    const foodPrice = Number.isFinite(foodPriceAttr) ? foodPriceAttr : parseNumber(null, 2000);

    // UI: estimated total container (create if missing)
    let est = document.getElementById('estimated-total');
    if (!est) {
      est = document.createElement('div');
      est.id = 'estimated-total';
      est.style.padding = '8px';
      est.style.borderTop = '1px solid #eee';
      est.style.marginTop = '10px';
      // insert before submit button or at end of form
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && submitBtn.parentNode) submitBtn.parentNode.insertBefore(est, submitBtn);
      else form.appendChild(est);
    }

    // fields
    const startInput = form.querySelector('input[name="startDate"]');
    const endInput = form.querySelector('input[name="endDate"]');
    const laundryCheckbox = form.querySelector('input[name="laundry"]');
    const foodCheckbox = form.querySelector('input[name="food"]');
    const laundryProviderSelect = form.querySelector('select[name="laundry_provider_id"]');
    const foodProviderSelect = form.querySelector('select[name="food_provider_id"]');

    function getBasePrice() {
      if (basePriceInput && basePriceInput.value) return parseNumber(basePriceInput.value, 0);
      if (listingPriceEl && listingPriceEl.textContent) return parseNumber(listingPriceEl.textContent, 0);
      // also check if server injected a data-base-price attribute on form
      if (form.dataset.basePrice) return parseNumber(form.dataset.basePrice, 0);
      return 0;
    }

    function computeNights() {
      const s = startInput && startInput.value ? new Date(startInput.value) : null;
      const e = endInput && endInput.value ? new Date(endInput.value) : null;
      if (!s || !e) return 1;
      const msInDay = 24*60*60*1000;
      const diff = Math.round(Math.abs(e - s) / msInDay);
      return Math.max(1, diff);
    }

    function updateEstimate() {
      const base = getBasePrice();
      const nights = computeNights();
      let total = Number(base) * nights;

      let services = [];
      if (laundryCheckbox && laundryCheckbox.checked) {
        total += laundryPrice;
        services.push({name:'Laundry', price: laundryPrice});
      } else if (laundryProviderSelect && laundryProviderSelect.value) {
        // provider selected but checkbox not checked — treat provider selection as opted in
        total += laundryPrice;
        services.push({name:'Laundry', price: laundryPrice});
      }

      if (foodCheckbox && foodCheckbox.checked) {
        total += foodPrice;
        services.push({name:'Food', price: foodPrice});
      } else if (foodProviderSelect && foodProviderSelect.value) {
        total += foodPrice;
        services.push({name:'Food', price: foodPrice});
      }

      // render
      const parts = [];
      parts.push(`<strong>Estimated total:</strong> ₦${Number(total).toFixed(2)} (${nights} ${nights===1 ? 'night' : 'nights'})`);
      if (services.length) {
        parts.push('<div style="margin-top:6px"><small>Includes: ' + services.map(s => `${s.name} ₦${Number(s.price).toFixed(2)}`).join(', ') + '</small></div>');
      }
      est.innerHTML = parts.join('');
    }

    // wire change events
    [startInput, endInput, laundryCheckbox, foodCheckbox, laundryProviderSelect, foodProviderSelect].forEach(el => {
      if (!el) return;
      el.addEventListener('change', updateEstimate);
      el.addEventListener('input', updateEstimate);
    });

    // initial compute
    updateEstimate();

    // prevent invalid date submission (basic check)
    form.addEventListener('submit', (e) => {
      const sVal = startInput && startInput.value ? new Date(startInput.value) : null;
      const eVal = endInput && endInput.value ? new Date(endInput.value) : null;
      if (sVal && eVal && eVal < sVal) {
        e.preventDefault();
        alert('End date must be the same or after start date.');
        return false;
      }
    });
  })();


  /* ============================
     Paystack inline (popup) integration for listing fee payment
     - form should have id="listing-paystack-form"
     - the server endpoint POST /payments/listing-initiate should accept JSON fetch and
       return JSON like { status:true, data: { authorization_url, reference, amount } }
     - PAYSTACK_PUBLIC_KEY should be exposed to client (window.PAYSTACK_PUBLIC_KEY) or
       set as data-paystack-key attribute on the form.
     ============================ */
  (function setupPaystackInline(){
    const payForm = document.getElementById('listing-paystack-form');
    if (!payForm) return;

    // determine public key
    const formKey = payForm.dataset.paystackKey || null;
    const globalKey = window.PAYSTACK_PUBLIC_KEY || null;
    const PAYSTACK_KEY = formKey || globalKey;
    if (!PAYSTACK_KEY) {
      console.warn('Paystack public key not found on form or window.PAYSTACK_PUBLIC_KEY. Inline flow disabled.');
      return;
    }

    // ensure paystack script loaded (load if missing)
    function loadPaystackScript() {
      return new Promise((resolve, reject) => {
        if (window.PaystackPop) return resolve(window.PaystackPop);
        const s = document.createElement('script');
        s.src = 'https://js.paystack.co/v1/inline.js';
        s.async = true;
        s.onload = () => resolve(window.PaystackPop);
        s.onerror = () => reject(new Error('Failed to load Paystack script'));
        document.head.appendChild(s);
      });
    }

    payForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      // gather form data
      const fd = new FormData(payForm);
      const payload = {};
      fd.forEach((v,k)=>payload[k]=v);

      // Request server to initialize transaction and return init data as JSON
      // Server should detect Accept: application/json and return JSON instead of redirect.
      let initJson = null;
      try {
        const res = await fetch(payForm.action || '/payments/listing-initiate', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            // no content-type here because we're sending form-like object, convert to JSON:
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // If server responds with JSON, parse it. If 200 with redirect, fall back to normal submit.
        const txt = await res.text();
        try {
          initJson = JSON.parse(txt);
        } catch (err) {
          initJson = null;
        }

        if (!initJson || !initJson.status || !initJson.data) {
          // fallback: maybe server redirected; just submit the form traditionally
          // this preserves existing behavior if server hasn't been adjusted.
          return payForm.submit();
        }
      } catch (err) {
        console.error('Could not initialize Paystack transaction', err);
        // fallback to normal submit
        return payForm.submit();
      }

      // initJson.data should contain { authorization_url, reference, amount }
      const init = initJson.data;
      const amountKobo = init.amount || (initJson.amount || 0); // amount in kobo expected
      const amountNaira = (amountKobo && amountKobo > 1000) ? (amountKobo/100) : (initJson.amountNaira || null);

      // load paystack script and open inline popup
      try {
        await loadPaystackScript();
      } catch (err) {
        console.error('Paystack script load failed', err);
        return payForm.submit(); // fallback
      }

      // set email: prefer server-provided metadata or logged-in user's email from DOM
      const email = initJson.email || payload.email || (window.APP_USER && window.APP_USER.email) || 'no-reply@yourdomain.com';
      const reference = init.reference || initJson.reference || (`listing-${payload.listingId || 'unknown'}-${Date.now()}`);

      // open Paystack inline
      try {
        const handler = window.PaystackPop.setup({
          key: PAYSTACK_KEY,
          email: email,
          amount: amountKobo || Math.round((amountNaira || 0) * 100), // in kobo
          ref: reference,
          metadata: init.metadata || { listingId: Number(payload.listingId), period: payload.period },
          onClose: function() {
            // user closed popup — you can optionally notify them
            console.info('Paystack checkout closed by user');
          },
          callback: function(response) {
            // response.reference available — verify on server and then redirect or show success
            // best practice: call server verify endpoint (or redirect to a server callback page)
            // We'll redirect to a server callback page that verifies and returns res to user:
            const verifyUrl = `/payments/listing-callback?reference=${encodeURIComponent(response.reference)}`;
            window.location = verifyUrl;
          }
        });
        handler.openIframe();
      } catch (err) {
        console.error('Paystack open failed', err);
        return payForm.submit(); // fallback
      }
    });
  })();

}); // DOMContentLoaded
