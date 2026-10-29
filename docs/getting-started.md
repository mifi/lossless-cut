# Getting started

## Download and install

Get LosslessCut from the [Mac App Store, Microsoft Store or Snap Store](https://losslesscut.app/#download), which install and update it automatically, or download it from [GitHub](../README.md#download). The GitHub version has no installer: see [Installation and files](installation.md). It runs on Windows, macOS and Linux, see [Supported OS versions](requirements.md).

## Your first cut

- **Drag and drop** a video file into player or use <kbd>⌘</kbd>/<kbd>CTRL</kbd> + <kbd>O</kbd>.
- <kbd>SPACE</kbd> to play/pause or <kbd>←</kbd> <kbd>→</kbd> <kbd>,</kbd> <kbd>.</kbd> or mouse/trackpad wheel to seek back/forth.
- Set the start/end times of the current segment by first moving the timeline cursor and then pressing <kbd>I</kbd> to set start time and <kbd>O</kbd> to set end time. You can also press hold <kbd>SHIFT</kbd> while dragging a segment with the mouse to move or resize it
- <kbd>+</kbd> to create another marker and repeat the previous step to convert it into a segment.
- <kbd>B</kbd> to split the segment at the timeline cursor.
- <kbd>BACKSPACE</kbd> to remove cutpoint/segment.
- If you create segments without an end time, it is a [marker](index.md#markers) instead of a segment.
  - Note that when exporting, all segments you create will be **preserved** and exported as new files. You can change this behavior with the **Yin Yang** symbol ☯️, in which case the behaviour is inverted and LosslessCut will instead **skip** all selected segments and export the parts **between** segments as files.
  - Also note that start times will not be accurate, see [Export starts a few seconds before my cut point](troubleshooting.md#export-starts-a-few-seconds-before-my-cut-point).
- *(optional)* <kbd>+</kbd> to add another segment at the current cursor time. Then select the segment end time with <kbd>O</kbd>.
- *(optional)* If you want to merge all the selected segments into one file after cutting, change the `Export mode` from `Separate files` to `Merge cuts`.
- *(optional)* If you want to export to a certain output folder, press the `Working dir unset` button (defaults to same folder as source file).
- *(optional)* If you want to change orientation, press the **rotation** button.
- *(optional)* By default, most audio, video and subtitle tracks from the input file will be cut and exported. Press the `Tracks` button to customise and/or add new tracks from other files.
- *(optional)* Select a new output format (remux).
- *(optional)* In the right-hand segments panel, right click a segment for options, or drag-drop to reorder. Segments will appear in this order in the merged output.
- **When done, press the `Export` button (or <kbd>E</kbd>) to show an overview with export options.**
- *(optional)* Adjust any export options.
- *(optional)* Change the [Output file name template](file-name-template.md).
- **Then press `Export` again to confirm the export**
- Press the **Camera** button (or <kbd>C</kbd>) if you want to take a JPEG/PNG snapshot from the current time.
- If you want to move the original file to trash, press the **trash** button.
- For best results you may need to trial and error with another output format (Matroska can hold nearly everything), change keyframe cut mode or disable some tracks (see [known issues](troubleshooting.md)).
- Press <kbd>SHIFT</kbd> + <kbd>/</kbd> to view and edit all keyboard & mouse shortcuts.
  - Default shortcuts are based on the physical key positions of a US (QWERTY) keyboard, so on other layouts (e.g. QWERTZ/AZERTY) some shortcuts are on different keys. The shortcuts dialog shows the actual keys for your layout, and you can rebind them there.
- **Note:** The original video file will not be modified. Instead, a file is created file in the same directory as the original file with from/to timestamps in the file name.
- See Keyboard shortcuts dialog for more custom actions. (<kbd>SHIFT</kbd> + <kbd>/</kbd>)

## Next steps

- [✨ Features and use cases](features.md)
- [❓ FAQ](faq.md)
- [📝 Recipe cookbook](recipes.md)
- [🤔 Troubleshooting](troubleshooting.md)
