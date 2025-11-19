# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Drag-and-Drop Bundle Move**: Move bundles by dragging them to different folders in the explorer tree
- **Auto-Scroll on Drag**: Tree view automatically scrolls when dragging near top/bottom edges (50px threshold)
- **Toaster Notifications**: Error notifications for bundle conversion failures using BlueprintJS Toaster
- **Move to... Context Menu**: Added context menu option to move bundles to a selected directory
- **Auto-Focus After Move**: Moved bundles are automatically selected and focused in the explorer
- **Bundle Name Sanitization**: Invalid file system characters are automatically replaced with underscores during bundle conversion

### Changed

- **BREAKING**: `convertBundleToLocal` now throws errors instead of returning false for better error propagation

### Fixed

- Bundle conversion errors now properly displayed to the user via toast notifications
- Bundle paths are correctly updated in the database after moving
- Node matching in drag-and-drop now uses IDs to prevent targeting wrong folders when names are duplicated

## [0.0.1] - 2023-10-25

### Added

- Initial Release

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
