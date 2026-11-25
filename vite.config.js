import { defineConfig } from 'vite';
import {
  PROPERTIES,
  NEIGHBORHOODS,
  FAQS,
  SITE_URL,
  renderPropertyCardHtml,
  renderNeighborhoodCardHtml,
  renderFaqItemHtml,
  buildJsonLd,
} from './src/data/properties.js';

const base = process.env.BASE_PATH || '/';

function prerenderHtml() {
  return {
    name: 'prerender-real-estate-html',
    transformIndexHtml(html) {
      const propertiesHtml = PROPERTIES.map((item) =>
        renderPropertyCardHtml(item, { base: './', isSaved: false }),
      ).join('');
      const neighborhoodsHtml = NEIGHBORHOODS.map((area) =>
        renderNeighborhoodCardHtml(area, { base: './' }),
      ).join('');
      const faqsHtml = FAQS.map((faq, idx) => renderFaqItemHtml(faq, idx)).join('');
      const jsonLdHtml = buildJsonLd(SITE_URL);

      return html
        .replace('<!--SSR_JSON_LD-->', jsonLdHtml)
        .replace('<!--SSR_PROPERTIES-->', propertiesHtml)
        .replace('<!--SSR_NEIGHBORHOODS-->', neighborhoodsHtml)
        .replace('<!--SSR_FAQS-->', faqsHtml);
    },
  };
}

export default defineConfig({
  base,
  plugins: [prerenderHtml()],
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
