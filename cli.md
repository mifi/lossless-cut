# Command line interface (CLI)

LosslessCut has limited support for automation through the CLI. Note that these examples assume that you have set up LosslessCut in your `PATH` environment. Alternatively you can run it like this:
```bash
# First navigate to the folder containing the LosslessCut app
cd /path/to/directory/containing/app
# On Linux:
./LosslessCut arguments
# On Windows:
./LosslessCut.exe arguments
# On MacOS:
./LosslessCut.app/Contents/MacOS/LosslessCut arguments
```

## Open one or more files:
```bash
LosslessCut file1.mp4 file2.mkv
```

## Override settings (experimental)
See [available settings](https://github.com/mifi/lossless-cut/blob/master/public/configStore.js). Note that this is subject to change in newer versions. ⚠️ If you specify incorrect values it could corrupt your configuration file. You may use JSON or JSON5:
```bash
LosslessCut --settings-json '{captureFormat:"jpeg", "keyframeCut":true}'
```

## Controlling a running instance (experimental)

If you have the "Allow multiple instances" setting enabled, you can control a running instance of LosslessCut from the outside, using for example a command line. You do this by issuing messages to it through the `LosslessCut` command. Currently only keyboard actions are supported. *Note that this is considered experimental and the API may change at any time.*

### Keyboard actions, `--keyboard-action`

Simulate a keyboard press action. The available action names can be found in the "Keyboard shortcuts" dialog (Note: you don't have to bind them to any key).

Example:

```bash
# Export the currently opened file
LosslessCut --keyboard-action export
```

#### Batch example

Note that there is no synchronization, and the action will exit immediately, regardless of how long the action takes. This means that you will have to sleep between multiple actions.

```bash
for PROJECT in /path/to/folder/with/projects/*.llc
    LosslessCut $PROJECT
    sleep 5 # wait for the file to open
    LosslessCut --keyboard-action export
    sleep 10 # hopefully done by then
    LosslessCut --keyboard-action quit
done
```