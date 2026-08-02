# HTTP API 🧪

LosslessCut can be controlled via a HTTP API, if it is being run with the command line option `--http-api`. **Note that the HTTP API is experimental and may change at any time.**

See also [CLI](cli.md).

## Enabling the API

To enable the API, run LosslessCut from the command line with this flag:

```bash
LosslessCut --http-api
```

## Security

The server listens on `127.0.0.1` only, so it cannot be reached from other computers. It has no authentication, so any program running on your computer can control LosslessCut while the API is enabled.

Requests coming from a web browser are rejected with `403`, because a web page you visit must not be able to control LosslessCut. This means requests must have a `Host` header of `localhost`/`127.0.0.1` (this prevents [DNS rebinding](https://en.wikipedia.org/wiki/DNS_rebinding)) and must not have an `Origin` header (which browsers always send, but command line tools don't).

## Action endpoint: `POST /api/action/:action`

Execute a keyboard shortcut `action`, similar to the `--keyboard-action` CLI option. This is different from the CLI in that most of the actions (but not all) will wait for the action to finish before responding to the HTTP request.

See [Available keyboard actions](cli.md#available-keyboard-actions).

### Example actions

Export the currently opened file:
```bash
curl -X POST http://localhost:8080/api/action/export
```

Seek to time:
```bash
curl -X POST http://localhost:8080/api/action/goToTimecodeDirect --json '{"time": "09:11"}'
```

Open one or more files:
```bash
curl -X POST http://localhost:8080/api/action/openFiles --json '["/path/to/file.mp4"]'
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

## Await event endpoint

This special endpoint allows you to wait for a certain event to occur in the app. The endpoint will hang and respond/return only when the event fires. Below are supported events.

### Event: `export-start`

Emitted when the export operation starts. The endpoint will return JSON `{ path: string }`.

### Event: `export-complete`

Emitted when the export operation completes (either success or failure). If successful, the endpoint will return JSON `{ paths: string[] }`.

#### Examples

Run a command after each file that has completed exporting:
```bash
while true; do
  echo 'Do something with exported file path:' $(curl -s -X POST http://localhost:8080/api/await-event/export-complete | jq -r '.paths[0]')
done
```
