// BiDi probe app — zero dependencies, Node's built-in http only.
// Serves a probe page whose every trigger is observable through BiDi
// events or APIs (console log entries, JS exceptions, network events,
// dialogs, cookies, navigation), plus a second page for navigation checks.
//
// Run: node apps/probe/server.mjs [port]   (default port 4333)
// Env:  PROBE_PORT overrides the port.
import { createServer } from 'node:http';

const PORT = Number(process.argv[2] || process.env.PROBE_PORT || 4333);

const PROBE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>BiDi Probe</title></head>
<body>
<h1 id="title">BiDi Probe</h1>
<p>
  <button id="btn-log">Log</button>
  <button id="btn-warn">Warn</button>
  <button id="btn-error">Error</button>
  <button id="btn-throw">Throw</button>
</p>
<p>
  <button id="btn-alert">Alert</button>
  <button id="btn-confirm">Confirm</button>
  <span id="dialog-result">no-dialog-yet</span>
</p>
<p>
  <button id="btn-fetch">Fetch</button>
  <span id="fetch-result">no-fetch-yet</span>
  <button id="btn-xhr">XHR</button>
  <span id="xhr-result">no-xhr-yet</span>
</p>
<p>
  <input id="input-name" placeholder="Name">
  <button id="btn-greet">Greet</button>
  <span id="greet-result">no-greet-yet</span>
</p>
<p>
  <button id="btn-cookie">Set cookie</button>
  <span id="cookie-result">no-cookie-yet</span>
</p>
<p><a id="link-second" href="/second">Second page</a></p>
<script>
document.getElementById('btn-log').onclick = () => console.log('probe-log');
document.getElementById('btn-warn').onclick = () => console.warn('probe-warn');
document.getElementById('btn-error').onclick = () => console.error('probe-error');
document.getElementById('btn-throw').onclick = () => { throw new Error('probe-thrown'); };
document.getElementById('btn-alert').onclick = () => alert('probe-alert');
document.getElementById('btn-confirm').onclick = () => {
  const r = confirm('probe-confirm');
  document.getElementById('dialog-result').textContent = r ? 'confirmed' : 'dismissed';
};
document.getElementById('btn-fetch').onclick = () => {
  fetch('/api/ping').then(r => r.json()).then(j => {
    document.getElementById('fetch-result').textContent = j.msg;
  });
};
document.getElementById('btn-xhr').onclick = () => {
  const x = new XMLHttpRequest();
  x.open('GET', '/api/ping');
  x.onload = () => {
    document.getElementById('xhr-result').textContent = JSON.parse(x.responseText).msg;
  };
  x.send();
};
document.getElementById('btn-greet').onclick = () => {
  const name = document.getElementById('input-name').value;
  document.getElementById('greet-result').textContent = 'Hello, ' + name;
};
document.getElementById('btn-cookie').onclick = () => {
  document.cookie = 'probe=chocochip; path=/';
  document.getElementById('cookie-result').textContent = document.cookie;
};
</script>
</body></html>`;

const SECOND_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>BiDi Probe — Second</title></head>
<body>
<h1 id="second-title">Second page</h1>
<p><a id="link-back" href="/">Back to probe</a></p>
</body></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PROBE_HTML);
  } else if (url.pathname === '/second') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(SECOND_HTML);
  } else if (url.pathname === '/api/ping') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, msg: 'pong' }));
  } else {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`BiDi probe app listening on http://127.0.0.1:${PORT}`);
});
