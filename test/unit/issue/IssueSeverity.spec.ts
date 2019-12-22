import {
  IssueSeverity,
  isIssueSeverity,
  compareIssueSeverities
} from '../../../lib/issue';

describe('[UNIT] issue/IssueSeverity', () => {
  it('defines issue severity enum', () => {
    expect(IssueSeverity).toMatchSnapshot();
  });

  it.each([IssueSeverity.ERROR, IssueSeverity.WARNING])(
    "checks if '%p' is a IssueSeverity",
    severity => {
      expect(isIssueSeverity(severity)).toEqual(true);
    }
  );

  it.each([null, undefined, '', 'test', 1, {}, new Date(), true, false])(
    "checks if '%p' isn't a IssueSeverity",
    severity => {
      expect(isIssueSeverity(severity)).toEqual(false);
    }
  );

  it.each([
    // ERROR
    [IssueSeverity.ERROR, IssueSeverity.ERROR, 0],
    [IssueSeverity.ERROR, IssueSeverity.WARNING, -1],

    // WARNING
    [IssueSeverity.WARNING, IssueSeverity.ERROR, 1],
    [IssueSeverity.WARNING, IssueSeverity.WARNING, 0]
  ])("compares issue severity '%p' with '%p' and returns '%p'", (...args) => {
    const [severityA, severityB, result] = args as [
      IssueSeverity,
      IssueSeverity,
      number
    ];
    expect(compareIssueSeverities(severityA, severityB)).toEqual(result);
  });
});
