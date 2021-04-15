# Contributing to fork-ts-checker-webpack-plugin

✨ Thanks for contributing to **fork-ts-checker-webpack-plugin**! ✨

As a contributor, here are the guidelines we would like you to follow:

- [Code of conduct](#code-of-conduct)
- [How can I contribute?](#how-can-i-contribute)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Coding rules](#coding-rules)
- [Working with the code](#working-with-the-code)
- [Releasing a new version](#releasing-a-new-version)

We also recommend that you read [How to Contribute to Open Source](https://opensource.guide/how-to-contribute).

## Code of conduct

Help us keep **fork-ts-checker-webpack-plugin** open and inclusive. Please read and follow our [Code of conduct](CODE_OF_CONDUCT.md).

## How can I contribute?

### Improve documentation

As a **fork-ts-checker-webpack-plugin** user, you are the perfect candidate to help us improve our documentation: typo corrections, clarifications, more examples, etc. Take a look at the [documentation issues that need help](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/labels/docs).

Please follow the [Documentation guidelines](#documentation).

### Give feedback on issues

Some issues are created without information requested in the [Bug report guideline](#bug-report). Help make them easier to resolve by adding any relevant information.

Issues with the [design label](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/labels/design) are meant to discuss the implementation of new features. Participating in the discussion is a good opportunity to get involved and influence the future direction of **fork-ts-checker-webpack-plugin**.

### Fix bugs and implement features

Confirmed bugs and ready-to-implement features are marked with the [help wanted label](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/labels/bug). Post a comment on an issue to indicate you would like to work on it and to request help from the contributors and the community.

### Bug report

A good bug report shouldn't leave others needing to chase you for more information. Please try to be as detailed as possible in your report and fill the information requested in the bug report template.

### Feature request

Feature requests are welcome, but take a moment to find out whether your idea fits with the scope and aims of the project. It's up to you to make a strong case to convince the project's developers of the merits of this feature. Please provide as much detail and context as possible and fill the information requested in the feature request template

## Submitting a Pull Request

Good pull requests, whether patches, improvements, or new features, are a fantastic help. They should remain focused in scope and avoid containing unrelated commits.

**Please ask first** before embarking on any significant pull requests (e.g. implementing features, refactoring code), otherwise you risk spending a lot of time working on something that the project's developers might not want to merge into the project.

If you have never created a pull request before, welcome 🎉 😄. [Here is a great tutorial](https://opensource.guide/how-to-contribute/#opening-a-pull-request) on how to send one :)

Here is a summary of the steps to follow:

1. [Set up the workspace](#set-up-the-workspace)
2. If you cloned a while ago, get the latest changes from upstream and update dependencies:

```bash
$ git checkout main
$ git pull upstream main
$ yarn install
```

3. Create a new topic branch (off the main project development branch) to contain your feature, change, or fix:

```bash
$ git checkout -b <topic-branch-name>
```

4. Make your code changes, following the [Coding rules](#coding-rules)
5. Push your topic branch up to your fork:

```bash
$ git push origin <topic-branch-name>
```

6. [Open a Pull Request](https://help.github.com/articles/creating-a-pull-request/#creating-the-pull-request) to the `main` branch with a clear title and description.

**Tips**:

- For ambitious tasks, open a Pull Request as soon as possible with the `[WIP]` prefix in the title, in order to get feedback and help from the community.
- [Allow maintainers to make changes to your Pull Request branch](https://help.github.com/articles/allowing-changes-to-a-pull-request-branch-created-from-a-fork). This way, we can rebase it and make some minor changes if necessary.
  All changes we make will be done in new commit and we'll ask for your approval before merging them.

## Coding rules

### Source code

To ensure consistency and quality throughout the source code, all code modifications must have:

- No linting errors
- A test for every possible case introduced by your code change
- [Valid commit message(s)](#commit-message-guidelines)
- Documentation for new features
- Updated documentation for modified features

### Documentation

To ensure consistency and quality, all documentation modifications must:

- Refer to brand in [bold](https://help.github.com/articles/basic-writing-and-formatting-syntax/#styling-text) with proper capitalization, i.e. **GitHub**, **fork-ts-checker-webpack-plugin**, **npm**
- Prefer [tables](https://help.github.com/articles/organizing-information-with-tables) over [lists](https://help.github.com/articles/basic-writing-and-formatting-syntax/#lists) when listing key values, i.e. List of options with their description
- Use [links](https://help.github.com/articles/basic-writing-and-formatting-syntax/#links) when you are referring to:
  - a _fork-ts-checker-webpack-plugin_ concept described somewhere else in the documentation, i.e. How to [contribute](CONTRIBUTING.md)
  - a third-party product/brand/service, i.e. Integrate with [GitHub](https://github.com)
  - an external concept or feature, i.e. Create a [GitHub release](https://help.github.com/articles/creating-releases)
  - a package or module, i.e. The [`typescript`](https://github.com/Microsoft/TypeScript) module
- Use the the [single backtick `code` quoting](https://help.github.com/articles/basic-writing-and-formatting-syntax/#quoting-code) for:
  - commands inside sentences, i.e. the `tsc` command
  - programming language keywords, i.e. `function`, `async`, `String`
  - packages or modules, i.e. The [`typescript`](https://github.com/Microsoft/TypeScript) module
- Use the the [triple backtick `code` formatting](https://help.github.com/articles/creating-and-highlighting-code-blocks) for:
  - code examples
  - configuration examples
  - sequence of command lines

### Commit message guidelines

#### Atomic commits

If possible, make [atomic commits](https://en.wikipedia.org/wiki/Atomic_commit), which means:

- a commit should contain exactly one self-contained functional change
- a functional change should be contained in exactly one commit
- a commit should not create an inconsistent state (such as test errors, linting errors, partial fix, feature with documentation etc...)

A complex feature can be broken down into multiple commits as long as each one maintains a consistent state and consists of a self-contained change.

#### Commit message format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```commit
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

The **footer** can contain a [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages).

#### Type

The type is forced by the `commitlint` package. To see available types, run `yarn commit` or check [changelog.config.js](changelog.config.js) file

#### Subject

The subject contains succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

#### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with previous behavior.

#### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

#### Examples

```commit
fix(pencil): stop graphite breaking when too much pressure applied
```

```commit
perf(pencil): remove graphiteWidth option`

The default graphite width of 10mm is always used for performance reasons.

BREAKING CHANGE: The graphiteWidth option has been removed.
```

## Working with the code

### Set up the workspace

[Fork](https://guides.github.com/activities/forking/#fork) the project, [clone](https://guides.github.com/activities/forking/#clone) your fork, configure the remotes and install the dependencies:

```bash
# Clone your fork of the repo into the current directory
$ git clone https://github.com/<your-username>/fork-ts-checker-webpack-plugin
# Navigate to the newly cloned directory
$ cd fork-ts-checker-webpack-plugin
# Assign the original repo to a remote called "upstream"
$ git remote add upstream https://github.com/TypeStrong/fork-ts-checker-webpack-plugin
# Install the dependencies
$ yarn install
```

### Commits

Commit message have to follow [conventional-commit](https://www.conventionalcommits.org/en/v1.0.0-beta.4/) standard, for example:

This repository use [Commitizen](https://github.com/commitizen/cz-cli) to help you create [valid commit messages](#commit-message-guidelines).
After staging your changes with `git add`, run `yarn commit` to start the interactive commit message CLI.

## Releasing a new version

This plugin uses [`📦🚀 semantic-release`](https://github.com/semantic-release/semantic-release) to automatically generate new versions and
publish them on the [npm](https://www.npmjs.com/package/fork-ts-checker-webpack-plugin) and [GitHub](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/releases).

### Releasing a beta version

Experimental features and improvements should be merged into the `beta` branch.
If commits are messy, use **squash and merge** and put a [proper commit message](#commit-message-guidelines),
otherwise use **rebase and merge**.

### Releasing a stable version

Fixes and tested features from the `beta` branch can be merged with the `main` branch. Please ensure your branch is
up to date with the `main` and then [open a Pull Request](https://github.com/TypeStrong/fork-ts-checker-webpack-plugin/compare/main...).
