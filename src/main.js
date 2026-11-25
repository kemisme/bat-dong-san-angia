import './styles/main.css';
import {
  PROPERTIES,
  NEIGHBORHOODS,
  SITE_URL,
  defaultSlugForType,
  escapeHtml,
  renderPictureHtml,
  renderPropertyCardHtml,
  renderNeighborhoodCardHtml,
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
const USER_LISTINGS_KEY = 'angia-user-listings';
const MAX_COMPARE = 3;

function loadUserListings() {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_LISTINGS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

const state = {
  keyword: '',
  city: 'all',
  type: 'all',
  budget: 'all',
  sort: 'featured',
  onlySaved: false,
  onlyMyPosts: false,
  userListings: loadUserListings(),
  savedIds: new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')),
  compareIds: JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]'),
};

function getAllProperties() {
  return [...state.userListings, ...PROPERTIES];
}

// Clean stale compare IDs against loaded properties
state.compareIds = state.compareIds.filter((id) => getAllProperties().some((p) => p.id === id));

const els = {
  header: document.getElementById('site-header'),
  headerInner: document.querySelector('.header-inner'),
  siteNav: document.querySelector('.site-nav'),
  siteMenu: document.getElementById('site-menu'),
  propertyGrid: document.getElementById('property-grid'),
  neighborhoodGrid: document.getElementById('neighborhood-grid'),
  resultsSummary: document.getElementById('results-summary'),
  savedCount: document.getElementById('saved-count'),
  myPostsCount: document.getElementById('my-posts-count'),
  toggleSavedBtn: document.getElementById('toggle-saved-btn'),
  toggleMyPostsBtn: document.getElementById('toggle-my-posts-btn'),
  openPostBtn: document.getElementById('open-post-btn'),
  heroSearchForm: document.getElementById('hero-search-form'),
  searchKeyword: document.getElementById('search-keyword'),
  searchCity: document.getElementById('search-city'),
  searchType: document.getElementById('search-type'),
  searchBudget: document.getElementById('search-budget'),
  sortSelect: document.getElementById('sort-select'),
  filterPills: document.querySelectorAll('.pill[data-filter-type]'),
  dialog: document.getElementById('property-dialog'),
  dialogContent: document.getElementById('dialog-content'),
  postDialog: document.getElementById('post-dialog'),
  postForm: document.getElementById('post-listing-form'),
  postImageInput: document.getElementById('post-image'),
  postImagePreview: document.getElementById('post-image-preview'),
  postImagePreviewImg: document.getElementById('post-image-preview-img'),
  postImageClear: document.getElementById('post-image-clear'),
  postCancelBtn: document.getElementById('post-cancel-btn'),
  postQuotaError: document.getElementById('post-quota-error'),
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
  const all = getAllProperties();

  let list = all.filter((item) => {
    if (state.onlySaved && !state.savedIds.has(item.id)) return false;
    if (state.onlyMyPosts && !item.isUserListing) return false;
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

function updateMyPostsCounter() {
  if (els.myPostsCount) {
    els.myPostsCount.textContent = String(state.userListings.length);
  }
}

function syncLeadPropertyOptions() {
  if (!els.leadPropertySelect) return;
  els.leadPropertySelect.innerHTML = '<option value="Tư vấn danh mục phù hợp">Tư vấn danh mục phù hợp</option>';
  getAllProperties().forEach((item) => {
    const option = document.createElement('option');
    option.value = item.title;
    option.textContent = `${item.title} (${Number(item.priceBillion).toFixed(1).replace('.', ',')} Tỷ)`;
    els.leadPropertySelect.append(option);
  });
}

function syncCardButtonsInPlace() {
  const all = getAllProperties();
  const compareSet = new Set(state.compareIds);

  els.propertyGrid.querySelectorAll('[data-save-id]').forEach((btn) => {
    const id = btn.dataset.saveId;
    const item = all.find((p) => p.id === id);
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

  if (state.onlySaved) {
    els.resultsSummary.textContent = `Đang xem ${items.length} bất động sản đã lưu`;
  } else if (state.onlyMyPosts) {
    els.resultsSummary.textContent = `Đang xem ${items.length} tin bất động sản bạn đã đăng`;
  } else {
    els.resultsSummary.textContent = `Đang hiển thị ${items.length} bất động sản phù hợp`;
  }

  if (!items.length) {
    els.propertyGrid.innerHTML = `
      <div class="empty-state">
        <h3>${state.onlyMyPosts ? 'Bạn chưa đăng tin nào' : 'Không tìm thấy bất động sản khớp bộ lọc'}</h3>
        <p>${
          state.onlyMyPosts
            ? 'Bấm "+ Đăng tin" ở góc trên để tạo tin rao bất động sản đầu tiên của bạn.'
            : 'Hãy thử mở rộng khoảng giá hoặc đặt lại bộ lọc để xem toàn bộ danh mục.'
        }</p>
        <div class="card-actions" style="justify-content:center; margin-top: 1rem;">
          <button type="button" class="btn btn-primary" id="clear-filters-btn">Xem tất cả nhà đất</button>
          ${state.onlyMyPosts ? '<button type="button" class="btn btn-accent" id="empty-post-btn">+ Đăng tin ngay</button>' : ''}
        </div>
      </div>
    `;
    document.getElementById('clear-filters-btn')?.addEventListener('click', resetFilters);
    document.getElementById('empty-post-btn')?.addEventListener('click', openPostDialog);
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
  state.onlyMyPosts = false;
  els.searchKeyword.value = '';
  els.searchCity.value = 'all';
  els.searchType.value = 'all';
  els.searchBudget.value = 'all';
  els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
  els.toggleMyPostsBtn?.setAttribute('aria-pressed', 'false');
  syncFilterPills();
  renderProperties();
}

function syncFilterPills() {
  els.filterPills.forEach((pill) => {
    pill.classList.toggle('is-active', !state.onlyMyPosts && pill.dataset.filterType === state.type);
  });
}

function ensureNeighborhoodsRendered() {
  if (els.neighborhoodGrid.children.length > 0) return;
  els.neighborhoodGrid.innerHTML = NEIGHBORHOODS.map((area) =>
    renderNeighborhoodCardHtml(area, { base }),
  ).join('');
}

/* ---------- Post New Listing ("Đăng tin") ---------- */
let uploadedImageDataUrl = '';

async function compressImageFile(file) {
  const maxWidth = 800;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.78);
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clearUploadedImage() {
  uploadedImageDataUrl = '';
  if (els.postImageInput) els.postImageInput.value = '';
  if (els.postImagePreview) els.postImagePreview.hidden = true;
  if (els.postImagePreviewImg) els.postImagePreviewImg.src = '';
}

function openPostDialog() {
  if (!els.postDialog) return;
  if (els.postQuotaError) els.postQuotaError.textContent = '';
  els.postDialog.showModal();
}

function saveUserListingsToStorage(listings) {
  localStorage.setItem(USER_LISTINGS_KEY, JSON.stringify(listings));
}

function deleteUserListing(id) {
  const target = state.userListings.find((item) => item.id === id);
  if (!target) return;

  state.userListings = state.userListings.filter((item) => item.id !== id);
  state.savedIds.delete(id);
  state.compareIds = state.compareIds.filter((cid) => cid !== id);

  saveUserListingsToStorage(state.userListings);
  updateSavedCounter();
  saveCompareState();
  updateMyPostsCounter();
  syncLeadPropertyOptions();
  renderCompareTray();
  renderProperties();

  if (els.dialog?.open) {
    els.dialog.close('deleted');
  }
  showToast(`Đã xóa tin "${target.title}".`);
}

function setupPostListing() {
  if (!els.postDialog || !els.postForm) return;

  setupModalDialog(els.postDialog);
  setupFormValidation(els.postForm);

  els.openPostBtn?.addEventListener('click', openPostDialog);
  document.querySelectorAll('[data-open-post]').forEach((btn) => {
    btn.addEventListener('click', openPostDialog);
  });

  els.postCancelBtn?.addEventListener('click', () => {
    els.postDialog.close('cancel');
  });

  els.postImageInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      clearUploadedImage();
      return;
    }
    try {
      uploadedImageDataUrl = await compressImageFile(file);
      els.postImagePreviewImg.src = uploadedImageDataUrl;
      els.postImagePreview.hidden = false;
    } catch {
      clearUploadedImage();
    }
  });

  els.postImageClear?.addEventListener('click', clearUploadedImage);

  els.postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!els.postForm.checkValidity()) {
      els.postForm.querySelector(':invalid')?.focus();
      return;
    }

    const data = new FormData(els.postForm);
    const title = String(data.get('title')).trim();
    const type = String(data.get('type'));
    const city = String(data.get('city'));
    const district = String(data.get('district')).trim();
    const priceBillion = Number(data.get('priceBillion'));
    const area = Number(data.get('area'));
    const bedrooms = Number(data.get('bedrooms') || 0);
    const bathrooms = Number(data.get('bathrooms') || 0);
    const legal = String(data.get('legal'));
    const contactPhone = String(data.get('phone')).trim();
    const summary = String(data.get('summary')).trim();

    const sqmMillion = Math.max(1, Math.round((priceBillion * 1000) / area));
    const estimatedRent = Math.max(8, Math.round((priceBillion * 1000 * 0.04) / 12));

    const newListing = {
      id: `user-${Date.now()}`,
      isUserListing: true,
      title,
      type,
      city,
      district,
      status: 'Tin bạn đăng',
      priceBillion,
      pricePerSqm: `${sqmMillion} Triệu/m²`,
      pricePerSqmNum: sqmMillion,
      rentalMonthlyMillion: estimatedRent,
      appreciationPct: 7.0,
      area,
      bedrooms,
      bathrooms,
      direction: 'Đang cập nhật',
      legal,
      handover: 'Liên hệ chính chủ',
      contactPhone,
      imageSlug: defaultSlugForType(type),
      customImage: uploadedImageDataUrl || '',
      summary,
      highlights: [
        `Tin đăng trực tiếp tại ${district}, ${city}`,
        `Pháp lý: ${legal} — Liên hệ SĐT: ${contactPhone}`,
        `Đơn giá tham chiếu khoảng ${sqmMillion} Triệu/m²`,
      ],
      amenities: [
        { name: 'Khu vực trung tâm', distance: district },
        { name: 'Liên hệ chính chủ', distance: contactPhone },
        { name: 'Pháp lý công chứng', distance: legal },
        { name: 'Hỗ trợ xem nhà', distance: 'Theo lịch hẹn' },
      ],
      paymentPlan: `Thỏa thuận trực tiếp chính chủ qua SĐT ${contactPhone}.`,
    };

    const nextListings = [newListing, ...state.userListings];
    try {
      saveUserListingsToStorage(nextListings);
    } catch {
      if (els.postQuotaError) {
        els.postQuotaError.textContent =
          'Bộ nhớ trình duyệt đã đầy dung lượng ảnh. Hãy bấm "Bỏ ảnh đã chọn" hoặc xóa bớt tin cũ rồi thử lại.';
      }
      return;
    }

    state.userListings = nextListings;
    els.postForm.reset();
    clearUploadedImage();
    if (els.postQuotaError) els.postQuotaError.textContent = '';

    updateMyPostsCounter();
    syncLeadPropertyOptions();
    resetFilters();
    els.postDialog.close('published');
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
    showToast(`Đã đăng tin "${title}" lên danh sách!`);
  });
}

/* ---------- Side-by-Side Comparison & Responsive Table ---------- */
function saveCompareState() {
  localStorage.setItem(COMPARE_KEY, JSON.stringify(state.compareIds));
}

function renderCompareTray() {
  if (!els.compareTray) return;
  const all = getAllProperties();
  const items = state.compareIds.map((id) => all.find((p) => p.id === id)).filter(Boolean);

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
  const item = getAllProperties().find((p) => p.id === id);
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
  const all = getAllProperties();
  const items = state.compareIds.map((id) => all.find((p) => p.id === id)).filter(Boolean);
  if (items.length < 2) {
    showToast('Vui lòng chọn ít nhất 2 bất động sản để so sánh.');
    return;
  }

  const minSqmPrice = Math.min(...items.map((p) => p.pricePerSqmNum));
  const maxArea = Math.max(...items.map((p) => p.area));
  const maxYield = Math.max(
    ...items.map((p) => ((p.rentalMonthlyMillion * 12 * 0.9 * 0.9) / (p.priceBillion * 1000)) * 100),
  );

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
      render: (p) => `<strong>${Number(p.priceBillion).toFixed(1).replace('.', ',')} Tỷ VNĐ</strong>`,
    },
    {
      label: 'Đơn giá / m²',
      render: (p) =>
        `${escapeHtml(p.pricePerSqm)}${
          p.pricePerSqmNum === minSqmPrice ? ' <span class="best-tag">Tốt nhất</span>' : ''
        }`,
    },
    {
      label: 'Diện tích',
      render: (p) =>
        `${p.area} m²${p.area === maxArea ? ' <span class="best-tag">Rộng nhất</span>' : ''}`,
    },
    {
      label: 'Kết cấu',
      render: (p) => `${p.bedrooms} Phòng ngủ · ${p.bathrooms} Phòng tắm`,
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
        const netYield = ((p.rentalMonthlyMillion * 12 * 0.9 * 0.9) / (p.priceBillion * 1000)) * 100;
        const isBest = Math.abs(netYield - maxYield) < 0.001;
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
        )}">Đặt lịch xem</button>`,
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
  if (propertyId && !propertyId.startsWith('user-')) url.searchParams.set('du-an', propertyId);
  else url.searchParams.delete('du-an');
  window.history.replaceState({}, '', url);
}

function openPropertyDialog(propertyId) {
  const item = getAllProperties().find((p) => p.id === propertyId);
  if (!item) return;

  syncProjectUrlParam(item.id);

  const heroMediaHtml = item.customImage
    ? `<img src="${escapeHtml(item.customImage)}" alt="${escapeHtml(item.title)}" width="880" height="440" fetchpriority="low" loading="lazy" />`
    : renderPictureHtml({
        slug: item.imageSlug || defaultSlugForType(item.type),
        alt: item.title,
        width: 880,
        height: 440,
        sizes: '(max-width: 900px) 92vw, 880px',
        base,
        loading: 'lazy',
        fetchpriority: 'low',
      });

  const deleteActionHtml = item.isUserListing
    ? `<button type="button" class="btn btn-danger-outline" id="dialog-delete-btn">Xóa tin này</button>`
    : '';

  const contactLineHtml = item.contactPhone
    ? `<p><strong>Liên hệ chính chủ:</strong> <a href="tel:${escapeHtml(item.contactPhone)}">${escapeHtml(item.contactPhone)}</a></p>`
    : '';

  els.dialogContent.innerHTML = `
    <div class="dialog-hero">
      ${heroMediaHtml}
      <form method="dialog">
        <button type="submit" class="dialog-close" value="close" aria-label="Đóng hộp thoại chi tiết">✕</button>
      </form>
    </div>
    <div class="dialog-body">
      <div class="dialog-top">
        <div>
          <p class="card-location">${escapeHtml(item.district)} · ${escapeHtml(item.city)} · ${escapeHtml(item.status)}</p>
          <h1 id="dialog-title">${escapeHtml(item.title)}</h1>
        </div>
        <div class="dialog-price">
          <strong>${Number(item.priceBillion).toFixed(1).replace('.', ',')} Tỷ VNĐ</strong>
          <span>${escapeHtml(item.pricePerSqm)}</span>
        </div>
      </div>

      <p>${escapeHtml(item.summary)}</p>
      ${contactLineHtml}

      <div class="dialog-specs-grid">
        <div class="dialog-spec"><small>Diện tích</small><strong>${item.area} m²</strong></div>
        <div class="dialog-spec"><small>Phòng ngủ / Tắm</small><strong>${item.bedrooms} PN · ${item.bathrooms} PT</strong></div>
        <div class="dialog-spec"><small>Hướng chính</small><strong>${escapeHtml(item.direction)}</strong></div>
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

      <p><strong>Chính sách thanh toán:</strong> ${escapeHtml(item.paymentPlan)}</p>
      <p id="share-inline-status" class="share-inline-status" aria-live="polite"></p>

      <div class="dialog-actions">
        <form method="dialog">
          <button type="submit" value="cancel" class="btn btn-outline">Đóng</button>
        </form>
        ${deleteActionHtml}
        <button type="button" class="btn btn-outline" id="dialog-share-btn">Chia sẻ</button>
        <button type="button" class="btn btn-accent" id="dialog-roi-btn">Phân tích ROI</button>
        <button type="button" class="btn btn-primary" id="dialog-book-btn" autofocus>Đặt lịch xem thực tế</button>
      </div>
    </div>
  `;

  els.dialog.showModal();

  document.getElementById('dialog-delete-btn')?.addEventListener('click', () => {
    deleteUserListing(item.id);
  });

  document.getElementById('dialog-share-btn')?.addEventListener('click', async () => {
    const shareText = `${item.title} (${Number(item.priceBillion).toFixed(1).replace('.', ',')} Tỷ) — ${item.district}, ${item.city}${
      item.contactPhone ? ` · LH: ${item.contactPhone}` : ''
    }`;
    const shareUrl = item.isUserListing ? SITE_URL : `${SITE_URL}?du-an=${item.id}`;
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

    const clipboardPayload = item.isUserListing ? shareText : shareUrl;
    try {
      await navigator.clipboard.writeText(clipboardPayload);
      if (statusEl) statusEl.textContent = `Đã sao chép: ${clipboardPayload}`;
    } catch {
      if (statusEl) statusEl.textContent = `Thông tin chia sẻ: ${clipboardPayload}`;
    }
  });

  document.getElementById('dialog-roi-btn')?.addEventListener('click', () => {
    const roiPrice = document.getElementById('roi-price');
    const roiRent = document.getElementById('roi-rent');
    const roiGrowth = document.getElementById('roi-growth');
    if (roiPrice) roiPrice.value = String(Math.min(100, Math.max(5, item.priceBillion)));
    if (roiRent) roiRent.value = String(Math.min(250, Math.max(15, item.rentalMonthlyMillion)));
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

/* ---------- Consultation & Post Form Validation ---------- */
let sharedAnnouncer = null;
function getErrorAnnouncer() {
  if (sharedAnnouncer) return sharedAnnouncer;
  sharedAnnouncer = document.createElement('div');
  sharedAnnouncer.setAttribute('aria-live', 'polite');
  sharedAnnouncer.classList.add('visually-hidden');
  document.body.append(sharedAnnouncer);
  return sharedAnnouncer;
}

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

  const announcer = getErrorAnnouncer();
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
}

function setupConsultationSubmit() {
  const form = els.consultationForm;
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.querySelector(':invalid')?.focus();
      return;
    }

    const data = new FormData(form);
    const name = data.get('name');
    const phone = data.get('phone');
    const property = data.get('property');
    const visitDate = data.get('visitDate');

    els.formSuccessDetails.textContent = `Cảm ơn ${name}. Chuyên viên AnGia Nhà Đất sẽ liên hệ qua số ${phone} để xác nhận lịch xem "${property}"${visitDate ? ` vào ngày ${visitDate}` : ''}.`;
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
    state.onlyMyPosts = false;
    els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
    els.toggleMyPostsBtn?.setAttribute('aria-pressed', 'false');
    syncFilterPills();
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('.quick-tag:not([data-open-post])').forEach((tag) => {
    tag.addEventListener('click', () => {
      state.keyword = '';
      state.city = tag.dataset.quickCity || 'all';
      state.type = tag.dataset.quickType || 'all';
      state.budget = tag.dataset.quickBudget || 'all';
      state.onlySaved = false;
      state.onlyMyPosts = false;

      els.searchKeyword.value = '';
      els.searchCity.value = state.city;
      els.searchType.value = state.type;
      els.searchBudget.value = state.budget;
      els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
      els.toggleMyPostsBtn?.setAttribute('aria-pressed', 'false');

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
      state.onlyMyPosts = false;
      els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
      els.toggleMyPostsBtn?.setAttribute('aria-pressed', 'false');
      syncFilterPills();
      renderProperties();
    });
  });

  els.toggleMyPostsBtn?.addEventListener('click', () => {
    state.onlyMyPosts = !state.onlyMyPosts;
    state.onlySaved = false;
    els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
    els.toggleMyPostsBtn.setAttribute('aria-pressed', state.onlyMyPosts ? 'true' : 'false');
    syncFilterPills();
    renderProperties();
  });

  els.sortSelect.addEventListener('change', () => {
    state.sort = els.sortSelect.value;
    renderProperties();
  });

  els.toggleSavedBtn.addEventListener('click', () => {
    state.onlySaved = !state.onlySaved;
    state.onlyMyPosts = false;
    els.toggleSavedBtn.setAttribute('aria-pressed', state.onlySaved ? 'true' : 'false');
    els.toggleMyPostsBtn?.setAttribute('aria-pressed', 'false');
    syncFilterPills();
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  els.propertyGrid.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) {
      const id = saveBtn.dataset.saveId;
      const item = getAllProperties().find((p) => p.id === id);
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

    const deleteBtn = e.target.closest('[data-delete-id]');
    if (deleteBtn) {
      deleteUserListing(deleteBtn.dataset.deleteId);
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

  els.neighborhoodGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-city-pick]');
    if (!card) return;
    state.city = card.dataset.cityPick;
    state.onlySaved = false;
    state.onlyMyPosts = false;
    els.searchCity.value = state.city;
    els.toggleSavedBtn.setAttribute('aria-pressed', 'false');
    els.toggleMyPostsBtn?.setAttribute('aria-pressed', 'false');
    syncFilterPills();
    renderProperties();
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  });

  ['calc-price', 'calc-down', 'calc-rate', 'calc-years'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateMortgageCalculator);
  });

  ['roi-price', 'roi-rent', 'roi-occupancy', 'roi-expense', 'roi-growth'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateRoiCalculator);
  });
}

function init() {
  const dateInput = document.getElementById('lead-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  setupAdaptiveNavbar();
  setupModalDialog(els.dialog, () => syncProjectUrlParam(null));
  setupModalDialog(els.compareDialog);
  setupPostListing();
  activateFinancialTab = setupCalculatorTabs();
  setupFaqAccordion();
  setupFormValidation(els.consultationForm);
  setupConsultationSubmit();
  updateSavedCounter();
  updateMyPostsCounter();
  syncLeadPropertyOptions();
  ensureNeighborhoodsRendered();

  if (els.propertyGrid.children.length === 0 || state.userListings.length > 0) {
    renderProperties();
  } else if (state.savedIds.size > 0 || state.compareIds.length > 0) {
    syncCardButtonsInPlace();
  }

  renderCompareTray();
  updateMortgageCalculator();
  updateRoiCalculator();
  bindEvents();

  const deepLinkId = new URLSearchParams(window.location.search).get('du-an');
  if (deepLinkId && getAllProperties().some((p) => p.id === deepLinkId)) {
    openPropertyDialog(deepLinkId);
  }
}

init();
