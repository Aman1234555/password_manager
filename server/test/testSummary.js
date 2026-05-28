const results = [];

function normalizeState(state) {
  if (state === 'passed') return 'PASS';
  if (state === 'failed') return 'FAIL';
  return state || 'PENDING';
}

export function trackTestResult(test, category) {
  results.push({
    test: test.title,
    category,
    status: normalizeState(test.state),
    duration: typeof test.duration === 'number' ? `${test.duration}ms` : '',
    fullTitle: test.fullTitle()
  });
}

function printFinalSummary() {
  if (results.length === 0) {
    return;
  }

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const pending = results.filter((r) => r.status === 'PENDING').length;

  console.log('\n==============================');
  console.log('OVERALL TEST SUMMARY');
  console.log('==============================');
  console.table(
    results.map((r) => ({
      Test: r.test,
      Category: r.category,
      Status: r.status,
      Duration: r.duration
    }))
  );
  console.log('Summary:', { total, passed, failed, pending });
  console.log('==============================\n');
}

if (!global.__testSummaryRegistered) {
  global.__testSummaryRegistered = true;
  process.on('exit', printFinalSummary);
}
