// Cypress config for the BiDi capability matrix (Firefox-only BiDi entry).
// Cypress drives Firefox over WebDriver BiDi (since Cypress 14.1, Firefox
// 135+). Spec APIs do not expose raw BiDi events — see NOTES.md for what
// each capability cell means here. Results are recorded via the `record`
// task into results.json (each stamped with the ms since the previous
// record); the `meta` task records the Cypress + Firefox versions. The
// wrapper prints the shared RESULT/SUMMARY/TIMING/SESSION contract from
// that file.
const fs = require('node:fs');
const path = require('node:path');

const OUT = process.env.CYPRESS_RESULTS || path.join(__dirname, 'results.json');

module.exports = {
  e2e: {
    baseUrl: process.env.PROBE_URL || 'http://127.0.0.1:4333',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 15000,
    setupNodeEvents(on) {
      // Per-capability timing: the ms since the previous record (or since
      // reset), so each result's ms covers its own test, not spec startup.
      let lastMark = Date.now();
      on('task', {
        reset() {
          lastMark = Date.now();
          fs.writeFileSync(OUT, JSON.stringify({ results: [], meta: {} }, null, 2));
          return null;
        },
        record({ key, status, detail }) {
          let data = { results: [], meta: {} };
          try { data = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* first record */ }
          // Single-line details: the RESULT contract is one line per
          // capability (Cypress wraps app errors multi-line).
          const clean = String(detail || '').replace(/\s*\n\s*/g, ' | ');
          const now = Date.now();
          const ms = now - lastMark;
          lastMark = now;
          data.results.push({ key, status, detail: clean, ms });
          fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
          return null;
        },
        meta(obj) {
          let data = { results: [], meta: {} };
          try { data = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* before reset */ }
          data.meta = { ...(data.meta || {}), ...(obj || {}) };
          fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
          return null;
        },
      });
    },
  },
};
