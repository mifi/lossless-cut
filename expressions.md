# Expressions

LosslessCut has support for normal JavaScript expressions.

## Select segments by expression

You will be given a variable `segment` and can create an expression that returns `true` or `false`. For example to select all segments with a duration of less than 5 seconds use this expression:

```js
segment.duration < 5
```

## Edit segments by expression

LosslessCut has support for normal JavaScript expressions. You will be given a variable `segment` for each selected segment and can return a new segment with modified properties.

See more examples in-app.
