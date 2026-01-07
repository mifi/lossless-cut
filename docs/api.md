# HTTP API 🧪

LosslessCut can be controlled via a HTTP API, if it is being run with the command line option `--http-api`. See also [CLI](cli.md). **Note that the HTTP API is experimental and may change at any time.**

## Programmatically opening a file

This must be done with [the CLI](cli.md).

## Enabling the API

```bash
LosslessCut --http-api
```

## API endpoints

### `POST /api/action/:action`

Execute a keyboard shortcut `action`, similar to the `--keyboard-action` CLI option. This is different from the CLI in that most of the actions will wait for the action to finish before responding to the HTTP request (but not all).

#### [Available keyboard actions](cli.md#available-keyboard-actions)

#### Example

Export the currently opened file:

```bash
curl -X POST http://localhost:8080/api/action/export
```

Seek to time:
```bash
curl -X POST http://localhost:8080/api/action/goToTimecodeDirect --json '{"time": "09:11"}'
```


### Batch example

Start the main LosslessCut in one terminal with the HTTP API enabled:

```bash
LosslessCut --http-api
```

Then run the script in a different terminal:

```bash
for PROJECT in /path/to/folder/with/projects/*.llc
    LosslessCut $PROJECT
    sleep 5 # wait for the file to open
    curl -X POST http://localhost:8080/api/action/export
    curl -X POST http://localhost:8080/api/action/closeCurrentFile
done
```
