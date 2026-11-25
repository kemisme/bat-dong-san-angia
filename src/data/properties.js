import listings from './listings.json' with { type: 'json' };
import comingSoon from './coming-soon.json' with { type: 'json' };

export const SITE_URL = 'https://kemisme.github.io/bat-dong-san-angia/';

export const PROPERTIES = listings;
export const COMING_SOON = comingSoon;

export const NEIGHBORHOODS = [
  {
    id: 'hcm',
    city: 'TP.HCM',
    name: 'Thảo Điền & Thủ Thiêm',
    subtitle: 'Trung tâm tài chính & cộng đồng quốc tế bên sông Sài Gòn',
    count: '38 sản phẩm chọn lọc',
    avgPrice: '92 – 210 Triệu/m²',
    imageSlug: 'waterfront-tower',
  },
  {
    id: 'hanoi',
    city: 'Hà Nội',
    name: 'Tây Hồ & Tây Hồ Tây',
    subtitle: 'Di sản sống thanh bình bên hồ nước lớn nhất Thủ đô',
    count: '24 sản phẩm chọn lọc',
    avgPrice: '165 – 260 Triệu/m²',
    imageSlug: 'townhouse-facade',
  },
  {
    id: 'danang',
    city: 'Đà Nẵng',
    name: 'Bán Đảo Sơn Trà & Mỹ Khê',
    subtitle: 'Bất động sản nghỉ dưỡng biển kết hợp an cư dài lâu',
    count: '19 sản phẩm chọn lọc',
    avgPrice: '85 – 140 Triệu/m²',
    imageSlug: 'garden-villa',
  },
];

export const FAQS = [
  {
    id: 'faq-legal',
    question: 'Pháp lý các dự án tại AnGia Nhà Đất được kiểm tra như thế nào trước khi giao dịch?',
    answer:
      'Mọi bất động sản trong danh mục phân phối đều được kiểm tra đầy đủ hồ sơ trước khi giới thiệu: giấy chứng nhận quyền sử dụng đất (sổ hồng/sổ đỏ), quy hoạch 1/500, giấy phép xây dựng, văn bản nghiệm thu hoàn công và xác nhận không tranh chấp thế chấp.',
  },
  {
    id: 'faq-loan',
    question: 'Khách hàng được hỗ trợ vay ngân hàng tối đa bao nhiêu phần trăm giá trị căn nhà?',
    answer:
      'Đối với các bất động sản đã có sổ hồng hoặc dự án có ngân hàng bảo lãnh, khách hàng có thể vay tối đa 65% đến 70% giá trị tài sản với thời hạn lên đến 35 năm, kèm các gói ân hạn gốc và lãi suất ưu đãi 12–24 tháng đầu.',
  },
  {
    id: 'faq-fees',
    question: 'Chi phí sang tên công chứng và thuế mua bán bất động sản gồm những khoản nào?',
    answer:
      'Khi chuyển nhượng nhà đất đã có sổ, giao dịch gồm lệ phí trước bạ (0,5% giá trị tính thuế), thuế thu nhập cá nhân bên bán (2% theo thỏa thuận hợp đồng), phí công chứng và lệ phí thẩm định hồ sơ cấp đổi sổ. Với căn hộ hình thành trong tương lai sẽ áp dụng phí bảo trì 2% khi nhận bàn giao.',
  },
  {
    id: 'faq-tour',
    question: 'Quy trình liên hệ bán hàng và đặt lịch xem nhà thực tế diễn ra ra sao?',
    answer:
      'Sau khi bạn gửi thông tin qua mục Liên hệ bán hàng hoặc chọn căn muốn xem, bộ phận kinh doanh trực tiếp sẽ liên hệ trong 15 phút làm việc để gửi hồ sơ mặt bằng, bảng giá chi tiết, phương án vay ngân hàng và sắp xếp lịch tham quan thực tế 1:1.',
  },
  {
    id: 'faq-foreign',
    question: 'Việt kiều và người nước ngoài có thể sở hữu bất động sản tại Việt Nam không?',
    answer:
      'Có. Theo Luật Nhà ở và Luật Đất đai hiện hành, người Việt Nam định cư ở nước ngoài (còn quốc tịch Việt Nam hoặc gốc Việt) và cá nhân nước ngoài nhập cảnh hợp pháp được phép mua, sở hữu nhà ở thương mại nằm ngoài khu vực quốc phòng an ninh trong hạn mức quy định của từng dự án.',
  },
];

export function defaultSlugForType(type) {
  switch (type) {
    case 'Căn hộ':
      return 'waterfront-tower';
    case 'Biệt thự':
      return 'garden-villa';
    case 'Penthouse':
      return 'penthouse-interior';
    case 'Nhà phố':
    case 'Đất nền':
    default:
      return 'townhouse-facade';
  }
}

export function formatPriceBillion(priceBillion, suffix = 'Tỷ') {
  if (priceBillion == null || Number(priceBillion) <= 0) return 'Giá liên hệ';
  const num = Number(priceBillion);
  const formatted = Math.abs(num * 10 - Math.round(num * 10)) < 1e-6 ? num.toFixed(1) : Number(num.toFixed(2)).toString();
  return `${formatted.replace('.', ',')} ${suffix}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderPictureHtml({
  slug,
  alt,
  width = 640,
  height = 400,
  sizes = '(max-width: 720px) 100vw, 400px',
  base = './',
  className = '',
  loading = 'lazy',
  fetchpriority = '',
}) {
  const safeAlt = escapeHtml(alt);
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  const priorityAttr = fetchpriority ? ` fetchpriority="${fetchpriority}"` : '';
  const loadingAttr = loading ? ` loading="${loading}"` : '';

  return `<picture>
    <source type="image/avif" srcset="${base}images/${slug}-640.avif 640w, ${base}images/${slug}-800.avif 800w, ${base}images/${slug}-1200.avif 1200w" sizes="${sizes}" />
    <source type="image/webp" srcset="${base}images/${slug}-640.webp 640w, ${base}images/${slug}-800.webp 800w, ${base}images/${slug}-1200.webp 1200w" sizes="${sizes}" />
    <img${classAttr} src="${base}images/${slug}-800.jpg" alt="${safeAlt}" width="${width}" height="${height}"${loadingAttr}${priorityAttr} decoding="async" />
  </picture>`;
}

export function renderPropertyCardHtml(item, { base = './', isSaved = false, isCompared = false } = {}) {
  const safeTitle = escapeHtml(item.title);
  const mediaHtml = renderPictureHtml({
    slug: item.imageSlug || defaultSlugForType(item.type),
    alt: `${item.title} tại ${item.district}`,
    width: 640,
    height: 400,
    sizes: '(max-width: 720px) 100vw, (max-width: 1120px) 50vw, 390px',
    base,
    loading: 'lazy',
  });

  const isLand = item.type === 'Đất nền' || item.bedrooms === 0;
  const specsHtml = isLand
    ? `<li>${item.area} m²</li>
       <li>${escapeHtml(item.dimensions || 'Đất thổ cư')}</li>
       <li>${escapeHtml(item.handover)}</li>`
    : `<li>${item.area} m²</li>
       <li>${item.bedrooms} PN</li>
       <li>${item.bathrooms} PT</li>
       <li>${escapeHtml(item.handover)}</li>`;

  const photoCount = item.gallery?.length || 1;
  const photoBadgeHtml =
    photoCount > 1
      ? `<span class="card-photo-count" aria-label="${photoCount} hình ảnh thực tế">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10.5" r="1.5" />
            <path d="M21 15l-5-5L5 19" />
          </svg>
          ${photoCount} ảnh
        </span>`
      : '';

  return `
    <article class="property-card-wrap" data-property-id="${item.id}">
      <div class="card-media" data-open-id="${item.id}">
        ${mediaHtml}
        <div class="card-badges">
          <span class="badge">${escapeHtml(item.type)}</span>
          <span class="badge badge-accent">${escapeHtml(item.status)}</span>
        </div>
        ${photoBadgeHtml}
        <button
          type="button"
          class="save-btn"
          data-save-id="${item.id}"
          aria-pressed="${isSaved ? 'true' : 'false'}"
          aria-label="${isSaved ? 'Bỏ lưu' : 'Lưu'} ${safeTitle}"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <header class="card-header">
        <p class="card-location">${escapeHtml(item.district)} · ${escapeHtml(item.city)}</p>
        <h3 class="card-title">${safeTitle}</h3>
      </header>

      <div class="card-body">
        <p class="card-summary">${escapeHtml(item.summary)}</p>
        <ul class="card-specs">
          ${specsHtml}
        </ul>
      </div>

      <footer class="card-footer">
        <div class="card-price">
          <strong>${formatPriceBillion(item.priceBillion)}</strong>
          <span>${escapeHtml(item.pricePerSqm)}</span>
        </div>
        <div class="card-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm compare-toggle-btn"
            data-compare-id="${item.id}"
            aria-pressed="${isCompared ? 'true' : 'false'}"
            aria-label="So sánh ${safeTitle}"
          >
            So sánh
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-open-id="${item.id}">
            Xem chi tiết
          </button>
        </div>
      </footer>
    </article>
  `;
}

export function renderNeighborhoodCardHtml(area, { base = './' } = {}) {
  return `
    <button type="button" class="neighborhood-card" data-city-pick="${escapeHtml(area.city)}">
      ${renderPictureHtml({
        slug: area.imageSlug,
        alt: `${area.name} — ${area.city}`,
        width: 640,
        height: 420,
        sizes: '(max-width: 720px) 100vw, 390px',
        base,
        loading: 'lazy',
      })}
      <div class="neighborhood-overlay">
        <h3>${escapeHtml(area.name)}</h3>
        <p>${escapeHtml(area.subtitle)}</p>
        <div class="neighborhood-meta">
          <span>${escapeHtml(area.count)}</span>
          <span>${escapeHtml(area.avgPrice)}</span>
        </div>
      </div>
    </button>
  `;
}

export function renderComingSoonCardHtml(item) {
  const phoneRaw = String(item.contactPhone || '0961589925').replace(/\s+/g, '');
  const phoneDisplay = phoneRaw.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
  const safeTitle = escapeHtml(item.title);

  return `
    <article class="coming-soon-card" data-coming-soon-id="${escapeHtml(item.id)}">
      <div class="coming-soon-card-top">
        <span class="coming-soon-badge">
          <span class="coming-soon-dot" aria-hidden="true"></span>
          ${escapeHtml(item.badge || 'COMING SOON')}
        </span>
        <span class="coming-soon-eta">${escapeHtml(item.launchEta || 'Sắp mở bán')}</span>
      </div>

      <h3 class="coming-soon-title">${safeTitle}</h3>
      <p class="coming-soon-location">${escapeHtml(item.location)}</p>

      <dl class="coming-soon-facts">
        <div>
          <dt>Thông tin nhanh</dt>
          <dd>${escapeHtml(item.specs)}</dd>
        </div>
        <div>
          <dt>Giá mua sớm</dt>
          <dd class="coming-soon-price">${escapeHtml(item.priceNote)}</dd>
        </div>
      </dl>

      <p class="coming-soon-note">${escapeHtml(item.note)}</p>

      <footer class="coming-soon-actions">
        <button type="button" class="btn btn-accent btn-sm" data-coming-soon-title="${safeTitle}">
          Liên hệ mua sớm giá hời
        </button>
        <a
          href="https://zalo.me/${escapeHtml(phoneRaw)}"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-coming-soon-ghost btn-sm"
        >
          Zalo chốt giá: ${escapeHtml(phoneDisplay)}
        </a>
      </footer>
    </article>
  `;
}

export function renderFaqItemHtml(faq, index) {
  const panelId = `faq-panel-${index + 1}`;
  return `
    <article class="faq-item">
      <h3>
        <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="${panelId}">
          <span>${escapeHtml(faq.question)}</span>
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
      </h3>
      <div id="${panelId}" class="faq-panel" hidden>
        <p>${escapeHtml(faq.answer)}</p>
      </div>
    </article>
  `;
}

export function buildJsonLd(siteUrl = SITE_URL) {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateAgent',
        '@id': `${siteUrl}#organization`,
        name: 'AnGia Nhà Đất',
        url: siteUrl,
        logo: `${siteUrl}favicon.svg`,
        image: `${siteUrl}images/hero-villa-1200.jpg`,
        description:
          'Kênh giới thiệu, mua bán đất nền và nhà phố chính chủ tại Hóc Môn, sát Quận 12, TP.HCM với pháp lý minh bạch, liên hệ trực tiếp 0961 589 925.',
        telephone: '+84-961-589-925',
        areaServed: ['Hóc Môn', 'Quận 12', 'TP. Hồ Chí Minh'],
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Đông Thạnh – Tân Xuân',
          addressLocality: 'Hóc Môn',
          addressRegion: 'TP. Hồ Chí Minh',
          addressCountry: 'VN',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name: 'Nhà Đất Hóc Môn Chính Chủ — AnGia Nhà Đất (K)',
        inLanguage: 'vi-VN',
        publisher: { '@id': `${siteUrl}#organization` },
      },
      {
        '@type': 'ItemList',
        '@id': `${siteUrl}#listings`,
        name: 'Danh mục nhà đất chính chủ Hóc Môn — AnGia Nhà Đất',
        numberOfItems: PROPERTIES.length,
        itemListElement: PROPERTIES.map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          item: {
            '@type': 'RealEstateListing',
            name: item.title,
            description: item.summary,
            url: `${siteUrl}?du-an=${item.id}`,
            image: `${siteUrl}images/${item.imageSlug}-800.jpg`,
            offers: {
              '@type': 'Offer',
              ...(item.priceBillion != null && Number(item.priceBillion) > 0
                ? { price: Math.round(item.priceBillion * 1_000_000_000) }
                : {}),
              priceCurrency: 'VND',
              availability: 'https://schema.org/InStock',
            },
          },
        })),
      },
      {
        '@type': 'FAQPage',
        '@id': `${siteUrl}#faq`,
        mainEntity: FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
}
