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

function prerenderAndInlineCss() {
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
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (!htmlAsset || typeof htmlAsset.source !== 'string') return;

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && asset.type === 'asset' && typeof asset.source === 'string') {
          const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const linkRegex = new RegExp(`<link\\s+rel="stylesheet"[^>]*href="[^"]*${escapedName}"[^>]*>`, 'i');
          if (linkRegex.test(htmlAsset.source)) {
            htmlAsset.source = htmlAsset.source.replace(linkRegex, `<style>${asset.source}</style>`);
            delete bundle[fileName];
          }
        }
      }
    },
  };
}

export default defineConfig({
  base,
  plugins: [prerenderAndInlineCss()],
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
