import './styles/main.css';
import {
  COMING_SOON,
  PROPERTIES,
  SITE_URL,
  defaultSlugForType,
  escapeHtml,
  formatPriceBillion,
  renderComingSoonCardHtml,
  renderPictureHtml,
  renderPropertyCardHtml,
} from './data/properties.js';

if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
  import('@oddbird/popover-polyfill');
}

if (!Object.hasOwn(HTMLElement.prototype, 'focusGroup')) {
  import('@microsoft/focusgroup-polyfill').then(({ polyfill }) => polyfill());
}

const base = import.meta.env.BASE_URL;
const STORAGE_KEY = 'angia-saved-properties';
const COMPARE_KEY = 'angia-compare-properties';
const MAX_COMPARE = 3;

const state = {
  keyword: '',
  city: 'all',
  type: 'all',
  budget: 'all',
  sort: 'featured',
  onlySaved: false,
  savedIds: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
  compareIds: JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]').filter((id) =>
    PROPERTIES.some((p) => p.id === id),
  ),
};

const els = {
  header: document.getElementById('site-header'),
  headerInner: document.querySelector('.header-inner'),
  siteNav: document.querySelector('.site-nav'),
  siteMenu: document.getElementById('site-menu'),
  propertyGrid: document.getElementById('property-grid'),
  comingSoonGrid: document.getElementById('coming-soon-grid'),
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
  compareTray: document.getElementById('compare-tray'),
  compareCount: document.getElementById('compare-count'),
  compareChips: document.getElementById('compare-chips'),
  compareClearBtn: document.getElementById('compare-clear-btn'),
  compareOpenBtn: document.getElementById('compare-open-btn'),
  compareDialog: document.getElementById('compare-dialog'),
  compareDialogContent: document.getElementById('compare-dialog-content'),
  toastRegion: document.getElementById('toast-region'),
  toastAnnouncer: document.getElementById('toast-announcer'),
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

/* ---------- Toast Notifications (popover="manual") ---------- */
let toastCounter = 0;
let activeToastEl = null;

function announceToast(message) {
  if (typeof document.ariaNotify === 'function') {
    document.ariaNotify(message);
    return;
  }
  if (els.toastAnnouncer) {
    els.toastAnnouncer.textContent = '';
    setTimeout(() => {
      els.toastAnnouncer.textContent = message;
    }, 50);
  }
}

function showToast(message) {
  if (document.querySelector('dialog[open]') || !els.toastRegion) return;

  if (activeToastEl) {
    try {
      activeToastEl.hidePopover?.();
    } catch {
      // Ignore if already hidden
    }
    activeToastEl.remove();
    activeToastEl = null;
  }

  const toastId = `app-toast-${++toastCounter}`;
  const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = 'toast-item';
  toast.setAttribute('popover', 'manual');

  const text = document.createElement('p');
  text.className = 'toast-message';
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('popovertarget', toastId);
  closeBtn.setAttribute('popovertargetaction', 'hide');
  closeBtn.setAttribute('aria-label', 'Đóng thông báo');
  closeBtn.textContent = '✕';

  toast.append(text, closeBtn);
  els.toastRegion.append(toast);
  activeToastEl = toast;

  let dismissTimer = 0;
  const scheduleDismiss = () => {
    clearTimeout(dismissTimer);
    dismissTimer = window.setTimeout(() => {
      if (toast.matches(':focus-within')) {
        scheduleDismiss();
        return;
      }
      try {
        toast.hidePopover?.();
      } catch {
        toast.remove();
      }
    }, 3600);
  };

  toast.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') {
      clearTimeout(dismissTimer);
      if (toast.contains(document.activeElement) && priorFocus?.isConnected) {
        priorFocus.focus();
      }
      toast.remove();
      if (activeToastEl === toast) activeToastEl = null;
    }
  });

  toast.addEventListener('focusout', () => {
    if (!toast.matches(':focus-within')) scheduleDismiss();
  });

  try {
    toast.showPopover?.();
  } catch {
    toast.classList.add(':popover-open');
  }

  announceToast(message);
  scheduleDismiss();
}

/* ---------- Property Catalog & Filtering ---------- */
function getFilteredProperties() {
  const keyword = state.keyword.trim().toLowerCase();

  let list = PROPERTIES.filter((item) => {
    if (state.onlySaved && !state.savedIds.has(item.id)) return false;
    if (state.city !== 'all' && item.city !== state.city) return false;
    if (state.type !== 'all' && item.type !== state.type) return false;
    if (state.budget !== 'all' && (item.priceBillion == null || item.priceBillion > Number(state.budget))) return false;
    if (keyword) {
      const haystack = `${item.title} ${item.district} ${item.city} ${item.type} ${item.summary}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });

  if (state.sort === 'price-asc') {
    list = [...list].sort((a, b) => (a.priceBillion ?? Infinity) - (b.priceBillion ?? Infinity));
  } else if (state.sort === 'price-desc') {
    list = [...list].sort((a, b) => (b.priceBillion ?? -Infinity) - (a.priceBillion ?? -Infinity));
  } else if (state.sort === 'area-desc') {
    list = [...list].sort((a, b) => b.area - a.area);
  }

  return list;
}

function updateSavedCounter() {
  els.savedCount.textContent = String(state.savedIds.size);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.savedIds]));
}

function syncCardButtonsInPlace() {
  const compareSet = new Set(state.compareIds);

  els.propertyGrid.querySelectorAll('[data-save-id]').forEach((btn) => {
    const id = btn.dataset.saveId;
    const item = PROPERTIES.find((p) => p.id === id);
    const isSaved = state.savedIds.has(id);
    btn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
    if (item) {
      btn.setAttribute('aria-label', `${isSaved ? 'Bỏ lưu' : 'Lưu'} ${item.title}`);
    }
  });

  els.propertyGrid.querySelectorAll('[data-compare-id]').forEach((btn) => {
    const id = btn.dataset.compareId;
    btn.setAttribute('aria-pressed', compareSet.has(id) ? 'true' : 'false');
  });
}

function renderProperties() {
  const items = getFilteredProperties();
  const compareSet = new Set(state.compareIds);

  els.resultsSummary.textContent = state.onlySaved
    ? `Đang xem ${items.length} bất động sản đã lưu`
    : `Đang hiển thị ${items.length} bất động sản phù hợp`;

  if (!items.length) {
    els.propertyGrid.innerHTML = `
      <div class="empty-state">
        <h3>Không tìm thấy bất động sản khớp bộ lọc</h3>
        <p>Hãy thử mở rộng khoảng giá hoặc đặt lại bộ lọc để xem toàn bộ danh mục.</p>
        <button type="button" class="btn btn-primary" id="clear-filters-btn">Xem tất cả nhà đất</button>
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
        isCompared: compareSet.has(item.id),
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

function ensureComingSoonRendered() {
  if (!els.comingSoonGrid || els.comingSoonGrid.children.length > 0) return;
  els.comingSoonGrid.innerHTML = COMING_SOON.map((item) => renderComingSoonCardHtml(item)).join('');
}

/* ---------- Side-by-Side Comparison & Responsive Table ---------- */
function saveCompareState() {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(state.compareIds));
}

function renderCompareTray() {
  if (!els.compareTray) return;
  const items = state.compareIds
    .map((id) => PROPERTIES.find((p) => p.id === id))
    .filter(Boolean);

  els.compareCount.textContent = String(items.length);
  els.compareTray.hidden = items.length === 0;
  els.compareOpenBtn.disabled = items.length < 2;
  els.compareOpenBtn.textContent = items.length < 2 ? 'Chọn thêm 1 căn' : 'So sánh ngay';

  els.compareChips.innerHTML = items
    .map(
      (item) => `
      <li class="compare-chip">
        <span>${escapeHtml(item.title)}</span>
        <button
          type="button"
          class="compare-chip-remove"
          data-remove-compare="${item.id}"
          aria-label="Xóa ${escapeHtml(item.title)} khỏi danh sách so sánh"
        >✕</button>
      </li>
    `,
    )
    .join('');
}

function toggleCompareProperty(id) {
  const item = PROPERTIES.find((p) => p.id === id);
  if (!item) return;

  const idx = state.compareIds.indexOf(id);
  if (idx >= 0) {
    state.compareIds.splice(idx, 1);
    showToast(`Đã bỏ "${item.title}" khỏi bảng so sánh.`);
  } else if (state.compareIds.length >= MAX_COMPARE) {
    showToast(`Chỉ so sánh tối đa ${MAX_COMPARE} bất động sản cùng lúc.`);
    return;
  } else {
    state.compareIds.push(id);
    showToast(`Đã thêm "${item.title}" (${state.compareIds.length}/${MAX_COMPARE}) vào bảng so sánh.`);
  }

  saveCompareState();
  syncCardButtonsInPlace();
  renderCompareTray();
}

function openCompareDialog() {
  const items = state.compareIds
    .map((id) => PROPERTIES.find((p) => p.id === id))
    .filter(Boolean);
  if (items.length < 2) {
    showToast('Vui lòng chọn ít nhất 2 bất động sản để so sánh.');
    return;
  }

  const pricedSqm = items.filter((p) => p.pricePerSqmNum > 0).map((p) => p.pricePerSqmNum);
  const minSqmPrice = pricedSqm.length ? Math.min(...pricedSqm) : null;
  const maxArea = Math.max(...items.map((p) => p.area));
  const yields = items
    .filter((p) => p.priceBillion > 0)
    .map((p) => ((p.rentalMonthlyMillion * 12 * 0.9 * 0.9) / (p.priceBillion * 1000)) * 100);
  const maxYield = yields.length ? Math.max(...yields) : null;

  const labelStyleVars = items
    .map((item, index) => `--label-${index + 2}: "${escapeHtml(item.title)}"`)
    .join('; ');

  const rows = [
    {
      label: 'Khu vực',
      render: (p) => `${escapeHtml(p.district)}, ${escapeHtml(p.city)}`,
    },
    {
      label: 'Giá bán niêm yết',
      render: (p) => `<strong>${formatPriceBillion(p.priceBillion, 'Tỷ VNĐ')}</strong>`,
    },
    {
      label: 'Đơn giá / m²',
      render: (p) =>
        `${escapeHtml(p.pricePerSqm)}${
          minSqmPrice !== null && p.pricePerSqmNum === minSqmPrice ? ' <span class="best-tag">Tốt nhất</span>' : ''
        }`,
    },
    {
      label: 'Diện tích',
      render: (p) =>
        `${p.area} m²${p.area === maxArea ? ' <span class="best-tag">Rộng nhất</span>' : ''}`,
    },
    {
      label: 'Kết cấu / Kích thước',
      render: (p) =>
        p.type === 'Đất nền' || p.bedrooms === 0
          ? `Đất thổ cư · ${escapeHtml(p.dimensions || `${p.area} m²`)}`
          : `${p.bedrooms} Phòng ngủ · ${p.bathrooms} Phòng tắm`,
    },
    {
      label: 'Hướng & Bàn giao',
      render: (p) => `${escapeHtml(p.direction)} · ${escapeHtml(p.handover)}`,
    },
    {
      label: 'Pháp lý',
      render: (p) => escapeHtml(p.legal),
    },
    {
      label: 'Cho thuê ước tính',
      render: (p) => {
        if (!(p.priceBillion > 0)) {
          return `~${p.rentalMonthlyMillion} Tr/tháng (Liên hệ báo giá)`;
        }
        const netYield = ((p.rentalMonthlyMillion * 12 * 0.9 * 0.9) / (p.priceBillion * 1000)) * 100;
        const isBest = maxYield !== null && Math.abs(netYield - maxYield) < 0.001;
        return `~${p.rentalMonthlyMillion} Tr/tháng (${netYield.toFixed(2).replace('.', ',')}%/năm)${
          isBest ? ' <span class="best-tag">Yield cao</span>' : ''
        }`;
      },
    },
    {
      label: 'Thao tác',
      render: (p) =>
        `<button type="button" class="btn btn-primary btn-sm" data-compare-book="${escapeHtml(
          p.title,
        )}">Liên hệ mua căn này</button>`,
    },
  ];

  els.compareDialogContent.innerHTML = `
    <div class="compare-dialog-body">
      <div class="compare-dialog-header">
        <div>
          <p class="section-kicker">Phân tích song song</p>
          <h1 id="compare-dialog-title">So Sánh ${items.length} Bất Động Sản Đã Chọn</h1>
        </div>
        <form method="dialog">
          <button type="submit" class="dialog-close compare-dialog-close" value="close" aria-label="Đóng bảng so sánh">✕</button>
        </form>
      </div>

      <div tabindex="0" role="region" aria-labelledby="compare-table-caption" class="table-wrapper">
        <table class="compare-table" style="${labelStyleVars}">
          <caption id="compare-table-caption">
            Bảng đối chiếu thông số, đơn giá trên m², pháp lý và hiệu suất cho thuê giữa các bất động sản.
          </caption>
          <thead>
            <tr>
              <th scope="col">Tiêu chí</th>
              ${items.map((p) => `<th scope="col">${escapeHtml(p.title)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
              <tr>
                <th scope="row">${row.label}</th>
                ${items.map((p) => `<td>${row.render(p)}</td>`).join('')}
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  els.compareDialog.showModal();

  els.compareDialogContent.querySelectorAll('[data-compare-book]').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.leadPropertySelect.value = btn.dataset.compareBook;
      els.compareDialog.close('book');
      document.getElementById('consultation')?.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('lead-name')?.focus();
    });
  });
}

/* ---------- Financial Studio Tabs (tabs guide) ---------- */
function setupCalculatorTabs() {
  const tablist = document.querySelector('.calc-tablist');
  const tabs = [...document.querySelectorAll('.calc-tab')];
  const panels = [...document.querySelectorAll('.calc-panels > [role="tabpanel"]')];
  if (!tablist || !tabs.length) return;

  const activateTab = (selectedTab, shouldFocus = false) => {
    tabs.forEach((tab) => {
      const active = tab === selectedTab;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.toggleAttribute('focusgroupstart', active);
    });

    panels.forEach((panel) => {
      const belongsToSelected = panel.getAttribute('aria-labelledby') === selectedTab.id;
      if (belongsToSelected) {
        panel.removeAttribute('hidden');
        panel.setAttribute('tabindex', '0');
      } else {
        panel.setAttribute('hidden', 'until-found');
        panel.removeAttribute('tabindex');
      }
    });

    selectedTab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
    if (shouldFocus) selectedTab.focus();
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('focus', () => {
      if (tab.getAttribute('aria-selected') !== 'true') {
        activateTab(tab);
      }
    });
  });

  tablist.addEventListener('keydown', (e) => {
    const idx = tabs.indexOf(document.activeElement);
    if (idx === -1) return;
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;

    if (nextIdx !== -1) {
      e.preventDefault();
      activateTab(tabs[nextIdx], true);
    }
  });

  panels.forEach((panel) => {
    panel.addEventListener('beforematch', () => {
      const targetTab = document.getElementById(panel.getAttribute('aria-labelledby'));
      if (targetTab) activateTab(targetTab);
    });
  });

  return activateTab;
}

let activateFinancialTab = null;

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

/* ---------- Native Modal Dialogs (dialog + light-dismiss fallback) ---------- */
function setupModalDialog(dialog, onClose) {
  if (!dialog) return;

  dialog.addEventListener('close', () => {
    dialog.returnValue = '';
    onClose?.();
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

function syncProjectUrlParam(propertyId) {
  const url = new URL(window.location.href);
  if (propertyId) url.searchParams.set('du-an', propertyId);
  else url.searchParams.delete('du-an');
  window.history.replaceState({}, '', url);
}

function openPropertyDialog(propertyId) {
  const item = PROPERTIES.find((p) => p.id === propertyId);
  if (!item) return;

  syncProjectUrlParam(item.id);

  const gallery = item.gallery?.length
    ? item.gallery
    : [{ slug: item.imageSlug || defaultSlugForType(item.type), caption: item.title }];

  const renderHeroImg = (slug, alt) =>
    renderPictureHtml({
      slug,
      alt,
      width: 880,
      height: 440,
      sizes: '(max-width: 900px) 92vw, 880px',
      base,
      loading: 'lazy',
      fetchpriority: 'low',
    });

  const galleryBarHtml =
    gallery.length > 1
      ? `<div class="dialog-gallery-bar">
          <p class="dialog-gallery-caption" id="dialog-gallery-caption">${escapeHtml(gallery[0].caption)}</p>
          <div class="dialog-thumbs" role="group" aria-label="Thư viện ảnh bất động sản">
            ${gallery
              .map(
                (photo, idx) => `
              <button
                type="button"
                class="dialog-thumb"
                data-gallery-idx="${idx}"
                aria-pressed="${idx === 0 ? 'true' : 'false'}"
                aria-label="Xem ảnh ${idx + 1}: ${escapeHtml(photo.caption)}"
              >
                ${renderPictureHtml({
                  slug: photo.slug,
                  alt: photo.caption,
                  width: 172,
                  height: 124,
                  sizes: '90px',
                  base,
                  loading: 'lazy',
                })}
              </button>
            `,
              )
              .join('')}
          </div>
        </div>`
      : '';

  const isLand = item.type === 'Đất nền' || item.bedrooms === 0;
  const specSecondaryHtml = isLand
    ? `<div class="dialog-spec"><small>Kích thước</small><strong>${escapeHtml(item.dimensions || 'Đất thổ cư')}</strong></div>`
    : `<div class="dialog-spec"><small>Phòng ngủ / Tắm</small><strong>${item.bedrooms} PN · ${item.bathrooms} PT</strong></div>`;

  const phoneRaw = (item.contactPhone || '0961589925').replace(/\s+/g, '');
  const phoneDisplay = phoneRaw.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

  els.dialogContent.innerHTML = `
    <div class="dialog-hero" id="dialog-hero-media">
      <div class="dialog-hero-frame" id="dialog-hero-frame">
        ${renderHeroImg(gallery[0].slug, gallery[0].caption)}
      </div>
      <form method="dialog">
        <button type="submit" class="dialog-close" value="close" aria-label="Đóng hộp thoại chi tiết">✕</button>
      </form>
    </div>
    ${galleryBarHtml}
    <div class="dialog-body">
      <div class="dialog-top">
        <div>
          <p class="card-location">${escapeHtml(item.district)} · ${escapeHtml(item.city)} · ${escapeHtml(item.status)}</p>
          <h1 id="dialog-title">${escapeHtml(item.title)}</h1>
        </div>
        <div class="dialog-price">
          <strong>${formatPriceBillion(item.priceBillion, 'Tỷ VNĐ')}</strong>
          <span>${escapeHtml(item.pricePerSqm)}</span>
        </div>
      </div>

      <p>${escapeHtml(item.summary)}</p>

      <div class="dialog-contact-bar">
        <strong>Liên hệ trực tiếp chính chủ:</strong>
        <a href="tel:${escapeHtml(phoneRaw)}" class="btn btn-primary btn-sm">Gọi ${escapeHtml(phoneDisplay)}</a>
        <a href="https://zalo.me/${escapeHtml(phoneRaw)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
          Zalo gửi vị trí &amp; sổ
        </a>
      </div>

      <div class="dialog-specs-grid">
        <div class="dialog-spec"><small>Diện tích</small><strong>${item.area} m²</strong></div>
        ${specSecondaryHtml}
        <div class="dialog-spec"><small>Đường / Hướng</small><strong>${escapeHtml(item.direction)}</strong></div>
        <div class="dialog-spec"><small>Pháp lý</small><strong>${escapeHtml(item.legal)}</strong></div>
      </div>

      <div>
        <h2>Điểm nhấn nổi bật</h2>
        <ul class="dialog-highlights">
          ${item.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      </div>

      <div class="amenities-section">
        <h2>Kết nối &amp; Tiện ích xung quanh</h2>
        <div class="amenities-grid">
          ${item.amenities
            .map(
              (a) => `
            <div class="amenity-chip">
              <strong>${escapeHtml(a.name)}</strong>
              <span>${escapeHtml(a.distance)}</span>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>

      <p><strong>Chính sách &amp; Ghi chú:</strong> ${escapeHtml(item.paymentPlan)}</p>
      <p id="share-inline-status" class="share-inline-status" aria-live="polite"></p>

      <div class="dialog-actions">
        <form method="dialog">
          <button type="submit" value="cancel" class="btn btn-outline">Đóng</button>
        </form>
        <button type="button" class="btn btn-outline" id="dialog-share-btn">Chia sẻ</button>
        <button type="button" class="btn btn-accent" id="dialog-roi-btn">Phân tích ROI</button>
        <button type="button" class="btn btn-primary" id="dialog-book-btn" autofocus>Liên hệ mua căn này</button>
      </div>
    </div>
  `;

  els.dialog.showModal();

  els.dialogContent.querySelectorAll('[data-gallery-idx]').forEach((thumbBtn) => {
    thumbBtn.addEventListener('click', () => {
      const idx = Number(thumbBtn.dataset.galleryIdx);
      const selected = gallery[idx];
      if (!selected) return;
      const frame = document.getElementById('dialog-hero-frame');
      const captionEl = document.getElementById('dialog-gallery-caption');
      if (frame) frame.innerHTML = renderHeroImg(selected.slug, selected.caption);
      if (captionEl) captionEl.textContent = selected.caption;
      els.dialogContent.querySelectorAll('[data-gallery-idx]').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn === thumbBtn ? 'true' : 'false');
      });
    });
  });

  document.getElementById('dialog-share-btn')?.addEventListener('click', async () => {
    const shareText = `${item.title} (${formatPriceBillion(item.priceBillion)}) — ${item.district}, ${item.city}`;
    const shareUrl = `${SITE_URL}?du-an=${item.id}`;
    const statusEl = document.getElementById('share-inline-status');

    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          text: shareText,
          url: shareUrl,
        });
        if (statusEl) statusEl.textContent = 'Đã chia sẻ thông tin bất động sản.';
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      if (statusEl) statusEl.textContent = `Đã sao chép liên kết: ${shareUrl}`;
    } catch {
      if (statusEl) statusEl.textContent = `Liên kết trực tiếp: ${shareUrl}`;
    }
  });

  document.getElementById('dialog-roi-btn')?.addEventListener('click', () => {
    const roiPrice = document.getElementById('roi-price');
    const roiRent = document.getElementById('roi-rent');
    const roiGrowth = document.getElementById('roi-growth');
    if (roiPrice) roiPrice.value = String(Math.min(100, Math.max(1, item.priceBillion || 4)));
    if (roiRent) roiRent.value = String(Math.min(250, Math.max(10, item.rentalMonthlyMillion)));
    if (roiGrowth) roiGrowth.value = String(item.appreciationPct);
    updateRoiCalculator();

    const roiTab = document.getElementById('tab-roi');
    if (roiTab && activateFinancialTab) activateFinancialTab(roiTab);

    els.dialog.close('roi');
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('dialog-book-btn')?.addEventListener('click', () => {
    els.leadPropertySelect.value = item.title;
    els.dialog.close('book');
    document.getElementById('consultation')?.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('lead-name')?.focus();
  });
}

/* ---------- Mortgage & ROI Calculators ---------- */
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

function updateRoiCalculator() {
  const priceEl = document.getElementById('roi-price');
  if (!priceEl) return;

  const price = Number(priceEl.value);
  const rentMillion = Number(document.getElementById('roi-rent').value);
  const occupancyPct = Number(document.getElementById('roi-occupancy').value);
  const expensePct = Number(document.getElementById('roi-expense').value);
  const growthPct = Number(document.getElementById('roi-growth').value);

  const annualGrossBillion = (rentMillion * 12) / 1000;
  const annualNetBillion = annualGrossBillion * (occupancyPct / 100) * (1 - expensePct / 100);
  const netYieldPct = (annualNetBillion / price) * 100;

  const value5Y = price * Math.pow(1 + growthPct / 100, 5);
  const capitalGain5Y = value5Y - price;
  const rent5Y = annualNetBillion * 5;
  const totalProfit5Y = capitalGain5Y + rent5Y;
  const rentSharePct = totalProfit5Y > 0 ? (rent5Y / totalProfit5Y) * 100 : 50;

  document.getElementById('roi-price-out').textContent = `${price.toFixed(1).replace('.', ',')} Tỷ VNĐ`;
  document.getElementById('roi-rent-out').textContent = `${rentMillion} Triệu/tháng`;
  document.getElementById('roi-occupancy-out').textContent = `${occupancyPct}%`;
  document.getElementById('roi-expense-out').textContent = `${expensePct}% doanh thu`;
  document.getElementById('roi-growth-out').textContent = `${growthPct.toFixed(1).replace('.', ',')}%/năm`;

  document.getElementById('roi-net-yield').textContent = `${netYieldPct.toFixed(2).replace('.', ',')}%/năm`;
  document.getElementById('roi-annual-net').textContent = `${annualNetBillion.toFixed(2).replace('.', ',')} Tỷ VNĐ`;
  document.getElementById('roi-5y-value').textContent = `${value5Y.toFixed(2).replace('.', ',')} Tỷ VNĐ`;
  document.getElementById('roi-5y-total').textContent = `${totalProfit5Y.toFixed(2).replace('.', ',')} Tỷ VNĐ`;

  document.getElementById('roi-bar-rent').style.inlineSize = `${rentSharePct.toFixed(1)}%`;
  document.getElementById('roi-bar-growth').style.inlineSize = `${(100 - rentSharePct).toFixed(1)}%`;
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

  let isSubmitting = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!form.checkValidity()) {
      form.querySelector(':invalid')?.focus();
      return;
    }

    const DISCORD_WEBHOOK_URL =
      'https://discord.com/api/webhooks/1477541626317377689/N0ZDpv6M4SzilU07USvg8tA0s8EI6XN3_pZ4SQnj5Twfj9XyF6JbYAp4DqxKGoQDUZSa';

    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const email = String(data.get('email') || '').trim();
    const property = String(data.get('property') || 'Tư vấn danh mục phù hợp').trim();
    const visitDate = String(data.get('visitDate') || '').trim();
    const note = String(data.get('note') || '').trim();

    const submitErrorEl = document.getElementById('form-submit-error');
    const submitBtn = document.getElementById('lead-submit-btn');

    if (submitErrorEl) {
      submitErrorEl.hidden = true;
      submitErrorEl.textContent = '';
    }

    isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.textContent = 'Đang gửi yêu cầu...';
    }

    try {
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'AnGia Nhà Đất · Đặt Lịch',
          embeds: [
            {
              title: '📩 Khách mới đặt lịch xem nhà / tư vấn',
              color: 0x0b5ed7,
              fields: [
                { name: 'Họ và tên', value: name || 'Chưa nhập', inline: true },
                { name: 'Số điện thoại', value: phone || 'Chưa nhập', inline: true },
                { name: 'Email', value: email || 'Chưa nhập', inline: false },
                { name: 'Sản phẩm quan tâm', value: property, inline: false },
                { name: 'Ngày dự kiến đi xem', value: visitDate || 'Linh hoạt theo lịch', inline: true },
                { name: 'Ghi chú thêm', value: note || 'Không có ghi chú', inline: false },
              ],
              footer: { text: 'AnGia Nhà Đất · Hóc Môn' },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook HTTP ${response.status}`);
      }

      els.formSuccessDetails.textContent = `Cảm ơn ${name}. Bộ phận bán hàng AnGia Nhà Đất sẽ liên hệ qua số ${phone} để gửi bảng giá và hẹn lịch xem "${property}"${visitDate ? ` vào ngày ${visitDate}` : ''}.`;
      form.hidden = true;
      els.formSuccess.hidden = false;
      showToast('Đã gửi yêu cầu đặt lịch thành công!');
    } catch {
      if (submitErrorEl) {
        submitErrorEl.textContent =
          'Không thể gửi tự động lúc này. Vui lòng thử lại hoặc gọi/nhắn Zalo trực tiếp 0961 589 925.';
        submitErrorEl.hidden = false;
      }
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = 'Gửi yêu cầu đặt lịch';
      }
    }
  });

  els.resetFormBtn?.addEventListener('click', () => {
    form.reset();
    const submitErrorEl = document.getElementById('form-submit-error');
    if (submitErrorEl) {
      submitErrorEl.hidden = true;
      submitErrorEl.textContent = '';
    }
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

  document.querySelectorAll('.quick-tag[data-quick-city], .quick-tag[data-quick-budget]').forEach((tag) => {
    tag.addEventListener('click', () => {
      state.keyword = '';
      state.city = tag.dataset.quickCity || 'all';
      state.type = tag.dataset.quickType || 'all';
      state.budget = tag.dataset.quickBudget || 'all';
      state.onlySaved = false;

      els.searchKeyword.value = '';
      els.searchCity.value = state.city;
      els.searchType.value = state.type;
      els.searchBudget.value = state.budget;
      els.toggleSavedBtn.setAttribute('aria-pressed', 'false');

      syncFilterPills();
      renderProperties();
      document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
    });
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
    syncFilterPills();
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  els.propertyGrid.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) {
      const id = saveBtn.dataset.saveId;
      const item = PROPERTIES.find((p) => p.id === id);
      if (state.savedIds.has(id)) {
        state.savedIds.delete(id);
        if (item) showToast(`Đã bỏ lưu "${item.title}".`);
      } else {
        state.savedIds.add(id);
        if (item) showToast(`Đã lưu "${item.title}" vào danh sách quan tâm.`);
      }
      updateSavedCounter();
      if (state.onlySaved) renderProperties();
      else syncCardButtonsInPlace();
      return;
    }

    const compareBtn = e.target.closest('[data-compare-id]');
    if (compareBtn) {
      toggleCompareProperty(compareBtn.dataset.compareId);
      return;
    }

    const openBtn = e.target.closest('[data-open-id]');
    if (openBtn) {
      openPropertyDialog(openBtn.dataset.openId);
    }
  });

  els.compareChips?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-compare]');
    if (!removeBtn) return;
    toggleCompareProperty(removeBtn.dataset.removeCompare);
  });

  els.compareClearBtn?.addEventListener('click', () => {
    state.compareIds = [];
    saveCompareState();
    syncCardButtonsInPlace();
    renderCompareTray();
    showToast('Đã xóa toàn bộ danh sách so sánh.');
  });

  els.compareOpenBtn?.addEventListener('click', openCompareDialog);

  els.comingSoonGrid?.addEventListener('click', (e) => {
    const bookBtn = e.target.closest('[data-coming-soon-title]');
    if (!bookBtn) return;
    const label = `[Coming Soon] ${bookBtn.dataset.comingSoonTitle}`;
    if (els.leadPropertySelect) els.leadPropertySelect.value = label;
    document.getElementById('consultation')?.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('lead-name')?.focus();
    showToast(`Đã chọn "${label}" — để lại SĐT để nhận báo giá hời sớm nhất.`);
  });

  ['calc-price', 'calc-down', 'calc-rate', 'calc-years'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateMortgageCalculator);
  });

  ['roi-price', 'roi-rent', 'roi-occupancy', 'roi-expense', 'roi-growth'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateRoiCalculator);
  });
}

function init() {
  PROPERTIES.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.title;
    option.textContent = `${item.title} (${formatPriceBillion(item.priceBillion)})`;
    els.leadPropertySelect.append(option);
  });

  COMING_SOON.forEach((item) => {
    const option = document.createElement('option');
    const label = `[Coming Soon] ${item.title}`;
    option.value = label;
    option.textContent = label;
    els.leadPropertySelect.append(option);
  });

  const dateInput = document.getElementById('lead-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  setupAdaptiveNavbar();
  setupModalDialog(els.dialog, () => syncProjectUrlParam(null));
  setupModalDialog(els.compareDialog);
  activateFinancialTab = setupCalculatorTabs();
  setupFaqAccordion();
  setupFormValidation(els.consultationForm);
  updateSavedCounter();
  ensureComingSoonRendered();

  if (els.propertyGrid.children.length === 0) {
    renderProperties();
  } else if (state.savedIds.size > 0 || state.compareIds.length > 0) {
    syncCardButtonsInPlace();
  }

  renderCompareTray();
  updateMortgageCalculator();
  updateRoiCalculator();
  bindEvents();

  const deepLinkId = new URLSearchParams(window.location.search).get('du-an');
  if (deepLinkId && PROPERTIES.some((p) => p.id === deepLinkId)) {
    openPropertyDialog(deepLinkId);
  }
}

init();
