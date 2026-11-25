import './styles/main.css';
import {
  PROPERTIES,
  NEIGHBORHOODS,
  renderPictureHtml,
  renderPropertyCardHtml,
  renderNeighborhoodCardHtml,
} from './data/properties.js';

if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
  import('@oddbird/popover-polyfill');
}

const base = import.meta.env.BASE_URL;
const STORAGE_KEY = 'angia-saved-properties';

const state = {
  keyword: '',
  city: 'all',
  type: 'all',
  budget: 'all',
  sort: 'featured',
  onlySaved: false,
  savedIds: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
};

const els = {
  header: document.getElementById('site-header'),
  headerInner: document.querySelector('.header-inner'),
  siteNav: document.querySelector('.site-nav'),
  siteMenu: document.getElementById('site-menu'),
  propertyGrid: document.getElementById('property-grid'),
  neighborhoodGrid: document.getElementById('neighborhood-grid'),
  resultsSummary: document.getElementById('results-summary'),
  savedCount: document.getElementById('saved-count'),
  toggleSavedBtn: document.getElementById('toggle-saved-btn'),
  heroSearchForm: document.getElementById('hero-search-form'),
  searchKeyword: document.getElementById('search-keyword'),
  searchCity: document.getElementById('search-city'),
  searchType: document.getElementById('search-type'),
  searchBudget: document.getElementById('search-budget'),
  sortSelect: document.getElementById('sort-select'),
  filterPills: document.querySelectorAll('.pill[data-filter-type]'),
  dialog: document.getElementById('property-dialog'),
  dialogContent: document.getElementById('dialog-content'),
  leadPropertySelect: document.getElementById('lead-property'),
  consultationForm: document.getElementById('consultation-form'),
  formSuccess: document.getElementById('form-success'),
  formSuccessDetails: document.getElementById('form-success-details'),
  resetFormBtn: document.getElementById('reset-form-btn'),
};

/* ---------- Adaptive Navbar (avoid layout thrashing in ResizeObserver) ---------- */
function setupAdaptiveNavbar() {
  const { header, headerInner, siteMenu } = els;
  if (!header || !headerInner || !siteMenu) return;

  let lastMeasuredWidth = -1;
  let rafId = 0;

  const measureAndSync = () => {
    rafId = 0;
    const currentWidth = Math.round(header.getBoundingClientRect().width);
    if (currentWidth === lastMeasuredWidth) return;
    lastMeasuredWidth = currentWidth;

    const wasPopoverOpen =
      siteMenu.matches(':popover-open') || siteMenu.classList.contains(':popover-open');

    header.classList.add('is-measuring');
    header.classList.add('is-wide');
    siteMenu.removeAttribute('popover');

    const fits = headerInner.scrollWidth <= headerInner.clientWidth;

    if (!fits) {
      header.classList.remove('is-wide');
      siteMenu.setAttribute('popover', 'auto');
      if (wasPopoverOpen && typeof siteMenu.showPopover === 'function') {
        try {
          siteMenu.showPopover();
        } catch {
          // Ignore if already open or detached
        }
      }
    }

    requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
    });
  };

  const scheduleMeasure = (force = false) => {
    if (force) lastMeasuredWidth = -1;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measureAndSync);
  };

  // Observe only the header width, never siteMenu, to prevent self-triggering resize loops
  const ro = new ResizeObserver(() => scheduleMeasure(false));
  ro.observe(header);
  measureAndSync();
  document.fonts?.ready.then(() => scheduleMeasure(true));

  const navLinks = siteMenu.querySelectorAll('a[href^="#"]');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((item) => item.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'page');
      if (!header.classList.contains('is-wide') && typeof siteMenu.hidePopover === 'function') {
        try {
          siteMenu.hidePopover();
        } catch {
          // Ignore if already closed
        }
      }
    });
  });
}

/* ---------- Property Catalog & Filtering ---------- */
function getFilteredProperties() {
  const keyword = state.keyword.trim().toLowerCase();

  let list = PROPERTIES.filter((item) => {
    if (state.onlySaved && !state.savedIds.has(item.id)) return false;
    if (state.city !== 'all' && item.city !== state.city) return false;
    if (state.type !== 'all' && item.type !== state.type) return false;
    if (state.budget !== 'all' && item.priceBillion > Number(state.budget)) return false;
    if (keyword) {
      const haystack = `${item.title} ${item.district} ${item.city} ${item.type} ${item.summary}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  if (state.sort === 'price-asc') {
    list = [...list].sort((a, b) => a.priceBillion - b.priceBillion);
  } else if (state.sort === 'price-desc') {
    list = [...list].sort((a, b) => b.priceBillion - a.priceBillion);
  } else if (state.sort === 'area-desc') {
    list = [...list].sort((a, b) => b.area - a.area);
  }

  return list;
}

function updateSavedCounter() {
  els.savedCount.textContent = String(state.savedIds.size);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.savedIds]));
}

function syncSavedButtonsInPlace() {
  els.propertyGrid.querySelectorAll('[data-save-id]').forEach((btn) => {
    const id = btn.dataset.saveId;
    const item = PROPERTIES.find((p) => p.id === id);
    const isSaved = state.savedIds.has(id);
    btn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
    if (item) {
      btn.setAttribute('aria-label', `${isSaved ? 'Bỏ lưu' : 'Lưu'} ${item.title}`);
    }
  });
}

function renderProperties() {
  const items = getFilteredProperties();
  els.resultsSummary.textContent = state.onlySaved
    ? `Đang xem ${items.length} bất động sản đã lưu`
    : `Đang hiển thị ${items.length} bất động sản phù hợp`;

  if (!items.length) {
    els.propertyGrid.innerHTML = `
      <div class="empty-state">
        <h3>Không tìm thấy bất động sản khớp bộ lọc</h3>
        <p>Hãy thử mở rộng khoảng giá hoặc đặt lại bộ lọc để xem toàn bộ danh mục.</p>
        <button type="button" class="btn btn-primary" id="clear-filters-btn">Xem tất cả dự án</button>
      </div>
    `;
    document.getElementById('clear-filters-btn')?.addEventListener('click', resetFilters);
    return;
  }

  els.propertyGrid.innerHTML = items
    .map((item) =>
      renderPropertyCardHtml(item, {
        base,
        isSaved: state.savedIds.has(item.id),
      }),
    )
    .join('');
}

function resetFilters() {
  state.keyword = '';
  state.city = 'all';
  state.type = 'all';
  state.budget = 'all';
  state.onlySaved = false;
  els.searchKeyword.value = '';
  els.searchCity.value = 'all';
  els.searchType.value = 'all';
  els.searchBudget.value = 'all';
  els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
  syncFilterPills();
  renderProperties();
}

function syncFilterPills() {
  els.filterPills.forEach((pill) => {
    pill.classList.toggle('is-active', pill.dataset.filterType === state.type);
  });
}

function ensureNeighborhoodsRendered() {
  if (els.neighborhoodGrid.children.length > 0) return;
  els.neighborhoodGrid.innerHTML = NEIGHBORHOODS.map((area) =>
    renderNeighborhoodCardHtml(area, { base }),
  ).join('');
}

/* ---------- FAQ Accordion ---------- */
function setupFaqAccordion() {
  const faqList = document.getElementById('faq-list');
  if (!faqList) return;

  faqList.addEventListener('click', (e) => {
    const trigger = e.target.closest('.faq-trigger');
    if (!trigger) return;
    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    panel.hidden = expanded;
  });
}

/* ---------- Native Modal Dialog ---------- */
function setupDialog() {
  const { dialog } = els;
  if (!dialog) return;

  dialog.addEventListener('close', () => {
    dialog.returnValue = '';
  });

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = outside(e);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e)) dialog.close();
    });
  }
}

function openPropertyDialog(propertyId) {
  const item = PROPERTIES.find((p) => p.id === propertyId);
  if (!item) return;

  els.dialogContent.innerHTML = `
    <div class="dialog-hero">
      ${renderPictureHtml({
        slug: item.imageSlug,
        alt: item.title,
        width: 880,
        height: 440,
        sizes: '(max-width: 900px) 92vw, 880px',
        base,
        loading: 'lazy',
        fetchpriority: 'low',
      })}
      <form method="dialog">
        <button type="submit" class="dialog-close" value="close" aria-label="Đóng hộp thoại chi tiết">✕</button>
      </form>
    </div>
    <div class="dialog-body">
      <div class="dialog-top">
        <div>
          <p class="card-location">${item.district} · ${item.city} · ${item.status}</p>
          <h1 id="dialog-title">${item.title}</h1>
        </div>
        <div class="dialog-price">
          <strong>${item.priceBillion.toFixed(1).replace('.', ',')} Tỷ VNĐ</strong>
          <span>${item.pricePerSqm}</span>
        </div>
      </div>

      <p>${item.summary}</p>

      <div class="dialog-specs-grid">
        <div class="dialog-spec"><small>Diện tích</small><strong>${item.area} m²</strong></div>
        <div class="dialog-spec"><small>Phòng ngủ / Tắm</small><strong>${item.bedrooms} PN · ${item.bathrooms} PT</strong></div>
        <div class="dialog-spec"><small>Hướng chính</small><strong>${item.direction}</strong></div>
        <div class="dialog-spec"><small>Pháp lý</small><strong>${item.legal}</strong></div>
      </div>

      <div>
        <h2>Điểm nhấn kiến trúc &amp; đặc quyền</h2>
        <ul class="dialog-highlights">
          ${item.highlights.map((h) => `<li>${h}</li>`).join('')}
        </ul>
      </div>

      <p><strong>Chính sách thanh toán:</strong> ${item.paymentPlan}</p>

      <div class="dialog-actions">
        <form method="dialog">
          <button type="submit" value="cancel" class="btn btn-outline">Đóng</button>
        </form>
        <button type="button" class="btn btn-accent" id="dialog-calc-btn">Ước tính vay căn này</button>
        <button type="button" class="btn btn-primary" id="dialog-book-btn" autofocus>Đặt lịch xem thực tế</button>
      </div>
    </div>
  `;

  els.dialog.showModal();

  document.getElementById('dialog-calc-btn')?.addEventListener('click', () => {
    const priceInput = document.getElementById('calc-price');
    priceInput.value = String(Math.min(100, Math.max(3, item.priceBillion)));
    updateMortgageCalculator();
    els.dialog.close('calculate');
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('dialog-book-btn')?.addEventListener('click', () => {
    els.leadPropertySelect.value = item.title;
    els.dialog.close('book');
    document.getElementById('consultation')?.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('lead-name')?.focus();
  });
}

/* ---------- Mortgage Calculator ---------- */
function updateMortgageCalculator() {
  const price = Number(document.getElementById('calc-price').value);
  const downPct = Number(document.getElementById('calc-down').value);
  const annualRate = Number(document.getElementById('calc-rate').value);
  const years = Number(document.getElementById('calc-years').value);

  const downAmount = price * (downPct / 100);
  const loanBillion = price - downAmount;
  const loanMillion = loanBillion * 1000;
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;

  const factor = Math.pow(1 + monthlyRate, months);
  const monthlyMillion = (loanMillion * monthlyRate * factor) / (factor - 1);
  const totalPaymentBillion = (monthlyMillion * months) / 1000;
  const totalInterestBillion = totalPaymentBillion - loanBillion;
  const principalRatio = (loanBillion / totalPaymentBillion) * 100;

  document.getElementById('calc-price-out').textContent = `${price.toFixed(1).replace('.', ',')} Tỷ VNĐ`;
  document.getElementById('calc-down-out').textContent = `${downPct}% (${downAmount.toFixed(1).replace('.', ',')} Tỷ)`;
  document.getElementById('calc-rate-out').textContent = `${annualRate.toFixed(2).replace('.', ',')}%/năm`;
  document.getElementById('calc-years-out').textContent = `${years} năm`;

  document.getElementById('calc-monthly').textContent = `${monthlyMillion.toFixed(1).replace('.', ',')} Triệu/tháng`;
  document.getElementById('calc-loan-amount').textContent = `${loanBillion.toFixed(2).replace('.', ',')} Tỷ VNĐ`;
  document.getElementById('calc-total-interest').textContent = `${totalInterestBillion.toFixed(2).replace('.', ',')} Tỷ VNĐ`;
  document.getElementById('calc-total-payment').textContent = `${totalPaymentBillion.toFixed(2).replace('.', ',')} Tỷ VNĐ`;

  document.getElementById('calc-bar-principal').style.inlineSize = `${principalRatio.toFixed(1)}%`;
  document.getElementById('calc-bar-interest').style.inlineSize = `${(100 - principalRatio).toFixed(1)}%`;
}

/* ---------- Consultation Form Validation ---------- */
function setupFormValidation(form) {
  if (!form) return;

  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.classList.add('visually-hidden');
  document.body.append(announcer);
  let announceTimer;
  let announcedField;

  const spokenText = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => n.replaceWith(`${n.getAttribute('aria-label')}: `));
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };

  const announceError = (el) => {
    const error = document.getElementById(el.dataset.error);
    if (!error) return;
    const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = label + spokenText(error);
    }, 500);
  };

  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const dirtyState = new WeakMap();
  const flagged = new WeakSet();
  const announced = new WeakSet();

  const syncAria = (el, announce = false, forceInvalidState) => {
    if (!el.matches?.('input, select, textarea')) return;
    const invalid =
      typeof forceInvalidState === 'boolean'
        ? forceInvalidState
        : supportsUserInvalid
          ? el.matches(':user-invalid')
          : el.classList.contains('user-invalid-fallback');

    if (invalid) {
      if (announce && !announced.has(el)) {
        announceError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  form.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.hasAttribute('aria-invalid')) el.setAttribute('aria-invalid', 'false');
  });

  if (!supportsUserInvalid) {
    const updateFallback = (input, announce = false) => {
      const isValid = input.validity.valid;
      input.classList.toggle('user-invalid-fallback', !isValid);
      input.classList.toggle('user-valid-fallback', isValid);
      syncAria(input, announce, !isValid);
    };

    form.addEventListener(
      'blur',
      (e) => {
        const input = e.target;
        if (!input.checkValidity) return;
        const st = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
        st.hasBlurred = true;
        dirtyState.set(input, st);
        if (st.hasInteracted) updateFallback(input, true);
      },
      true,
    );

    form.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.checkValidity) return;
      const st = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      dirtyState.set(input, st);
      if (st.hasBlurred) updateFallback(input);
    });

    form.addEventListener(
      'invalid',
      (e) => {
        const input = e.target;
        dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
        announced.add(input);
        updateFallback(input, false);
      },
      true,
    );
  } else {
    form.addEventListener('blur', (e) => syncAria(e.target, true), true);
    form.addEventListener('input', (e) => {
      if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
    });
    form.addEventListener('change', (e) => syncAria(e.target, true), true);
    form.addEventListener(
      'invalid',
      (e) => {
        announced.add(e.target);
        syncAria(e.target);
      },
      true,
    );
  }

  form.addEventListener(
    'reset',
    () => {
      setTimeout(() => {
        [...form.elements].forEach((el) => {
          dirtyState.delete(el);
          el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
          syncAria(el, false, false);
        });
      });
    },
    true,
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid');
      firstInvalid?.focus();
      return;
    }

    const data = new FormData(form);
    const name = data.get('name');
    const phone = data.get('phone');
    const property = data.get('property');
    const visitDate = data.get('visitDate');

    els.formSuccessDetails.textContent = `Cảm ơn ${name}. Chuyên viên AnGia Premier sẽ liên hệ qua số ${phone} để xác nhận lịch tư vấn "${property}"${visitDate ? ` vào ngày ${visitDate}` : ''}.`;
    form.hidden = true;
    els.formSuccess.hidden = false;
  });

  els.resetFormBtn?.addEventListener('click', () => {
    form.reset();
    els.formSuccess.hidden = true;
    form.hidden = false;
  });
}

/* ---------- Events & Init ---------- */
function bindEvents() {
  els.heroSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.keyword = els.searchKeyword.value;
    state.city = els.searchCity.value;
    state.type = els.searchType.value;
    state.budget = els.searchBudget.value;
    state.onlySaved = false;
    els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
    syncFilterPills();
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  els.filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      state.type = pill.dataset.filterType;
      els.searchType.value = state.type;
      state.onlySaved = false;
      els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
      syncFilterPills();
      renderProperties();
    });
  });

  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    renderProperties();
  });

  els.toggleSavedBtn.addEventListener('click', () => {
    state.onlySaved = !state.onlySaved;
    els.toggleSavedBtn.setAttribute('aria-pressed', state.onlySaved ? 'true' : 'false');
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  els.propertyGrid.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) {
      const id = saveBtn.dataset.saveId;
      if (state.savedIds.has(id)) state.savedIds.delete(id);
      else state.savedIds.add(id);
      updateSavedCounter();
      if (state.onlySaved) renderProperties();
      else syncSavedButtonsInPlace();
      return;
    }

    const openBtn = e.target.closest('[data-open-id]');
    if (openBtn) {
      openPropertyDialog(openBtn.dataset.openId);
    }
  });

  els.neighborhoodGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-city-pick]');
    if (!card) return;
    state.city = card.dataset.cityPick;
    state.onlySaved = false;
    els.searchCity.value = state.city;
    els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  ['calc-price', 'calc-down', 'calc-rate', 'calc-years'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateMortgageCalculator);
  });
}

function init() {
  PROPERTIES.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.title;
    option.textContent = `${item.title} (${item.priceBillion.toFixed(1).replace('.', ',')} Tỷ)`;
    els.leadPropertySelect.append(option);
  });

  const dateInput = document.getElementById('lead-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  setupAdaptiveNavbar();
  setupDialog();
  setupFaqAccordion();
  setupFormValidation(els.consultationForm);
  updateSavedCounter();
  ensureNeighborhoodsRendered();

  // Preserve SSR pre-rendered cards on initial load; sync saved state in place if needed
  if (els.propertyGrid.children.length === 0) {
    renderProperties();
  } else if (state.savedIds.size > 0) {
    syncSavedButtonsInPlace();
  }

  updateMortgageCalculator();
  bindEvents();
}

init();
