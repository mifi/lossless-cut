const electron = require('electron'); // eslint-disable-line
const $ = require('jquery');
const keyboardJs = require('keyboardjs');
const _ = require('lodash');
const Hammer = require('react-hammerjs');

const React = require('react');
const ReactDOM = require('react-dom');
const classnames = require('classnames');

const captureFrame = require('./capture-frame');
const ffmpeg = require('./ffmpeg');
const util = require('./util');

const dialog = electron.remote.dialog;

function getVideo() {
  return $('#player video')[0];
}

function seekAbs(val) {
  const video = getVideo();
  let outVal = val;
  if (outVal < 0) outVal = 0;
  if (outVal > video.duration) outVal = video.duration;

  video.currentTime = outVal;
}

function setCursor(val) {
  seekAbs(val);
}

function seekRel(val) {
  seekAbs(getVideo().currentTime + val);
}

function shortStep(dir) {
  seekRel((1 / 60) * dir);
}

function renderHelpSheet(visible) {
  if (visible) {
    return (<div className="help-sheet">
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
        <li><kbd>E</kbd> Export selection (in the same dir as the video)</li>
        <li><kbd>C</kbd> Capture snapshot (in the same dir as the video)</li>
      </ul>
    </div>);
  }

  return undefined;
}

class App extends React.Component {
  constructor(props) {
    super(props);

    const defaultState = {
      working: false,
      filePath: '', // Setting video src="" prevents memory leak in chromium
      playing: false,
      currentTime: undefined,
      duration: undefined,
      cutStartTime: 0,
      cutEndTime: undefined,
      fileFormat: undefined,
    };

    this.state = _.cloneDeep(defaultState);

    const resetState = () => {
      const video = getVideo();
      video.currentTime = 0;
      video.playbackRate = 1;
      this.setState(defaultState);
    };

    const load = (filePath) => {
      console.log('Load', filePath);
      if (this.state.working) return alert('I\'m busy');

      resetState();

      this.setState({ working: true });

      return ffmpeg.getFormat(filePath)
        .then((fileFormat) => {
          if (!fileFormat) return alert('Unsupported file');
          return this.setState({ filePath, fileFormat });
        })
        .catch((err) => {
          if (err.code === 1 || err.code === 'ENOENT') {
            alert('Unsupported file');
            return;
          }
          ffmpeg.showFfmpegFail(err);
        })
        .finally(() => this.setState({ working: false }));
    };

    electron.ipcRenderer.on('file-opened', (event, filePaths) => {
      if (!filePaths || filePaths.length !== 1) return;
      load(filePaths[0]);
    });

    document.ondragover = document.ondragend = ev => ev.preventDefault();

    document.body.ondrop = (ev) => {
      ev.preventDefault();
      if (ev.dataTransfer.files.length !== 1) return;
      load(ev.dataTransfer.files[0].path);
    };

    keyboardJs.bind('space', () => this.playCommand());
    keyboardJs.bind('k', () => this.playCommand());
    keyboardJs.bind('j', () => this.changePlaybackRate(-1));
    keyboardJs.bind('l', () => this.changePlaybackRate(1));
    keyboardJs.bind('left', () => seekRel(-1));
    keyboardJs.bind('right', () => seekRel(1));
    keyboardJs.bind('period', () => shortStep(1));
    keyboardJs.bind('comma', () => shortStep(-1));
    keyboardJs.bind('c', () => this.capture());
    keyboardJs.bind('e', () => this.cutClick());
    keyboardJs.bind('i', () => this.setCutStart());
    keyboardJs.bind('o', () => this.setCutEnd());
    keyboardJs.bind('h', () => this.toggleHelp());

    electron.ipcRenderer.send('renderer-ready');
  }

  onPlay(playing) {
    this.setState({ playing });

    if (!playing) {
      getVideo().playbackRate = 1;
    }
  }

  setCutStart() {
    this.setState({ cutStartTime: this.state.currentTime });
  }

  setCutEnd() {
    this.setState({ cutEndTime: this.state.currentTime });
  }

  setOutputDir() {
    dialog.showOpenDialog({ properties: ['openDirectory'] }, (paths) => {
      this.setState({ outputDir: (paths && paths.length === 1) ? paths[0] : undefined });
    });
  }

  getFileUri() {
    return (this.state.filePath || '').replace(/#/g, '%23');
  }

  jumpCutStart() {
    seekAbs(this.state.cutStartTime);
  }

  jumpCutEnd() {
    seekAbs(this.state.cutEndTime);
  }

  handlePan(e) {
    _.throttle(e2 => this.handleTap(e2), 200)(e);
  }

  handleTap(e) {
    const $target = $('.timeline-wrapper');
    const parentOffset = $target.offset();
    const relX = e.srcEvent.pageX - parentOffset.left;
    setCursor((relX / $target[0].offsetWidth) * this.state.duration);
  }

  changePlaybackRate(dir) {
    const video = getVideo();
    if (!this.state.playing) {
      video.playbackRate = 0.5; // dir * 0.5;
      video.play();
    } else {
      const newRate = video.playbackRate + (dir * 0.15);
      video.playbackRate = _.clamp(newRate, 0.05, 16);
    }
  }

  playbackRateChange() {
    this.state.playbackRate = getVideo().playbackRate;
  }

  playCommand() {
    const video = getVideo();
    if (this.state.playing) return video.pause();

    return video.play().catch((err) => {
      console.log(err);
      if (err.name === 'NotSupportedError') {
        alert('This video format is not supported, maybe you can re-format the file first using ffmpeg');
      }
    });
  }

  cutClick() {
    if (this.state.working) return alert('I\'m busy');

    const cutStartTime = this.state.cutStartTime;
    const cutEndTime = this.state.cutEndTime;
    const filePath = this.state.filePath;
    if (cutStartTime === undefined || cutEndTime === undefined) {
      return alert('Please select both start and time');
    }
    if (cutStartTime >= cutEndTime) {
      return alert('Start time must be before end time');
    }

    this.setState({ working: true });
    const outputDir = this.state.outputDir;
    const fileFormat = this.state.fileFormat;
    return ffmpeg.cut(outputDir, filePath, fileFormat, cutStartTime, cutEndTime)
      .catch((err) => {
        console.error('stdout:', err.stdout);
        console.error('stderr:', err.stderr);

        if (err.code === 1 || err.code === 'ENOENT') {
          alert('Whoops! ffmpeg was unable to cut this video. It may be of an unknown format or codec combination');
          return;
        }
        ffmpeg.showFfmpegFail(err);
      })
      .finally(() => this.setState({ working: false }));
  }

  capture() {
    if (!this.state.filePath) return;
    const outPathWithoutExt = `${this.state.filePath}-${util.formatDuration(this.state.currentTime)}`;
    captureFrame(getVideo(), outPathWithoutExt).catch(err => alert(err));
  }

  toggleHelp() {
    this.setState({ helpVisible: !this.state.helpVisible });
  }

  render() {
    return (<div>
      {this.state.filePath ? undefined : <div id="drag-drop-field">DROP VIDEO</div>}
      {this.state.working ? <div id="working"><i className="fa fa-cog fa-spin fa-3x fa-fw" /></div>
        : undefined}

      <div id="player">
        <video
          src={this.getFileUri()}
          onRateChange={() => this.playbackRateChange()}
          onPlay={() => this.onPlay(true)}
          onPause={() => this.onPlay(false)}
          onDurationChange={e => this.setState({ duration: e.target.duration })}
          onTimeUpdate={e => this.setState({ currentTime: e.target.currentTime })}
        />
      </div>

      <div className="controls-wrapper">
        <Hammer
          onTap={e => this.handleTap(e)}
          onPan={e => this.handlePan(e)}
          options={{
            recognizers: {
            },
          }}
        >
          <div className="timeline-wrapper">
            <div className="current-time" style={{ left: `${((this.state.currentTime || 0) / (this.state.duration || 1)) * 100}%` }} />
            <div
              className="cut-start-time"
              style={{
                left: `${((this.state.cutStartTime || 0) / (this.state.duration || 1)) * 100}%`,
                width: `${(((this.state.cutEndTime || 0) - (this.state.cutStartTime || 0)) / (this.state.duration || 1)) * 100}%`,
              }}
            />

            <div id="current-time-display">{util.formatDuration(this.state.currentTime)}</div>
          </div>
        </Hammer>

        <div>
          <i
            className="button fa fa-step-backward"
            aria-hidden="true"
            onClick={() => seekAbs(0)}
          />
          <i
            className="button fa fa-caret-left"
            aria-hidden="true"
            onClick={() => shortStep(-1)}
          />
          <i
            className={classnames({ button: true, fa: true, 'fa-pause': this.state.playing, 'fa-play': !this.state.playing })}
            aria-hidden="true"
            onClick={() => this.playCommand()}
          />
          <i
            className="button fa fa-caret-right"
            aria-hidden="true"
            onClick={() => shortStep(1)}
          />
          <i
            className="button fa fa-step-forward"
            aria-hidden="true"
            onClick={() => seekAbs(this.state.duration)}
          />
        </div>
        <div>
          <button
            className="jump-cut-start" title="Cut start time (jump)"
            onClick={() => this.jumpCutStart()}
          >{util.formatDuration(this.state.cutStartTime || 0)}</button>
          <i
            title="Set cut start"
            className="button fa fa-angle-left"
            aria-hidden="true"
            onClick={() => this.setCutStart()}
          />
          <i
            title="Export selection"
            className="button fa fa-scissors"
            aria-hidden="true"
            onClick={() => this.cutClick()}
          />
          <i
            title="Set cut end"
            className="button fa fa-angle-right"
            aria-hidden="true"
            onClick={() => this.setCutEnd()}
          />
          <button
            className="jump-cut-end" title="Cut end time (jump)"
            onClick={() => this.jumpCutEnd()}
          >{util.formatDuration(this.state.cutEndTime || 0)}</button>
        </div>
      </div>

      <div className="right-menu">
        <button
          title={`Custom output dir (cancel to restore default). Current: ${this.state.outputDir || 'Not set'}`}
          onClick={() => this.setOutputDir()}
        >
          {this.state.outputDir ? `...${this.state.outputDir.substr(-10)}` : 'OUT PATH'}
        </button>
        <button title="Format">
          {this.state.fileFormat || 'FMT'}
        </button>
        <button className="playback-rate" title="Playback rate">
          {_.round(this.state.playbackRate, 1) || 1}x
        </button>
        <i
          title="Capture frame"
          className="button fa fa-camera"
          aria-hidden="true"
          onClick={() => this.capture()}
        />
      </div>

      {renderHelpSheet(this.state.helpVisible)}
    </div>);
  }
}

ReactDOM.render(<App />, document.getElementById('app'));

console.log('Version', electron.remote.app.getVersion());
