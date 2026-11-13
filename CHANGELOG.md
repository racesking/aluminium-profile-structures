# Changelog

All notable user-facing changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). The version shown in
Settings matches these entries.

## [Unreleased]

### Added
- Anonymous crash reports (no personal or project data) help us fix errors faster.

### Fixed
- Express dimension fields and toolbar menus now have proper names for screen readers.

### Internal
- Automated end-to-end tests check the cut list, drawing and project files before every deploy.

## [0.9.0] - 2026-11-13

First versioned release. It covers everything built so far.

### Added
- Express builder: parametric templates (box frame, table, shelving and more) with live 3D, cut optimization and BOM.
- Advanced builder: a free 3D node/edge editor with real profile cross-sections (square tube, round pipe, L, T, Bosch T-slot), realistic joints (blind, angle bracket, mitre, butt), constraints, part locking, a Fusion-style marking menu and flick gestures.
- Multi-profile cutting-stock optimizer with buy and inventory stock modes and kerf.
- Live, joint-compensated cut plan in Advanced, with to-scale bar diagrams and part IDs (A1, A2, …) shared by the panel, 3D labels and drawing.
- Exports: CSV BOM and an in-app technical drawing with a parts list, printable or saved as PDF.
- Autosave, version history and recent projects (local, in the browser); save and open projects as `.json` files.
- Settings: display units (mm/cm/m/in), default kerf, bar length and section.
- Accessibility: keyboard access to dialogs, lists and the quick-action ring; labelled fields; focus rings; an 11px minimum text size.
- The app version is shown in Settings.

[Unreleased]: https://github.com/racesking/aluminium-profile-structures/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/racesking/aluminium-profile-structures/releases/tag/v0.9.0
