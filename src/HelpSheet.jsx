const React = require('react');
const PropTypes = require('prop-types');

/* eslint-disable react/jsx-one-expression-per-line */
const HelpSheet = ({ visible }) => {
  if (visible) {
    return (
      <div className="help-sheet">
        <h1>Keyboard shortcuts</h1>
        <ul>
          <li><kbd>H</kbd> Show/hide help</li>
          <li><kbd>SPACE</kbd>, <kbd>k</kbd> Play/pause</li>
          <li><kbd>J</kbd> Slow down video</li>
          <li><kbd>L</kbd> Speed up video</li>
          <li><kbd>←</kbd> Seek backward 1 sec</li>
          <li><kbd>→</kbd> Seek forward 1 sec</li>
          <li><kbd>.</kbd> (period) Tiny seek forward (1/60 sec)</li>
          <li><kbd>,</kbd> (comma) Tiny seek backward (1/60 sec)</li>
          <li><kbd>I</kbd> Mark in / cut start point</li>
          <li><kbd>O</kbd> Mark out / cut end point</li>
          <li><kbd>E</kbd> Cut (export selection in the same directory)</li>
          <li><kbd>C</kbd> Capture snapshot (in the same directory)</li>
        </ul>
      </div>
    );
  }

  return null;
};
/* eslint-enable react/jsx-one-expression-per-line */

HelpSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
};

module.exports = HelpSheet;
