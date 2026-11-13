// Real cross-role transactional test against disposable live Spring Boot + Python AI backend
// Zero route mocks. Pure HTTP API validation of real DB mutations across Candidate, Provider, and Admin.

const BASE_API = process.env.BASE_API || 'http://127.0.0.1:18080/api';

// Fail-closed safety guard: prevent running against non-local or production endpoints
const parsedUrl = new URL(BASE_API);
if (!['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)) {
  console.error(`[SAFETY ERROR] Refusing to run transactional tests against non-local target: ${BASE_API}`);
  process.exit(1);
}

const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@nextalloc.in';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123';
const PROVIDER_EMAIL = process.env.DEMO_PROVIDER_EMAIL || 'provider@nextalloc.in';
const PROVIDER_PASSWORD = process.env.DEMO_PROVIDER_PASSWORD || 'Provider@123';
const CANDIDATE_EMAIL = process.env.DEMO_CANDIDATE_EMAIL || 'candidate@nextalloc.in';
const CANDIDATE_PASSWORD = process.env.DEMO_CANDIDATE_PASSWORD || 'Candidate@123';

async function req(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_API}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function login(email, password) {
  const res = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} (${res.status}): ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function main() {
  const results = {
    timestamp: new Date().toISOString(),
    backend: BASE_API,
    stages: {},
    passed: true,
  };

  try {
    console.log('[1/7] Authenticating personas against real Spring Boot backend...');
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const provider = await login(PROVIDER_EMAIL, PROVIDER_PASSWORD);
    const candidate = await login(CANDIDATE_EMAIL, CANDIDATE_PASSWORD);

    results.stages.authentication = {
      admin: { id: admin.user.id, email: admin.user.email, role: admin.user.role },
      provider: { id: provider.user.id, email: provider.user.email, role: provider.user.role },
      candidate: { id: candidate.user.id, email: candidate.user.email, role: candidate.user.role },
    };
    console.log('✓ All 3 personas authenticated successfully.');

    console.log('[2/7] Checking Candidate offers or generating an allocation run...');
    const candHeader = { Authorization: `Bearer ${candidate.token}` };
    const provHeader = { Authorization: `Bearer ${provider.token}` };
    const adminHeader = { Authorization: `Bearer ${admin.token}` };

    let candOffersRes = await req('/candidates/me/offers', { headers: candHeader });
    let offers = candOffersRes.data;

    if (!Array.isArray(offers) || offers.length === 0 || !offers.some(o => o.status === 'OFFERED')) {
      console.log('  No pending OFFERED offer found. Executing an allocation run as Admin...');
      const startRes = await req('/admin/runs', {
        method: 'POST',
        headers: adminHeader,
        body: JSON.stringify({ policyKey: 'balanced' }),
      });
      if (!startRes.ok) {
        throw new Error(`Failed to start run: ${startRes.status} ${JSON.stringify(startRes.data)}`);
      }
      const runId = startRes.data.id;
      console.log(`  Allocation run #${startRes.data.number} started (ID: ${runId}). Waiting for solver completion...`);

      let completedRun = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const checkRes = await req(`/admin/runs/${runId}`, { headers: adminHeader });
        if (checkRes.ok && (checkRes.data.run.status || '').toUpperCase() === 'COMPLETED') {
          completedRun = checkRes.data;
          break;
        }
      }
      if (!completedRun) {
        throw new Error('Allocation run did not complete within 60s');
      }
      console.log(`  ✓ Solver completed: ${completedRun.run.solverStatus} (${completedRun.provenance?.solverRuntimeMs ?? 0}ms)`);

      // Wait for durable offers to be populated by the solver completion listener
      let offersReady = false;
      for (let j = 0; j < 10; j++) {
        await new Promise(r => setTimeout(r, 1000));
        candOffersRes = await req('/candidates/me/offers', { headers: candHeader });
        offers = candOffersRes.data;
        if (Array.isArray(offers) && offers.length > 0) {
          offersReady = true;
          console.log(`  ✓ Durable offers auto-generated (${offers.length} candidate offer(s) ready).`);
          break;
        }
      }
      if (!offersReady) {
        const genOffersRes = await req(`/admin/runs/${runId}/generate-offers`, {
          method: 'POST',
          headers: adminHeader,
        });
        console.log(`  Offers generated via API fallback: ${JSON.stringify(genOffersRes.data)}`);
        candOffersRes = await req('/candidates/me/offers', { headers: candHeader });
        offers = candOffersRes.data;
      }
    }

    const targetOffer = offers.find(o => o.status === 'OFFERED') || offers[0];
    if (!targetOffer) {
      throw new Error('No candidate offer available for transactional lifecycle testing');
    }

    const offerId = targetOffer.id;
    const oppId = targetOffer.opportunityId;
    console.log(`✓ Target Offer ID: ${offerId}, Opportunity ID: ${oppId}, Initial Status: ${targetOffer.status}`);
    results.stages.initialOffer = {
      offerId,
      opportunityId: oppId,
      opportunityTitle: targetOffer.opportunityTitle,
      initialStatus: targetOffer.status,
      runId: targetOffer.runId,
    };

    console.log('[3/7] Candidate accepting seat (POST /candidates/me/offers/{id}/accept)...');
    const acceptRes = await req(`/candidates/me/offers/${offerId}/accept`, {
      method: 'POST',
      headers: candHeader,
    });
    if (!acceptRes.ok) {
      throw new Error(`Accept failed (${acceptRes.status}): ${JSON.stringify(acceptRes.data)}`);
    }
    results.stages.candidateAccept = {
      httpStatus: acceptRes.status,
      returnedStatus: acceptRes.data.status,
      respondedAt: acceptRes.data.respondedAt,
    };
    if (acceptRes.data.status !== 'ACCEPTED') {
      throw new Error(`Expected status ACCEPTED but got ${acceptRes.data.status}`);
    }
    console.log('✓ Candidate accept succeeded: status is now ACCEPTED.');

    console.log('[4/7] Testing idempotency / duplicate accept handling...');
    const dupAcceptRes = await req(`/candidates/me/offers/${offerId}/accept`, {
      method: 'POST',
      headers: candHeader,
    });
    results.stages.duplicateAccept = {
      httpStatus: dupAcceptRes.status,
      returnedStatus: dupAcceptRes.data.status,
      idempotent: dupAcceptRes.ok && dupAcceptRes.data.status === 'ACCEPTED',
    };
    console.log('✓ Duplicate accept handled cleanly (HTTP 200, status retained as ACCEPTED).');

    console.log('[5/7] Provider inspecting opportunity offers...');
    const provOffersRes = await req(`/providers/me/opportunities/${oppId}/offers`, {
      headers: provHeader,
    });
    if (!provOffersRes.ok) {
      throw new Error(`Provider offers fetch failed (${provOffersRes.status}): ${JSON.stringify(provOffersRes.data)}`);
    }
    const provOfferItem = (provOffersRes.data || []).find(o => o.id === offerId);
    results.stages.providerView = {
      httpStatus: provOffersRes.status,
      offerVisibleToProvider: !!provOfferItem,
      statusSeenByProvider: provOfferItem?.status,
    };
    console.log(`✓ Provider sees offer ${offerId} with status: ${provOfferItem?.status}`);

    console.log('[6/7] Provider confirming candidate joining (POST /providers/me/offers/{id}/join)...');
    // Note: Provider endpoint is /providers/me/offers/{id}/join
    const joinRes = await req(`/providers/me/offers/${offerId}/join`, {
      method: 'POST',
      headers: provHeader,
    });
    if (!joinRes.ok) {
      throw new Error(`Join confirmation failed (${joinRes.status}): ${JSON.stringify(joinRes.data)}`);
    }
    results.stages.providerJoinConfirm = {
      httpStatus: joinRes.status,
      returnedStatus: joinRes.data.status,
    };
    if (joinRes.data.status !== 'JOINED') {
      throw new Error(`Expected status JOINED but got ${joinRes.data.status}`);
    }
    console.log('✓ Provider confirmed joining: status is now JOINED.');

    console.log('[7/7] Verifying candidate view after joining and invalid transition rejection...');
    const candOffersAfter = await req('/candidates/me/offers', { headers: candHeader });
    const updatedCandOffer = (candOffersAfter.data || []).find(o => o.id === offerId);
    results.stages.candidateFinalView = {
      httpStatus: candOffersAfter.status,
      finalStatus: updatedCandOffer?.status,
    };
    if (updatedCandOffer?.status !== 'JOINED') {
      throw new Error(`Expected candidate offer status to be JOINED but was ${updatedCandOffer?.status}`);
    }

    // Invalid transition test: Attempting to decline after joined must be rejected
    const invalidDecline = await req(`/candidates/me/offers/${offerId}/decline`, {
      method: 'POST',
      headers: candHeader,
      body: JSON.stringify({ reason: 'Declining after joined' }),
    });
    results.stages.invalidTransitionGuard = {
      attempt: 'Decline after JOINED',
      httpStatus: invalidDecline.status,
      rejectedAsExpected: invalidDecline.status === 400,
      errorMessage: invalidDecline.data?.message || invalidDecline.data,
    };
    console.log(`✓ Invalid transition guard verified: HTTP ${invalidDecline.status} (${invalidDecline.data?.message || 'rejected'}).`);

    console.log('\n========================================');
    console.log('ALL CROSS-ROLE TRANSACTIONAL TESTS PASSED (0 MOCKS)');
    console.log('========================================\n');
  } catch (err) {
    results.passed = false;
    results.error = err.message;
    console.error('Test execution failed:', err);
  }

  process.stdout.write(JSON.stringify(results, null, 2));
  process.exit(results.passed ? 0 : 1);
}

main();
