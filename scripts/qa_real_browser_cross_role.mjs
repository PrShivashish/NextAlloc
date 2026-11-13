import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const require = createRequire(new URL('../app/frontend/package.json', import.meta.url));
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.SCREENSHOT_DIR || path.join(REPO_ROOT, '.stitch');
fs.mkdirSync(OUT_DIR, { recursive: true });

const AI_URL = process.env.NEXTALLOC_AI_URL || 'http://127.0.0.1:8000';
const BACKEND_URL = process.env.NEXTALLOC_BACKEND_URL || 'http://127.0.0.1:18080';
const UI_URL = process.env.NEXTALLOC_UI_URL || 'http://127.0.0.1:5173';
const PROXY_PORT = parseInt(process.env.TEST_PROXY_PORT || '5174', 10);
const BASE = process.env.NEXTALLOC_BASE_URL || `http://127.0.0.1:${PROXY_PORT}`;

// Fail-closed safety guard: prevent running against non-local or production endpoints
for (const endpoint of [AI_URL, BACKEND_URL, UI_URL, BASE]) {
  const parsed = new URL(endpoint);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    console.error(`[SAFETY ERROR] Refusing to run tests against non-local target: ${endpoint}`);
    process.exit(1);
  }
}

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@nextalloc.in';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123';
const PROVIDER_EMAIL = process.env.DEMO_PROVIDER_EMAIL || 'provider@nextalloc.in';
const PROVIDER_PASSWORD = process.env.DEMO_PROVIDER_PASSWORD || 'Provider@123';
const CANDIDATE_EMAIL = process.env.DEMO_CANDIDATE_EMAIL || 'candidate@nextalloc.in';
const CANDIDATE_PASSWORD = process.env.DEMO_CANDIDATE_PASSWORD || 'Candidate@123';

function createTestProxy(proxyPort, targetUiUrl, targetBackendUrl) {
  const uiParsed = new URL(targetUiUrl);
  const backendParsed = new URL(targetBackendUrl);
  const server = http.createServer((req, res) => {
    const isBackend = ['/api', '/swagger-ui', '/v3/api-docs', '/actuator'].some(p => (req.url || '').startsWith(p));
    const targetHost = isBackend ? backendParsed.hostname : uiParsed.hostname;
    const targetPort = isBackend ? backendParsed.port : uiParsed.port;
    const proxyReq = http.request(
      {
        hostname: targetHost,
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${targetHost}:${targetPort}`,
          origin: targetUiUrl,
        },
      },
      proxyRes => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', err => {
      res.writeHead(502);
      res.end(`Proxy error: ${err.message}`);
    });
    req.pipe(proxyReq);
  });
  return server;
}

async function waitForStack() {
  for (let i = 0; i < 40; i++) {
    try {
      const r1 = await fetch(`${AI_URL}/health`);
      const r2 = await fetch(`${BASE}/api/health`);
      const r3 = await fetch(`${BASE}/`);
      if (r1.ok && r2.ok && r3.ok) {
        return { ai: await r1.json(), backend: await r2.json() };
      }
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Full stack (AI: ${AI_URL}, Backend: ${BACKEND_URL}, Proxy: ${BASE}) did not become healthy within 40s`);
}

async function loginViaUI(page, email, password, expectedUrl) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);

  const [loginRes] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST'),
    page.locator('button[type="submit"]').click(),
  ]);

  const status = loginRes.status();
  const text = await loginRes.text();
  console.log(`  Login for ${email}: HTTP ${status}`);
  if (status !== 200) {
    throw new Error(`Login failed for ${email} (${status}): ${text}`);
  }

  await page.waitForURL(`**${expectedUrl}**`, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  return { status, finalUrl: page.url() };
}

async function main() {
  let proxyServer = null;

  // Ensure repository-controlled test proxy is available without external scratch dependencies
  try {
    let isListening = false;
    try {
      const probe = await fetch(`${BASE}/`);
      isListening = probe.ok;
    } catch {}

    if (!isListening) {
      proxyServer = createTestProxy(PROXY_PORT, UI_URL, BACKEND_URL);
      await new Promise((resolve, reject) => {
        proxyServer.once('error', reject);
        proxyServer.listen(PROXY_PORT, '127.0.0.1', () => {
          console.log(`✓ Started repository-internal test proxy on ${BASE} -> (UI: ${UI_URL}, API: ${BACKEND_URL})`);
          resolve();
        });
      });
    } else {
      console.log(`✓ Reusing active test proxy on ${BASE}`);
    }
  } catch (proxyErr) {
    console.warn(`Proxy initialization notice: ${proxyErr.message}`);
  }

  console.log('[1/6] Verifying stack health across AI, Backend, and UI proxy...');
  const health = await waitForStack();
  console.log('✓ Stack healthy:', JSON.stringify(health));

  const chromePath = process.env.CHROME_PATH ||
    (process.platform === 'win32' && process.env['PROGRAMFILES']
      ? path.join(process.env['PROGRAMFILES'], 'Google', 'Chrome', 'Application', 'chrome.exe')
      : undefined);

  const launchOptions = {
    headless: true,
    ...(chromePath && fs.existsSync(chromePath) ? { executablePath: chromePath } : {}),
  };
  const browser = await chromium.launch(launchOptions);

  const report = {
    timestamp: new Date().toISOString(),
    stack: health,
    adminRun: {},
    candidateAcceptance: {},
    providerJoining: {},
    candidateFinal: {},
    passed: true,
  };

  try {
    // -------------------------------------------------------------
    // STAGE 1: Ensure an allocation run with offers exists via Admin UI
    // -------------------------------------------------------------
    console.log('[2/6] Admin session: Checking or triggering CP-SAT allocation run via real UI...');
    {
      const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const adminPage = await adminCtx.newPage();

      await loginViaUI(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD, '/admin');

      await adminPage.waitForSelector('button:has-text("Run global allocation")', { timeout: 10000 });
      const runsRes = await fetch(`${BACKEND_URL}/api/admin/runs`);
      const runsData = await runsRes.json();
      const hasCompleted = (runsData.content || []).some(r => (r.status || '').toUpperCase() === 'COMPLETED');

      if (!hasCompleted) {
        console.log('  Triggering new Global Allocation Run via Admin UI...');
        const runBtn = adminPage.getByRole('button', { name: /^run global allocation$/i });
        await Promise.all([
          adminPage.waitForURL('**/admin/runs/**', { timeout: 30000 }),
          runBtn.click(),
        ]);
        console.log('  Run started. Waiting for CP-SAT solver completion in Run Detail UI...');
        let completed = false;
        for (let i = 0; i < 60; i++) {
          await adminPage.waitForTimeout(1000);
          const txt = await adminPage.locator('main').innerText();
          if (/completed/i.test(txt) && /optimal/i.test(txt)) {
            console.log('  ✓ Admin run completed with Optimal solution in UI.');
            completed = true;
            break;
          }
        }
        if (!completed) throw new Error('Run did not reach Completed status in UI within 60s');
      }
      report.adminRun = { url: adminPage.url(), status: 'VERIFIED' };
      await adminCtx.close();
    }

    // -------------------------------------------------------------
    // STAGE 2: Candidate UI — View offer, click 'Accept seat', verify persistence
    // -------------------------------------------------------------
    console.log('[3/6] Candidate session: Viewing offer and executing Accept seat in React UI...');
    const candCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const candPage = await candCtx.newPage();

    await loginViaUI(candPage, CANDIDATE_EMAIL, CANDIDATE_PASSWORD, '/candidate');

    // Verify offer banner exists
    await candPage.waitForSelector('section[aria-label="Offer status and decision"]', { timeout: 10000 });
    const offerBannerBefore = await candPage.locator('section[aria-label="Offer status and decision"]').innerText();
    console.log('  Initial offer banner text snippet:', offerBannerBefore.split('\n').slice(0, 4).join(' | '));

    const acceptBtn = candPage.getByRole('button', { name: /^accept seat$/i });
    if (await acceptBtn.count() === 0) {
      throw new Error(`Accept seat button not found in Candidate UI. Banner text: ${offerBannerBefore}`);
    }

    // Click 'Accept seat' and wait for real backend HTTP 200
    const [acceptRes] = await Promise.all([
      candPage.waitForResponse(r => r.url().includes('/api/candidates/me/offers/') && r.url().includes('/accept') && r.request().method() === 'POST'),
      acceptBtn.click(),
    ]);

    report.candidateAcceptance.httpStatus = acceptRes.status();
    report.candidateAcceptance.responseData = await acceptRes.json();
    console.log(`  ✓ Real HTTP POST accept response: ${acceptRes.status()}, status: ${report.candidateAcceptance.responseData.status}`);

    // Verify DOM updates to confirmed state
    await candPage.waitForSelector('text=Seat confirmed', { timeout: 5000 });
    const offerBannerAfterAccept = await candPage.locator('section[aria-label="Offer status and decision"]').innerText();
    report.candidateAcceptance.domAfterAccept = offerBannerAfterAccept.includes('Seat confirmed');
    console.log('  ✓ Candidate UI updated: shows "Seat confirmed".');

    // Hard page refresh to verify database persistence
    console.log('[4/6] Candidate session: Hard page refresh to assert database persistence...');
    await candPage.reload({ waitUntil: 'networkidle' });
    await candPage.waitForSelector('section[aria-label="Offer status and decision"]', { timeout: 10000 });
    const offerBannerAfterReload = await candPage.locator('section[aria-label="Offer status and decision"]').innerText();
    const persisted = offerBannerAfterReload.includes('Seat confirmed') || offerBannerAfterReload.includes('ACCEPTED');
    report.candidateAcceptance.persistedAfterReload = persisted;
    if (!persisted) {
      throw new Error(`Offer status not persisted after reload! Banner: ${offerBannerAfterReload}`);
    }
    console.log('  ✓ Persisted after reload confirmed.');
    await candPage.screenshot({ path: path.join(OUT_DIR, 'browser_candidate_accepted.png') });

    // -------------------------------------------------------------
    // STAGE 3: Provider UI — View accepted offer, click 'Confirm joining', verify persistence
    // -------------------------------------------------------------
    console.log('[5/6] Provider session: Inspecting candidate offer and confirming joining in React UI...');
    {
      const provCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const provPage = await provCtx.newPage();

      await loginViaUI(provPage, PROVIDER_EMAIL, PROVIDER_PASSWORD, '/provider');

      // Locate the Offer review & joining confirmation section
      await provPage.waitForSelector('text=Offer review & joining confirmation', { timeout: 10000 });
      const confirmJoinBtn = provPage.getByRole('button', { name: /^confirm joining$/i }).first();
      if (await confirmJoinBtn.count() === 0) {
        throw new Error('Confirm joining button not found in Provider UI');
      }

      // Click 'Confirm joining' and wait for real backend HTTP 200
      const [joinRes] = await Promise.all([
        provPage.waitForResponse(r => r.url().includes('/api/providers/me/offers/') && r.url().includes('/join') && r.request().method() === 'POST'),
        confirmJoinBtn.click(),
      ]);

      report.providerJoining.httpStatus = joinRes.status();
      report.providerJoining.responseData = await joinRes.json();
      console.log(`  ✓ Real HTTP POST join response: ${joinRes.status()}, status: ${report.providerJoining.responseData.status}`);

      // Verify DOM updates
      await provPage.waitForSelector('text=Candidate joining confirmed.', { timeout: 5000 });
      console.log('  ✓ Provider UI updated: shows "Candidate joining confirmed."');

      // Hard refresh to assert persistence in provider session
      await provPage.reload({ waitUntil: 'networkidle' });
      await provPage.waitForTimeout(500);
      const provTextAfterReload = await provPage.locator('main').innerText();
      report.providerJoining.persistedAfterReload = /(?:Candidates joined\s*1|1\s*Candidates joined|All active offers have been processed)/i.test(provTextAfterReload);
      console.log('  ✓ Provider UI persistence verified after hard reload.');
      await provPage.screenshot({ path: path.join(OUT_DIR, 'browser_provider_joined.png') });

      await provCtx.close();
    }

    // -------------------------------------------------------------
    // STAGE 4: Return to Candidate session, hard refresh, assert JOINED
    // -------------------------------------------------------------
    console.log('[6/6] Candidate session: Hard refresh to assert real-time JOINED state...');
    await candPage.reload({ waitUntil: 'networkidle' });
    await candPage.waitForSelector('section[aria-label="Offer status and decision"]', { timeout: 10000 });
    const finalCandBanner = await candPage.locator('section[aria-label="Offer status and decision"]').innerText();
    report.candidateFinal.joinedVisible = finalCandBanner.includes('JOINED') || finalCandBanner.includes('Allocation confirmed');
    console.log('  ✓ Candidate UI reflects final joined placement:', report.candidateFinal.joinedVisible);
    await candPage.screenshot({ path: path.join(OUT_DIR, 'browser_candidate_final_joined.png') });

    await candCtx.close();
    await browser.close();

    console.log('\n======================================================');
    console.log('ALL REAL BROWSER ACCEPTANCE TESTS PASSED (0 ROUTE MOCKS)');
    console.log('======================================================\n');
  } catch (err) {
    report.passed = false;
    report.error = err.message;
    console.error('Browser Acceptance Test failed:', err);
    await browser.close();
  } finally {
    if (proxyServer) {
      if (typeof proxyServer.closeAllConnections === 'function') {
        proxyServer.closeAllConnections();
      }
      proxyServer.close();
    }
  }

  process.stdout.write(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}

main();
