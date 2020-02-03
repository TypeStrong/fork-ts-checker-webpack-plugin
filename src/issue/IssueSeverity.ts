type IssueSeverity = 'error' | 'warning';

function isIssueSeverity(value: unknown): value is IssueSeverity {
  return ['error', 'warning'].includes(value as IssueSeverity);
}

function compareIssueSeverities(severityA: IssueSeverity, severityB: IssueSeverity) {
  const [priorityA, priorityB] = [severityA, severityB].map((severity) =>
    ['warning' /* 0 */, 'error' /* 1 */].indexOf(severity)
  );

  return Math.sign(priorityB - priorityA);
}

export { IssueSeverity, isIssueSeverity, compareIssueSeverities };
