# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [1.7.0] - 2017-08-17
### Added
- Progress when cutting (percent done)
- Ability to change frame capture image format (JPEG/PNG)

### Changed
- Don't allow cutting without a valid start/end

### Fixed
- Don't try to seek when no duration
- Also capture frame to custom output dir
- Fix running LosslessCut from strange directories

## [1.6.0] - 2017-03-27
### Fixed
- Be a bit smarter about aac/m4a files #28
- Make end time the end of video by default
- Prevent buttons from stealing focus

## [1.5.0] - 2017-02-11
### Fixed
- Add missing win32 metadata
- Fix capture frame output format to intended JPEG

## [1.4.0] - 2017-01-28
### Added
- Show help sheet by pressing H

### Fixed
- Support # in file path
