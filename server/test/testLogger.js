function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const keys = [
    'content-type',
    'x-frame-options',
    'x-content-type-options',
    'x-dns-prefetch-control',
    'access-control-allow-origin',
    'access-control-allow-methods',
    'set-cookie'
  ];

  return keys.reduce((result, key) => {
    if (headers[key] !== undefined) {
      result[key] = headers[key];
    }
    return result;
  }, {});
}

function pretty(value) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function printTestCaseHeader(title) {
  console.log(`\n===== TEST CASE: ${title} =====`);
}

export function printTestStep(step, details) {
  if (details === undefined) {
    console.log(`\n--- ${step}`);
    return;
  }

  const formatted = typeof details === 'string' ? details : pretty(details);
  console.log(`\n--- ${step}\n${formatted}`);
}

export function printResponse(label, res) {
  const payload = {
    label,
    status: res.status,
    body: res.body,
    headers: normalizeHeaders(res.headers)
  };
  console.log(`\n>>> ${label}\n${JSON.stringify(payload, null, 2)}`);
}
