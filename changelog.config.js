module.exports = {
  list: ['feat', 'fix', 'refactor', 'perf', 'test', 'chore', 'docs'],
  maxMessageLength: 64,
  minMessageLength: 3,
  questions: ['type', 'subject', 'body', 'breaking', 'issues'],
  types: {
    feat: {
      description: 'A new feature',
      emoji: '✨ ',
      value: 'feat'
    },
    fix: {
      description: 'A bug fix',
      emoji: '🐛',
      value: 'fix'
    },
    refactor: {
      description: 'A code change that neither adds a feature or fixes a bug',
      emoji: '💡',
      value: 'refactor'
    },
    perf: {
      description: 'A code change that improves performance',
      emoji: '⚡️',
      value: 'perf'
    },
    test: {
      description: 'Adding missing tests',
      emoji: '✅ ',
      value: 'test'
    },
    chore: {
      description: 'Build process, CI or auxiliary tool changes',
      emoji: '🔧',
      value: 'chore'
    },
    docs: {
      description: 'Documentation only changes',
      emoji: '📖',
      value: 'docs'
    }
  }
};
