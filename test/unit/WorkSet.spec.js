var WorkSet = require('../../lib/WorkSet').WorkSet;

describe('[UNIT] WorkSet', () => {
  function testForDomainAndDivision(domain, divisions) {
    divisions.forEach(function(division) {
      var toProcess = [];

      for (var i = 0; i < division; ++i) {
        var set = new WorkSet(domain, i, division);
        set.forEach(function(work) {
          toProcess.push(work);
        });
      }

      expect(toProcess).toEqual(domain);
    });
  }

  it('should split work and cover odd work domain', () => {
    var domain = [0, 10, 20, 30, 40, 50, 60, 70, 80];
    var divisions = [1, 2, 3, 4, domain.length, 1000];

    testForDomainAndDivision(domain, divisions);
  });

  it('should split work and cover even work domain', () => {
    var domain = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    var divisions = [1, 2, 3, 4, domain.length, 1000];

    testForDomainAndDivision(domain, divisions);
  });

  it('should split work and cover empty work domain', () => {
    var domain = [];
    var divisions = [1, 2, 3, 4, 1000];

    testForDomainAndDivision(domain, divisions);
  });

  it('should split work and cover single work domain', () => {
    var domain = [5];
    var divisions = [1, 2, 3, 4, 1000];

    testForDomainAndDivision(domain, divisions);
  });
});
