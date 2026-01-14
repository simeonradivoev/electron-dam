# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.0.6](https://github.com/simeonradivoev/electron-dam/compare/v1.0.5...v1.0.6) (2026-01-14)


### Bug Fixes

* fixed npx step with npm ([2dc3ca8](https://github.com/simeonradivoev/electron-dam/commit/2dc3ca88cafb433593b522e2d902f7cd12d99479))

### [1.0.5](https://github.com/simeonradivoev/electron-dam/compare/v1.0.4...v1.0.5) (2026-01-14)


### Bug Fixes

* moved build action to shell ([65f31c7](https://github.com/simeonradivoev/electron-dam/commit/65f31c7a77dc109675448a2dcef1c7dba940e956))

### [1.0.4](https://github.com/simeonradivoev/electron-dam/compare/v1.0.3...v1.0.4) (2026-01-14)


### Bug Fixes

* Fixed the build action yet again ([da1f047](https://github.com/simeonradivoev/electron-dam/commit/da1f047d5afc56b3209b261464d09b4ace7f2764))

### [1.0.3](https://github.com/simeonradivoev/electron-dam/compare/v1.0.1...v1.0.3) (2026-01-14)


### Bug Fixes

* fixed build step brackets ([de64313](https://github.com/simeonradivoev/electron-dam/commit/de64313d1c843f6b0d96f9a5acb16017924341ce))
* Made sure auto update works and added changelog generation to Github actions ([c8ba2be](https://github.com/simeonradivoev/electron-dam/commit/c8ba2be1b6d8efaf23f6d758a93c3b02dfa92dea))

### [1.0.2](https://github.com/simeonradivoev/electron-dam/compare/v1.0.1...v1.0.2) (2026-01-13)


### Bug Fixes

* Made sure auto update works and added changelog generation to Github actions ([c8ba2be](https://github.com/simeonradivoev/electron-dam/commit/c8ba2be1b6d8efaf23f6d758a93c3b02dfa92dea))

### [1.0.1](https://github.com/simeonradivoev/electron-dam/compare/v1.0.0...v1.0.1) (2026-01-13)


### Bug Fixes

* made github actions build trigger only on tags ([94a93b0](https://github.com/simeonradivoev/electron-dam/commit/94a93b0c863657a71ae1b4464556e8ae770de9e0))

## 1.0.0 (2026-01-13)


### ⚠ BREAKING CHANGES

* **bundles:** convertBundleToLocal now throws errors instead of returning false

### Features

* added more automation ([393c479](https://github.com/simeonradivoev/electron-dam/commit/393c479229b79157714fedb2cc757c5c2bcb28c3))
* added search index caching ([1d0e9f3](https://github.com/simeonradivoev/electron-dam/commit/1d0e9f3121de35565cf54f86863553201cd07c53))
* **bundles:** add drag-and-drop move with toaster notifications ([e05c4fb](https://github.com/simeonradivoev/electron-dam/commit/e05c4fb4c8f7af409169bf4fe47c384aa79a32d1))
* First steps of a massive overhaul ([1b7d614](https://github.com/simeonradivoev/electron-dam/commit/1b7d614e97599790cb0a087d5fc105e5cf5a769f))
* Implement task management system with UI integration ([927ac75](https://github.com/simeonradivoev/electron-dam/commit/927ac75d090a533edb59c4ea59a04375d4e4de4e))
* Implemented general settings ([5c03717](https://github.com/simeonradivoev/electron-dam/commit/5c0371752f71a6c7721a89eacaadcec39c7e1b8a))
* Implemented migrations and fixed some metadata generation ([1465d7a](https://github.com/simeonradivoev/electron-dam/commit/1465d7af8b9a236e8f4143f392e5c953db0c220f))
* Updated dependencies ([8e3b7f5](https://github.com/simeonradivoev/electron-dam/commit/8e3b7f5957c8758eca36ca676a0bfb418fdfec2e))


### Bug Fixes

* declared assimpjs as module ([c49dc84](https://github.com/simeonradivoev/electron-dam/commit/c49dc8400fa27ec3f700eeaa4f25b99c1f44ea0e))
* Encoding URL to handle spaces correctly ([effd4d9](https://github.com/simeonradivoev/electron-dam/commit/effd4d95a12ba94f92dd454b086b65769a125661))
* Fixed a bunch of lint issues and moved audio-decode package to app package config ([94583ce](https://github.com/simeonradivoev/electron-dam/commit/94583ce97dc5d9054be65aa61547967497c8df06))
* fixed dark theme inconsistencies and made search use navigation ([be3e890](https://github.com/simeonradivoev/electron-dam/commit/be3e890652b88719bcbb277a2a4411dcc2c9cb28))
* Fixed model importing ([2721e7f](https://github.com/simeonradivoev/electron-dam/commit/2721e7f2a446058f263817f08a37b9c4dafdb1c1))
* fixed navigation events ([5b984c3](https://github.com/simeonradivoev/electron-dam/commit/5b984c3e8ba4825026aeb379a4ac846863039f1b))
* Fixed problem with asset loader ([f7eb311](https://github.com/simeonradivoev/electron-dam/commit/f7eb311193693460a0abe2c139d26f1f9a5271df))
* fixed some dark mode issues ([e6692bf](https://github.com/simeonradivoev/electron-dam/commit/e6692bfae9eeee0c73ce3d2747333bc2b67ae9cf))
* Fixed some type issues and added LFS to actions ([4ccca8d](https://github.com/simeonradivoev/electron-dam/commit/4ccca8d8d7e5c48d228e72fcfafd3129e3f81ae2))

## [1.0.0-alpha]

### Added

- **Headless Tree**: Implemented headless tree for better performance of large libraries
- **Virtualized Lists**: Made most grids and lists virtualized to improve performance by a large margin
- **Orama**: Implemented dedicated asset searching with semantic support
- **Semantic Generation**: Added ollama support as well as transformers.js for AI generating semantic descriptions and tags.
- **More Feedback** Added more feedback on tasks and errors
- **Move to... Context Menu**: Added context menu option to move bundles to a selected directory
- **Background Task Manager**: Implemented a system to manage and track long-running background tasks
- **Tasks Tab**: Added a new sidebar tab to view and manage active background tasks
- **Compressed Support**: Added initial support for zip files and importing their contents
- **Improved Thumbnail Caching**: Added caching support for thumbnails
- **Improved UI**: Improved some aspects of the UI
- **Semantic Import**: Added support for AI extraction of details from webpage description that is missing open metadata
- **State Saving**: Added lots of users state saving, so they get back right to what they were doing before

### Changed

- **New Metadata**: Moved to file based metadata for more reliable storage and migration support.

## [0.1.0] - 2025-03-07

### Added

- Audio player has more functionality and polish
- Double clicking an audio file should auto play it
- Folders now show grid preview of their contents
- Scrolling to selected files should work better
- Bundle preview should now remember its scroll position
- Added a basic home screen

### Changed

- Virtual bundles now have a rounded thumbnail


### Fixed

- Changing the project directory should not crash the app
- Breadcrumb navigation should now select and navigate to folders


## [0.0.1] - 2023-10-25

### Added

- Initial Release
