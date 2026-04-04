# Command line interface (CLI)

LosslessCut has basic support for automation through the CLI. See also [HTTP API](api.md).

```bash
LosslessCut [options] [files]
```

Note that these examples assume that you have set up the LosslessCut executable to be available in your `PATH` (command line environment). Alternatively you can run it like this:

```bash
# First navigate to the folder containing the LosslessCut app
cd /path/to/directory/containing/app
# Then run it
# On Linux:
./LosslessCut arguments
# On Windows:
./LosslessCut.exe arguments
# On MacOS:
./LosslessCut.app/Contents/MacOS/LosslessCut arguments
```

Note that some users have reported that the Windows Store version of LosslessCut needs an [app execution alias](https://github.com/mifi/lossless-cut/issues/1136).

## Open one or more files:
```bash
LosslessCut file1.mp4 file2.mkv
```

## Override settings (experimental) 🧪

See [available settings](https://github.com/mifi/lossless-cut/blob/master/src/main/configStore.ts). Note that this is subject to change in newer versions. ⚠️ If you specify incorrect values it could corrupt your configuration file. You may use JSON or JSON5. Example:
```bash
LosslessCut --settings-json '{captureFormat:"jpeg", "keyframeCut":true}'
```

### Override FFmpeg/FFprobe path

Overriding path to FFmpeg/FFprobe can be done in the UI, or with the following command:

```bash
LosslessCut --settings-json '{customFfPath:"/path/to/folder/containing/ffmpeg_and_ffprobe"}'
```

## Other options

- `--locales-path` Customise path to locales (useful for [translators](translation.md)).
- `--disable-networking` Turn off all network requests (see [#1418](https://github.com/mifi/lossless-cut/issues/1418)).
- `--http-api` Start the [HTTP server with an API](api.md) to control LosslessCut, optionally specifying a port (default `8080`).
- `--keyboard-action` Run a keyboard action (see below.)
- `--config-dir` Path to a directory where the `config.json` file will be stored and loaded from. Note: don't include `config.json` in the path (only the directory containing it).

## Controlling a running instance (experimental) 🧪

If you have the "Allow multiple instances" setting enabled, you can control a running instance of LosslessCut from the outside, using for example a command line. You do this by issuing messages to it through the `LosslessCut` command. Currently only keyboard actions are supported, and you can open files. *Note that this is considered experimental and the API may change at any time.*

### Open files in running instance

```bash
LosslessCut file1.mp4 file2.mkv
```

### Keyboard actions, `--keyboard-action`

Simulate a keyboard press action in an already running instance of LosslessCut. **Note that the command will return immediately**, so if you want to run multiple actions in a sequence, you have to `sleep` for a few seconds between the commands. Alternatively if you want to wait until an action has finished processing, use the [HTTP API](api.md) instead.

### Available keyboard actions

A list of the available action names can be found in the "Keyboard shortcuts" dialog in the app. Note that you don't have to bind them to any key before using them.

#### Example keyboard actions

Open a file and export it:
```bash
# Open a file in an already running instance
LosslessCut file.mp4
sleep 3 # hopefully the file has loaded by now
# Export the currently opened file
LosslessCut --keyboard-action export
```

Seek to specific time in the media:
```bash
LosslessCut --keyboard-action goToTimecodeDirect '{"time": "12.23"}'
```

### HTTP API

You can also control a running instance with the [HTTP API](api.md).
