import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root, configFile: false,
  // Override branding only; the report, memo, styles and calculations are real.
  plugins: [{
    name: 'print-fixture-settings', enforce: 'pre',
    resolveId(id) { if (id.endsWith('/hooks/useSettings')) return '\0print-fixture-settings'; },
    load(id) {
      if (id === '\0print-fixture-settings') return 'export const useSettings = () => ({ branding: { company_name: "شركة تجريبية", company_logo_url: null } });';
    },
  }, react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('print-fixture-only'),
  },
  optimizeDeps: { entries: ['tests/browser/fixtures/closing.html', 'tests/browser/fixtures/daily-reports.html'] },
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
    headless: true,
  });
  for (const width of [390, 1440]) {
    for (const dark of [false, true]) {
      const label = `${width}px ${dark ? 'dark' : 'light'}`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await page.goto(`${origin}/tests/browser/fixtures/closing.html${dark ? '?dark' : ''}`);
      await page.locator('.print-report').waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState === 'finished'));
      assert.equal(await page.locator('.print-report').isVisible(), false, `${label}: print-only report must remain hidden on screen`);
      // No wait after the media switch: the first print frame must already be visible.
      await page.emulateMedia({ media: 'print' });
      const ancestors = await page.locator('.print-report').evaluate(report => {
        const result = [];
        for (let element = report; element; element = element.parentElement) {
          const style = getComputedStyle(element);
          result.push({ tag: element.tagName, display: style.display, opacity: style.opacity, animation: style.animationName, transform: style.transform });
        }
        return result;
      });
      for (const ancestor of ancestors) {
        assert.notEqual(ancestor.display, 'none', `${label}: hidden report ancestor`);
        assert.equal(ancestor.opacity, '1', `${label}: transparent ${ancestor.tag}`);
        assert.equal(ancestor.animation, 'none', `${label}: animation restarted in print`);
        assert.equal(ancestor.transform, 'none', `${label}: transformed print container`);
      }
      assert.equal(await page.locator('header').isVisible(), false, `${label}: app header must not print`);
      assert.equal(await page.locator('.pr-memo-page').count(), 1, `${label}: eligible recommendation memo missing`);
      const buffer = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
      const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
      try {
        assert.equal(pdf.numPages, 5, `${label}: expected summary, two detail pages, formation and memo`);
        for (let number = 1; number <= pdf.numPages; number++) {
          const content = await (await pdf.getPage(number)).getTextContent();
          const text = content.items.map(item => item.str ?? '').join('');
          assert.ok(text.trim().length > 80, `${label}: blank or incomplete PDF page ${number}`);
        }
      } finally { await pdf.destroy(); }
      await page.emulateMedia({ media: 'screen' });
      assert.equal(await page.locator('.print-report').isVisible(), false, `${label}: print-only content leaked after printing`);
      assert.equal(await page.locator('header').isVisible(), true, `${label}: screen header did not return`);
      assert.deepEqual(errors, [], `${label}: browser errors`);
      console.log(`PASS print regression: ${label}, 5 populated PDF pages`);
      await page.close();
    }
  }
  for (const width of [390, 1440]) {
    for (const dark of [false, true]) {
      const label = `daily ${width}px ${dark ? 'dark' : 'light'}`;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      await page.goto(`${origin}/tests/browser/fixtures/daily-reports.html${dark ? '?dark' : ''}`);
      await page.locator('.print-report').waitFor({ state: 'attached' });
      await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState === 'finished'));
      assert.equal(await page.locator('.print-report').isVisible(), false, `${label}: print report leaked on screen`);
      await page.emulateMedia({ media: 'print' });
      const buffer = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
      const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
      try {
        assert.equal(pdf.numPages, 1, `${label}: short daily report must not append an empty page`);
        const content = await (await pdf.getPage(1)).getTextContent();
        const text = content.items.map(item => item.str ?? '').join('').replace(/[\s,]/g, '');
        assert.ok(text.length > 80, `${label}: blank daily report`);
        for (const number of ['1537', '1000', '500', '37']) assert.ok(text.includes(number), `${label}: missing total or agent value ${number}`);
      } finally { await pdf.destroy(); }
      await page.emulateMedia({ media: 'screen' });
      assert.equal(await page.locator('.print-report').isVisible(), false, `${label}: report leaked after print`);
      assert.equal(await page.locator('header').isVisible(), true, `${label}: screen header did not return`);
      assert.deepEqual(errors, [], `${label}: browser errors`);
      console.log(`PASS print regression: ${label}, 1 populated PDF page with complete totals`);
      await page.close();
    }
  }

} finally {
  await browser?.close();
  await server.close();
}
