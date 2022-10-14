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

## Multiple instances (experimental)

By default, only a single running instance of LosslessCut is allowed. If you start a new LosslessCut instance from the command line, it will instead pass the list of files onto the already running instance. You can override this behavior by passing this option via the CLI:
```bash
LosslessCut --allow-multiple-instances
```
