module.exports = {
  list: ['feat', 'fix', 'refactor', 'perf', 'test', 'chore', 'docs'],
  maxMessageLength: 64,
  minMessageLength: 3,
  questions: ['type', 'subject', 'body', 'breaking', 'issues'],
  types: {
    feat: {
      description: 'A new feature',
      value: 'feat',
      section: 'Features',
    },
    fix: {
      description: 'A bug fix',
      value: 'fix',
      section: 'Bug Fixes',
    },
    refactor: {
      description: 'A code change that neither adds a feature or fixes a bug',
      value: 'refactor',
      hidden: true,
    },
    perf: {
      description: 'A code change that improves performance',
      value: 'perf',
      hidden: true,
    },
    test: {
      description: 'Adding missing tests',
      value: 'test',
      hidden: true,
    },
    chore: {
      description: 'Build process, CI or auxiliary tool changes',
      value: 'chore',
      hidden: true,
    },
    docs: {
      description: 'Documentation only changes',
      value: 'docs',
      hidden: true,
    },
  },
};
