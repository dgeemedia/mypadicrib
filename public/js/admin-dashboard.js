// public/js/admin-dashboard.js
// Admin dashboard client-side behaviors
// - Defensive normalization for user rows
// - Client-side filtering + pagination for Managed Listings and Users
// - Accessible modal to collect reason/until-date for admin actions
// - Replaces prompt flows with modal (falls back to prompt() if modal missing)

document.addEventListener('DOMContentLoaded', function () {
  /* ============================
     Defensive normalization (users)
     Ensures each user <tr> has data-user-id, data-role and data-status
     This runs early so managers can rely on attributes even if EJS didn't emit them.
     ============================ */
  (function normalizeUserRows() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    Array.from(tbody.querySelectorAll('tr')).forEach((tr) => {
      // ensure user id
      if (!tr.dataset.userId) {
        const maybeId = tr.getAttribute('data-user-id') || tr.getAttribute('data-userid') ||
                        (tr.querySelector('form[data-user-id]') && tr.querySelector('form[data-user-id]').dataset.userId);
        if (maybeId) tr.dataset.userId = String(maybeId);
      }

      // role: prefer data-role, fall back to role cell text, else default to 'owner'
      if (!tr.dataset.role || tr.dataset.role.trim() === '') {
        // attempt to read the "Role" column (common markup: 4th cell)
        let roleCandidate = '';
        if (tr.cells && tr.cells.length >= 4) {
          roleCandidate = (tr.cells[3].textContent || '').toLowerCase();
        } else {
          roleCandidate = (tr.textContent || '').toLowerCase();
        }
        if (roleCandidate.indexOf('admin') !== -1) tr.dataset.role = 'admin';
        else if (roleCandidate.indexOf('staff') !== -1) tr.dataset.role = 'staff';
        else tr.dataset.role = 'owner';
      }

      // status: normalize from data-status or status column (5th cell) or search row text
      if (!tr.dataset.status) {
        let s = '';
        if (tr.getAttribute('data-status')) s = tr.getAttribute('data-status');
        else if (tr.cells && tr.cells.length >= 5) s = tr.cells[4].textContent || '';
        else s = tr.textContent || '';
        s = (s || '').toString().trim().toLowerCase();
        // clean up common words
        if (s.indexOf('suspended') !== -1) s = 'suspended';
        else if (s.indexOf('active') !== -1) s = 'active';
        else if (s.indexOf('rejected') !== -1) s = 'rejected';
        else if (s.indexOf('deleted') !== -1) s = 'deleted';
        tr.dataset.status = s;
      }
    });
  })();

  /* ============================
     Utilities
     ============================ */
  function byId(id) { return document.getElementById(id); }
  function lower(s) { return (s || '').toString().trim().toLowerCase(); }
  function parseIntSafe(v, fallback) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; }

  /* ============================
     Per-page global control (optional)
     If you include <select id="per-page"> it will control page size for tables.
     ============================ */
  let GLOBAL_PER_PAGE = 10;
  const perPageEl = byId('per-page');
  if (perPageEl) {
    const init = parseIntSafe(perPageEl.value, 10);
    if (init > 0) GLOBAL_PER_PAGE = init;
    perPageEl.addEventListener('change', () => {
      const v = parseIntSafe(perPageEl.value, GLOBAL_PER_PAGE);
      if (v > 0) {
        GLOBAL_PER_PAGE = v;
        if (window.__ADMIN_TABLE_MANAGERS) {
          Object.values(window.__ADMIN_TABLE_MANAGERS).forEach(m => m && m.setPerPage && m.setPerPage(GLOBAL_PER_PAGE));
        }
      }
    });
  }

  /* ============================
     Generic table manager factory
     ============================ */
  function createTableManager({ tableBodyId, filterId, paginationContainerId, infoContainerId, perPage = GLOBAL_PER_PAGE }) {
    const tbody = byId(tableBodyId);
    if (!tbody) return null;

    const filter = filterId ? byId(filterId) : null;
    const pager = paginationContainerId ? byId(paginationContainerId) : null;
    const info = infoContainerId ? byId(infoContainerId) : null;

    const allRows = Array.from(tbody.querySelectorAll('tr'));
    let filteredRows = allRows.slice();
    let currentPage = 1;
    let currentPerPage = perPage;

    function getFilterValue() {
      return filter && filter.value ? filter.value.toLowerCase() : 'all';
    }

    function applyFilter() {
      const val = getFilterValue();

      // special-case users.filter 'owners'
      if (filter && filter.id === 'user-filter' && val === 'owners') {
        filteredRows = allRows.filter(r => {
          const role = (r.dataset.role || '').toString().toLowerCase();
          return role !== 'admin' && role !== 'staff';
        });
      } else if (val === 'all') {
        filteredRows = allRows.slice();
      } else {
        // default: match against data-status OR for users also allow matching role values
        filteredRows = allRows.filter(r => {
          const status = (r.dataset.status || '').toString().toLowerCase();
          const role = (r.dataset.role || '').toString().toLowerCase();
          if (filter && filter.id === 'user-filter') {
            // user-filter may ask for 'admin', 'staff', 'owners', or a status like 'active'
            if (val === 'admin' || val === 'admins') return role === 'admin';
            if (val === 'staff' || val === 'staffs') return role === 'staff';
            if (val === 'active' || val === 'suspended' || val === 'rejected' || val === 'deleted') return status === val;
            // fallback: match role or status
            return role === val || status === val;
          } else {
            // listing filter: match status tokens
            return status === val;
          }
        });
      }

      renderPage(1);
    }

    function renderPage(page = 1) {
      const totalPages = Math.max(1, Math.ceil(filteredRows.length / currentPerPage));
      currentPage = Math.max(1, Math.min(page, totalPages));
      const start = (currentPage - 1) * currentPerPage;
      const end = start + currentPerPage;

      allRows.forEach(r => r.style.display = 'none');
      filteredRows.slice(start, end).forEach(r => r.style.display = '');

      renderPagination();
      renderInfo(start);
    }

    function renderPagination() {
      if (!pager) return;
      pager.innerHTML = '';
      const totalPages = Math.max(1, Math.ceil(filteredRows.length / currentPerPage));

      const btn = (txt, disabled, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = txt;
        if (disabled) b.disabled = true;
        if (typeof onClick === 'function') b.addEventListener('click', onClick);
        return b;
      };

      pager.appendChild(btn('Prev', currentPage <= 1, () => renderPage(currentPage - 1)));

      const windowSize = 5;
      let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
      let end = Math.min(totalPages, start + windowSize - 1);
      if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);

      if (start > 1) {
        pager.appendChild(btn('1', false, () => renderPage(1)));
        if (start > 2) {
          const el = document.createElement('span'); el.textContent = '…'; el.style.padding = '6px';
          pager.appendChild(el);
        }
      }

      for (let i = start; i <= end; i++) {
        pager.appendChild(btn(String(i), i === currentPage, () => renderPage(i)));
      }

      if (end < totalPages) {
        if (end < totalPages - 1) {
          const el2 = document.createElement('span'); el2.textContent = '…'; el2.style.padding = '6px';
          pager.appendChild(el2);
        }
        pager.appendChild(btn(String(totalPages), false, () => renderPage(totalPages)));
      }

      pager.appendChild(btn('Next', currentPage >= totalPages, () => renderPage(currentPage + 1)));
    }

    function renderInfo(startIndex) {
      if (!info) return;
      const total = filteredRows.length;
      const start = total === 0 ? 0 : startIndex + 1;
      const end = Math.min(filteredRows.length, startIndex + currentPerPage);
      info.textContent = `${total} result(s) — showing ${start || 0} to ${end || 0}`;
    }

    function setPerPage(n) {
      if (!Number.isFinite(n) || n <= 0) return;
      currentPerPage = n;
      renderPage(1);
    }

    if (filter) filter.addEventListener('change', applyFilter);

    // initial render
    applyFilter();

    return {
      applyFilter,
      renderPage,
      setPerPage,
      getState: () => ({ total: filteredRows.length, currentPage, perPage: currentPerPage })
    };
  }

  // expose managers globally so per-page selector can notify them
  window.__ADMIN_TABLE_MANAGERS = window.__ADMIN_TABLE_MANAGERS || {};

  /* ============================
     Instantiate listing and user managers
     ============================ */
  const listingsManager = createTableManager({
    tableBodyId: 'managed-listings-body',
    filterId: 'listing-filter',
    paginationContainerId: 'managed-listings-pagination',
    infoContainerId: 'managed-listings-info',
    perPage: GLOBAL_PER_PAGE
  });
  window.__ADMIN_TABLE_MANAGERS.managedListings = listingsManager;

  const usersManager = createTableManager({
    tableBodyId: 'users-table-body',
    filterId: 'user-filter',
    paginationContainerId: 'users-pagination',
    infoContainerId: 'users-info',
    perPage: GLOBAL_PER_PAGE
  });
  window.__ADMIN_TABLE_MANAGERS.users = usersManager;

  /* ============================
     Modal-driven admin actions
     - Replaces prompt/confirm with an accessible modal (if present)
     - If modal missing, falls back to prompt() flows
     - Buttons should have class .btn-admin-action and data-action and data-listing-id / data-user-id
     ============================ */
  // Query modal pieces (if markup included in EJS)
  let modal = byId('admin-action-modal');
  let modalDesc = byId('admin-action-modal-desc');
  let modalReason = byId('admin-action-reason');
  let modalUntilWrap = byId('admin-action-until');
  let modalUntilInput = byId('admin-action-until-input');
  let modalConfirm = byId('admin-action-confirm');
  let modalCancel = byId('admin-action-cancel');

  // If missing, create a basic modal and append to body
  if (!modal || !modalConfirm || !modalCancel) {
    const m = document.createElement('div');
    m.id = 'admin-action-modal';
    m.className = 'modal';
    m.style.display = 'none';
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML = `
      <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;padding:20px;">
        <div class="modal-inner" role="dialog" aria-modal="true" style="background:#fff;padding:16px;border-radius:6px;max-width:560px;width:100%;">
          <div id="admin-action-modal-desc" style="font-weight:600;margin-bottom:8px;"></div>
          <div style="margin-bottom:8px;">
            <label style="display:block;">Reason<br><input id="admin-action-reason" type="text" style="width:100%;"></label>
          </div>
          <div id="admin-action-until" style="margin-bottom:8px;display:none;">
            <label style="display:block;">Until (optional)<br><input id="admin-action-until-input" type="datetime-local" style="width:100%;"></label>
          </div>
          <div style="text-align:right;">
            <button id="admin-action-cancel" type="button">Cancel</button>
            <button id="admin-action-confirm" type="button" style="margin-left:8px;">Confirm</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    // re-query
    modal = byId('admin-action-modal');
    modalDesc = byId('admin-action-modal-desc');
    modalReason = byId('admin-action-reason');
    modalUntilWrap = byId('admin-action-until');
    modalUntilInput = byId('admin-action-until-input');
    modalConfirm = byId('admin-action-confirm');
    modalCancel = byId('admin-action-cancel');
  }

  let modalState = { action: null, subjectId: null, targetForm: null };

  function openModal(action, subjectId, form) {
    // fallback to prompt flows if modal missing
    if (!modal || !modalConfirm || !modalCancel) {
      // fallback prompt-based flow
      const reason = (action === 'suspend' || action === 'suspend-user') ? window.prompt('Enter reason (optional):') : window.prompt('Enter reason/note (optional):');
      if (reason === null) return; // cancelled
      const until = (action === 'suspend' || action === 'suspend-user') ? window.prompt('Enter suspended-until (ISO) or leave blank:') : '';
      let tform = form;
      if (!tform) {
        if (action.includes('user')) {
          tform = document.querySelector(`.suspend-form[data-user-id="${subjectId}"], .reactivate-form[data-user-id="${subjectId}"], .delete-user-form[data-user-id="${subjectId}"]`);
        } else {
          tform = document.querySelector(`.listing-action-form[data-listing-id="${subjectId}"]`);
        }
      }
      if (!tform) {
        if (!confirm(`Proceed with ${action} on #${subjectId}?`)) return;
        return;
      }
      // fill hidden inputs and submit
      const fill = (sel, val) => { const el = tform.querySelector(sel); if (el) el.value = val; };
      if (action === 'reject') fill('.reject-reason-input', reason || 'No reason provided');
      else if (action === 'suspend' || action === 'suspend-user') { fill('.suspend-reason-input', reason || 'Suspended by admin'); fill('.suspended-until-input', until || ''); }
      else if (action === 'reactivate' || action === 'reactivate-user') fill('.reactivate-reason-input', reason || 'Reactivated by admin');
      else if (action === 'delete' || action === 'delete-user') fill('.delete-reason-input', reason || 'Deleted by admin');
      try { tform.submit(); } catch (err) { console.error('Fallback submit failed', err); }
      return;
    }

    modalState.action = action;
    modalState.subjectId = subjectId ? String(subjectId) : null;
    modalState.targetForm = form || null;

    const map = {
      reject: `Reject listing #${subjectId}. This will mark the listing as rejected and notify the owner.`,
      suspend: `Suspend listing #${subjectId}. Suspended listings are hidden from the public.`,
      reactivate: `Reactivate listing #${subjectId}. This will set the listing back to approved/active.`,
      delete: `Delete listing #${subjectId}. This will perform a soft delete (data retained).`,
      'suspend-user': `Suspend user #${subjectId}. Enter optional until-date and reason.`,
      'reactivate-user': `Reactivate user #${subjectId}. Enter optional note.`,
      'delete-user': `Delete user #${subjectId}. This will permanently delete the account.`
    };

    if (modalDesc) modalDesc.textContent = map[action] || `Perform "${action}" on #${subjectId}.`;
    if (modalReason) modalReason.value = '';
    if (modalUntilInput) modalUntilInput.value = '';
    if (modalUntilWrap) modalUntilWrap.style.display = (action === 'suspend' || action === 'suspend-user') ? '' : 'none';

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => { try { modalReason && modalReason.focus(); } catch (e) {} }, 60);
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modalState = { action: null, subjectId: null, targetForm: null };
  }

  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && modal && modal.style.display === 'flex') closeModal();
  });

  if (modalConfirm) {
    modalConfirm.addEventListener('click', function () {
      const { action, subjectId } = modalState;
      if (!action) return closeModal();

      const reason = modalReason ? modalReason.value.trim() : '';
      const until = modalUntilInput ? modalUntilInput.value : '';

      // find a target form if one wasn't passed in
      let targetForm = modalState.targetForm;
      if (!targetForm) {
        if (action.includes('user')) {
          targetForm = document.querySelector(`.suspend-form[data-user-id="${subjectId}"], .reactivate-form[data-user-id="${subjectId}"], .delete-user-form[data-user-id="${subjectId}"]`);
        } else {
          targetForm = document.querySelector(`.listing-action-form[data-listing-id="${subjectId}"]`) ||
                       document.querySelector(`form[data-listing-id="${subjectId}"]`);
        }
      }

      if (!targetForm) {
        console.warn('Admin action form not found for', modalState);
        if (!confirm(`Form not found for ${action} #${subjectId}. Proceed anyway?`)) return closeModal();
        return closeModal();
      }

      const setIf = (sel, val) => { const el = targetForm.querySelector(sel); if (el) el.value = val; };

      if (action === 'reject') setIf('.reject-reason-input', reason || 'No reason provided');
      else if (action === 'suspend' || action === 'suspend-user') { setIf('.suspend-reason-input', reason || 'Suspended by admin'); setIf('.suspended-until-input', until || ''); }
      else if (action === 'reactivate' || action === 'reactivate-user') setIf('.reactivate-reason-input', reason || 'Reactivated by admin');
      else if (action === 'delete' || action === 'delete-user') setIf('.delete-reason-input', reason || 'Deleted by admin');

      try { targetForm.submit(); } catch (err) { console.error('Failed to submit admin form', err); } finally { closeModal(); }
    });
  }

  // delegated listener for .btn-admin-action
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-admin-action');
    if (!btn) return;

    const action = btn.dataset.action;
    const listingId = btn.dataset.listingId || btn.getAttribute('data-listing-id');
    const userId = btn.dataset.userId || btn.getAttribute('data-user-id');

    const enclosingForm = btn.closest('form');

    if (listingId) {
      const formToUse = enclosingForm && enclosingForm.classList.contains('listing-action-form') ? enclosingForm : document.querySelector(`.listing-action-form[data-listing-id="${listingId}"]`);
      openModal(action, listingId, formToUse);
    } else if (userId) {
      const formToUse = enclosingForm || document.querySelector(`.suspend-form[data-user-id="${userId}"], .reactivate-form[data-user-id="${userId}"], .delete-user-form[data-user-id="${userId}"]`);
      openModal(action, userId, formToUse);
    }
  });

  // fallback legacy handlers
  document.addEventListener('click', function (e) {
    if (e.target.matches('.reject-btn')) {
      const btn = e.target;
      const lid = btn.dataset.listingId || btn.getAttribute('data-listing-id');
      const form = btn.closest('.reject-form') || document.querySelector(`.listing-action-form[data-listing-id="${lid}"]`);
      openModal('reject', lid, form);
    } else if (e.target.matches('.suspend-user-btn')) {
      const btn = e.target;
      const uid = btn.dataset.userId;
      const form = btn.closest('.suspend-form');
      openModal('suspend-user', uid, form);
    } else if (e.target.matches('.reactivate-user-btn')) {
      const btn = e.target;
      const uid = btn.dataset.userId;
      const form = btn.closest('.reactivate-form');
      openModal('reactivate-user', uid, form);
    }
  });

  // simple focus-trap when modal open
  document.addEventListener('focus', function (ev) {
    if (!modal || modal.style.display !== 'flex') return;
    if (!modal.contains(ev.target)) {
      try { modalReason && modalReason.focus(); } catch (e) {}
    }
  }, true);

  // ensure global per-page applied to managers
  if (window.__ADMIN_TABLE_MANAGERS) {
    Object.values(window.__ADMIN_TABLE_MANAGERS).forEach(m => m && m.setPerPage && m.setPerPage(GLOBAL_PER_PAGE));
  }
});
