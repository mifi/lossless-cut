# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [1.11.0] - 2018-05-21

### Added
- Allow pre-formatting or pre-encoding the video for more format support

### Changed
- Implement manual input field for cutting range
- Improve keyboard shortcut triggering
- Rearrange GUI a bit

## [1.10.0] - 2018-02-18

### Added
- Version check

### Changed
- Offset captured photo modified date to respect the frame offset, for better sorting
- Copy subtitles too
- Implement lossless rotation of videos (changing EXIF)
- Don't cut end if endpoint is the end of the video
- Remove extraneous dot in output file extension

## [1.9.0] - 2017-11-21

### Changed
- Change icons a bit
- Don't cut at start if start time is 0 (remove -ss 0)
- Show input dir in out path when file is loaded
- Show file title in window title

## [1.8.0] - 2017-09-14

### Changed
- Preserve input file modification time when cutting/screenshotting
- Make ffmpeg map metadata using `-map_metadata 0`

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
