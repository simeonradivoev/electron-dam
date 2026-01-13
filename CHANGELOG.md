# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
