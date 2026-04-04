# JavaScript expressions

LosslessCut has support for JavaScript expressions in certain dialogs. This is a base JavaScript environment with [core JavaScript functionality](https://developer.mozilla.org/en-US/docs/Web/JavaScript) available for you to use.

## Select segments by expression

You will be given a global variable called `segment` (type [`Segment`](generated/types.md#segment)) and you can create an expression that returns `true` or `false` based on custom logic. For example to select all segments with a duration of less than 5 seconds use this expression:

```js
segment.duration < 5
```

## Edit segments by expression

LosslessCut has support for normal JavaScript expressions. You will be given a variable `segment` (type [`Segment`](generated/types.md#segment)) for each selected segment and can return a new segment with modified properties.

See more examples in-app.

## Output name template

You can also use JavaScript expressions when referring to variables inside `${}` in output file name templates, e.g. `${FILENAME.toLowerCase()}`.

See also [Export file name template](file-name-template.md).

## Select tracks by expression

For available variables, open the *Tracks* dialog, then for the respective track, open *Track info* and you will see all available variables which you can use in your filter.
