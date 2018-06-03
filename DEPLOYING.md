# How To Deploy

The deployment process is easy - you have to:

- update version in package.json to `0.4.2` (or different package number)
- update [`CHANGELOG.md`](CHANGELOG.md)
- go to [Releases](https://github.com/Realytics/fork-ts-checker-webpack-plugin/releases) and Draft new release with tag name `v0.4.2` and a description as in the CHANGELOG.md

Travis will detect the new tag name and release a new version to npm.