// Cypress (Firefox, BiDi-driven) suite for the capability matrix.
// One `it` per capability. No hard assertions: each test observes page
// state via .then() and records PASS/FAIL/SKIP through the `record` task,
// so a capability failure is a FAIL cell, not an aborted run. (If a
// Cypress command itself errors — e.g. the probe server is down — that
// test records nothing and the wrapper reports NOT-RUN.)
// The config's `record` task stamps each result with the ms since the
// previous record, so the wrapper prints a TIMING line per capability;
// the `meta` task records the Cypress + Firefox versions for the SESSION
// line.
// Transport honesty (see NOTES.md): Cypress drives Firefox over BiDi, but
// spec APIs expose no raw BiDi event subscription. Cells that need event
// observation Cypress cannot provide are SKIP with the reason; cells that
// exercise the capability through Cypress's Firefox automation are PASS.

const BASE = Cypress.config('baseUrl');

describe('bidi capability matrix', () => {
  before(() => {
    cy.task('reset');
    cy.task('meta', { cypress: Cypress.version, browser: Cypress.browser.name + '/' + Cypress.browser.version });
  });

  it('navigation', () => {
    cy.visit('/second');
    cy.url().then(url => {
      cy.task('record', {
        key: 'navigation',
        status: url.endsWith('/second') ? 'PASS' : 'FAIL',
        detail: 'url=' + url,
      });
    });
  });

  it('console-log', () => {
    // SKIP: Cypress specs cannot subscribe to BiDi log events, and console
    // output is not readable from a spec. Nothing to demonstrate from the
    // spec side; the click is still performed to prove the trigger works.
    cy.visit('/');
    cy.get('#btn-log').click();
    cy.task('record', {
      key: 'console-log',
      status: 'SKIP',
      detail: 'no spec-level BiDi log-event surface in Cypress; console output only appears in runner logs',
    });
  });

  it('js-error', () => {
    // Observed via Cypress's uncaught:exception handler, which receives the
    // thrown error through the automation session. Returning false keeps
    // the test green (otherwise Cypress fails on uncaught exceptions).
    let captured = null;
    Cypress.on('uncaught:exception', err => {
      captured = err && err.message ? err.message : String(err);
      return false;
    });
    cy.visit('/');
    cy.get('#btn-throw').click();
    cy.wait(500);
    cy.then(() => {
      cy.task('record', {
        key: 'js-error',
        status: captured && captured.includes('probe-thrown') ? 'PASS' : 'FAIL',
        detail: 'captured=' + captured,
      });
    });
  });

  it('network-capture', () => {
    // SKIP: cy.intercept() is Cypress's network proxy, not a BiDi event
    // subscription, and specs have no BiDi network-event surface. The fetch
    // itself is performed and its page outcome asserted as the demo.
    cy.visit('/');
    cy.get('#btn-fetch').click();
    cy.get('#fetch-result').should('have.text', 'pong');
    cy.task('record', {
      key: 'network-capture',
      status: 'SKIP',
      detail: 'fetch works (fetch-result=pong) but cy.intercept is proxy-based, not BiDi; no spec-level BiDi network subscription',
    });
  });

  it('script-eval', () => {
    cy.visit('/');
    cy.window().then(win => {
      const sum = win.eval('1 + 1');
      const title = win.document.title;
      cy.task('record', {
        key: 'script-eval',
        status: sum === 2 && title === 'BiDi Probe' ? 'PASS' : 'FAIL',
        detail: '1+1=' + sum + ' title=' + title,
      });
    });
  });

  it('cookie', () => {
    cy.visit('/');
    cy.setCookie('probe', 'chocochip', { domain: '127.0.0.1', path: '/' });
    cy.getCookie('probe').then(c => {
      cy.task('record', {
        key: 'cookie',
        status: c && c.value === 'chocochip' ? 'PASS' : 'FAIL',
        detail: 'probe=' + (c && c.value),
      });
    });
  });

  it('screenshot', () => {
    cy.visit('/');
    cy.screenshot('bidi-probe', { capture: 'viewport' });
    cy.task('record', {
      key: 'screenshot',
      status: 'PASS',
      detail: 'cy.screenshot viewport capture succeeded',
    });
  });

  it('dialog', () => {
    // Cypress dialog handling: window:alert / window:confirm handlers.
    // The confirm handler's return value decides accept (true) / dismiss
    // (false). ONE confirm handler whose answer is driven by a variable —
    // registering a second handler would leave the outcome ambiguous.
    // All three legs in one test so handlers cannot leak across tests.
    const seen = [];
    let confirmAnswer = true;
    cy.on('window:alert', text => { seen.push('alert:' + text); });
    cy.on('window:confirm', text => { seen.push('confirm:' + text); return confirmAnswer; });
    cy.visit('/');
    cy.get('#btn-alert').click();
    // NOTE: plain assignments here would run at queue time (before any
    // command executes), so both legs would see the last value. .then()
    // runs in queue order, setting the answer at the right moment.
    cy.then(() => { confirmAnswer = false; });
    cy.get('#btn-confirm').click();
    cy.get('#dialog-result').should('have.text', 'dismissed');
    cy.then(() => { confirmAnswer = true; });
    cy.get('#btn-confirm').click();
    cy.get('#dialog-result').should('have.text', 'confirmed');
    cy.then(() => {
      cy.task('record', {
        key: 'dialog',
        status: 'PASS',
        detail: 'alert seen; confirm dismissed then confirmed via one variable-driven window:confirm handler; seen=[' + seen.join(', ') + ']',
      });
    });
  });

  it('input-click', () => {
    cy.visit('/');
    cy.get('#input-name').type('Ada');
    cy.get('#btn-greet').click();
    cy.get('#greet-result').should('have.text', 'Hello, Ada');
    cy.task('record', {
      key: 'input-click',
      status: 'PASS',
      detail: 'typed Ada, clicked greet, Hello, Ada observed',
    });
  });

  it('network-intercept', () => {
    // SKIP: cy.intercept() stubs work, but through Cypress's proxy, not
    // BiDi — so the BiDi interception cell is SKIP. The stub is still
    // demonstrated so the SKIP is about transport, not capability.
    cy.visit('/');
    cy.intercept('GET', '**/api/ping', { statusCode: 200, body: { ok: true, msg: 'intercepted' } }).as('ping');
    cy.get('#btn-fetch').click();
    cy.wait('@ping');
    cy.get('#fetch-result').should('have.text', 'intercepted');
    cy.task('record', {
      key: 'network-intercept',
      status: 'SKIP',
      detail: 'cy.intercept stub works (fetch-result=intercepted) but via Cypress proxy, not BiDi interception',
    });
  });

  it('drag-and-drop', () => {
    // SKIP: Cypress has no native drag API; the trigger sequence below
    // dispatches synthetic DOM events (not BiDi input), so the cell is
    // SKIP by the network-intercept precedent. The drop handler still
    // runs, proving the probe target works.
    cy.visit('/');
    cy.get('#drag-source').trigger('dragstart', { dataTransfer: new DataTransfer() });
    cy.get('#drop-zone').trigger('dragover', { dataTransfer: new DataTransfer() });
    cy.get('#drop-zone').trigger('drop', { dataTransfer: new DataTransfer() });
    cy.get('#drag-result').should('have.text', 'dropped');
    cy.task('record', {
      key: 'drag-and-drop',
      status: 'SKIP',
      detail: 'trigger dragstart/dragover/drop works (drag-result=dropped) but Cypress has no native drag or BiDi input API; synthetic events only',
    });
  });

  it('hover', () => {
    // SKIP: Cypress has no real hover API; trigger('mouseover') is a
    // synthetic event, not BiDi input. Demonstrated, same precedent.
    cy.visit('/');
    cy.get('#hover-target').trigger('mouseover');
    cy.get('#hover-result').should('have.text', 'hovered');
    cy.task('record', {
      key: 'hover',
      status: 'SKIP',
      detail: 'trigger mouseover works (hover-result=hovered) but Cypress has no real hover or BiDi input API; synthetic events only',
    });
  });

  it('keyboard', () => {
    // SKIP: cy.type() only targets inputs, textareas, and
    // contenteditables, so it cannot send ArrowRight to the focusable
    // div; trigger('keydown') is synthetic, not BiDi input. The handler
    // still runs, proving the probe target works.
    cy.visit('/');
    cy.get('#key-target').click();
    cy.get('#key-target').trigger('keydown', { key: 'ArrowRight' });
    cy.get('#key-result').should('have.text', 'arrow-right');
    cy.task('record', {
      key: 'keyboard',
      status: 'SKIP',
      detail: 'trigger keydown works (key-result=arrow-right) but cy.type() cannot target a non-input focusable element and trigger is synthetic, not BiDi input',
    });
  });

  it('multi-tab', () => {
    // SKIP: Cypress runs in a single tab and cannot switch to a new tab
    // (documented architecture limitation). No tabs API exists to
    // demonstrate with, so the SKIP is architectural, not a failed attempt.
    cy.task('record', {
      key: 'multi-tab',
      status: 'SKIP',
      detail: 'Cypress is single-tab by architecture; it cannot open, switch to, or assert a new tab',
    });
  });

  it('iframe', () => {
    // PASS: same-origin iframe content is reachable through Cypress's
    // Firefox automation (contentDocument), the standard Cypress iframe
    // pattern, and the click inside asserts.
    cy.visit('/');
    cy.get('#probe-frame').its('0.contentDocument.body').should('not.be.empty').then(cy.wrap).find('#inner-btn').click();
    cy.get('#probe-frame').its('0.contentDocument.body').then(cy.wrap).find('#inner-result').should('have.text', 'inner-clicked');
    cy.task('record', {
      key: 'iframe',
      status: 'PASS',
      detail: 'inner-clicked via contentDocument iframe access',
    });
  });
});
