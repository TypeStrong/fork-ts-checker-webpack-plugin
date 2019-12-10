const IssueSeverity = {
  ERROR: 'error',
  WARNING: 'warning'
} as const;
type IssueSeverity = typeof IssueSeverity[keyof typeof IssueSeverity];

function isIssueSeverity(value: unknown): value is IssueSeverity {
  return [IssueSeverity.ERROR, IssueSeverity.WARNING].includes(
    value as IssueSeverity
  );
}

function compareIssueSeverities(
  severityA: IssueSeverity,
  severityB: IssueSeverity
) {
  const [priorityA, priorityB] = [severityA, severityB].map(severity =>
    [IssueSeverity.WARNING /* 0 */, IssueSeverity.ERROR /* 1 */].indexOf(
      severity
    )
  );

  return Math.sign(priorityB - priorityA);
}

export { IssueSeverity, isIssueSeverity, compareIssueSeverities };
