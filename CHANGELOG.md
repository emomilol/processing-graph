# [2.1.0](https://github.com/emomilol/processing-graph/compare/v2.0.1...v2.1.0) (2025-05-22)


### Features

* The all queries will wait for the database to get available. ([3174ef3](https://github.com/emomilol/processing-graph/commit/3174ef35ea66d13086d18d972127de1e293648ec))

## [2.0.1](https://github.com/emomilol/processing-graph/compare/v2.0.0...v2.0.1) (2025-05-22)


### Bug Fixes

* Setting up of database now happens on the getServers call since it is the first call of every server and agent. ([3369dd6](https://github.com/emomilol/processing-graph/commit/3369dd647b41d70e0408df9058388d56343d1435))

# [2.0.0](https://github.com/emomilol/processing-graph/compare/v1.2.0...v2.0.0) (2025-05-21)


### Features

* Task concurrency is now properly implemented. ([1d0596e](https://github.com/emomilol/processing-graph/commit/1d0596e1b1edc3e31cd0b6385d16a01fbef7ff66))


### BREAKING CHANGES

* Unique tasks will now receive an object with the field "joinedContexts" which contains a list of contexts.

feat: The server will assign its own address.

fix: Fixed issue when deputy task timed out.

# [1.2.0](https://github.com/emomilol/processing-graph/compare/v1.1.2...v1.2.0) (2025-05-17)


### Features

* Now services are regularly pinged to see if they respond else they are set to inactive on the database and won't be used as candidates for delegation. ([501e7ff](https://github.com/emomilol/processing-graph/commit/501e7fff05d8fc7ad8d5c9cb97974f87060cdbbe))

## [1.1.2](https://github.com/emomilol/processing-graph/compare/v1.1.1...v1.1.2) (2025-05-05)


### Bug Fixes

* Fixed cases where tasks returns strings. It will now be added as a 'message' property in the context. ([4ca6ca7](https://github.com/emomilol/processing-graph/commit/4ca6ca7d57bde97af2487d73539f747bc28b9186))

## [1.1.1](https://github.com/emomilol/processing-graph/compare/v1.1.0...v1.1.1) (2025-05-05)


### Bug Fixes

* Fix for DatabaseClient.ts where schema wasn't available. ([9b62ca4](https://github.com/emomilol/processing-graph/commit/9b62ca4a4d78c544dfe22727bda33edfe1cd25fa))

# [1.1.0](https://github.com/emomilol/processing-graph/compare/v1.0.1...v1.1.0) (2025-05-05)


### Features

* Add support for fetch when not using socket. ([2ed7894](https://github.com/emomilol/processing-graph/commit/2ed789450227856b6aa7ace1ea8263795ed8b712))

## [1.0.1](https://github.com/emomilol/processing-graph/compare/v1.0.0...v1.0.1) (2025-05-04)


### Bug Fixes

* Fixed package.json mismatch ([3ab21af](https://github.com/emomilol/processing-graph/commit/3ab21af5ffea80e2e85b20508d60aa18789e6472))

# 1.0.0 (2025-05-04)


### Bug Fixes

* added debugging to semantic release ([893c8e1](https://github.com/emomilol/processing-graph/commit/893c8e1af1d5c3c35ac687713c03d5ea0e2ace89))
* added debugging to semantic release ([7f7f68e](https://github.com/emomilol/processing-graph/commit/7f7f68e7e163bcd61558a7710c0eed9dad0ff5b4))
* added debugging to semantic release ([2f1cc93](https://github.com/emomilol/processing-graph/commit/2f1cc93dbdab3df2026cd25d5bd118ecfaaeb4bb))
* added debugging to semantic release and a .npmrc file ([f85b9a6](https://github.com/emomilol/processing-graph/commit/f85b9a6597de405b977fe4fbc6a6f4f182d75c75))
* release script had wrong node version ([b1d77a0](https://github.com/emomilol/processing-graph/commit/b1d77a0df5629320ed8edba220ebe52ef171a423))
* trying to fix npm token validation ([184ab99](https://github.com/emomilol/processing-graph/commit/184ab995711f6daba2e5dcd899f6f844d2cab02d))
* type error ([a0284d2](https://github.com/emomilol/processing-graph/commit/a0284d20e5500006d451f2ecb499aa7afacf36cc))
