const electron = require('electron'); // eslint-disable-line
const $ = require('jquery');
const Mousetrap = require('mousetrap');
const _ = require('lodash');
const Hammer = require('react-hammerjs');
const path = require('path');

const React = require('react');
const ReactDOM = require('react-dom');
const classnames = require('classnames');

const captureFrame = require('./capture-frame');
const ffmpeg = require('./ffmpeg');
const util = require('./util');

const dialog = electron.remote.dialog;

function setFileNameTitle(filePath) {
  const appName = 'LosslessCut';
  document.title = filePath ? `${appName} - ${path.basename(filePath)}` : 'appName';
}

function getVideo() {
  return $('#player video')[0];
}

function seekAbs(val) {
  const video = getVideo();
  if (val == null || isNaN(val)) return;

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
        <li><kbd>E</kbd> Cut (export selection in the same directory)</li>
        <li><kbd>C</kbd> Capture snapshot (in the same directory)</li>
      </ul>
    </div>);
  }

  return undefined;
}

function withBlur(cb) {
  return (e) => {
    e.target.blur();
    cb();
  };
}

class App extends React.Component {
  constructor(props) {
    super(props);

    const defaultState = {
      working: false,
      filePath: '', // Setting video src="" prevents memory leak in chromium
      html5FriendlyPath: undefined,
      playing: false,
      currentTime: undefined,
      duration: undefined,
      cutStartTime: 0,
      cutStartTimeManual: undefined,
      cutEndTime: undefined,
      cutEndTimeManual: undefined,
      fileFormat: undefined,
      captureFormat: 'jpeg',
      rotation: 360,
      cutProgress: undefined,
      includeAllStreams: false,
    };

    this.state = _.cloneDeep(defaultState);

    const resetState = () => {
      const video = getVideo();
      video.currentTime = 0;
      video.playbackRate = 1;
      this.setState(defaultState);
    };

    const load = (filePath, html5FriendlyPath) => {
      console.log('Load', { filePath, html5FriendlyPath });
      if (this.state.working) return alert('I\'m busy');

      resetState();

      setFileNameTitle();

      this.setState({ working: true });

      return ffmpeg.getFormat(filePath)
        .then((fileFormat) => {
          if (!fileFormat) return alert('Unsupported file');
          setFileNameTitle(filePath);
          return this.setState({ filePath, html5FriendlyPath, fileFormat });
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

    electron.ipcRenderer.on('html5ify', async (event, encodeVideo) => {
      const { filePath, customOutDir } = this.state;
      if (!filePath) return;

      try {
        this.setState({ working: true });
        const html5ifiedPath = util.getOutPath(customOutDir, filePath, 'html5ified.mp4');
        await ffmpeg.html5ify(filePath, html5ifiedPath, encodeVideo);
        this.setState({ working: false });
        load(filePath, html5ifiedPath);
      } catch (err) {
        alert('Failed to html5ify file');
        console.error('Failed to html5ify file', err);
        this.setState({ working: false });
      }
    });

    document.ondragover = document.ondragend = ev => ev.preventDefault();

    document.body.ondrop = (ev) => {
      ev.preventDefault();
      if (ev.dataTransfer.files.length !== 1) return;
      load(ev.dataTransfer.files[0].path);
    };

    Mousetrap.bind('space', () => this.playCommand());
    Mousetrap.bind('k', () => this.playCommand());
    Mousetrap.bind('j', () => this.changePlaybackRate(-1));
    Mousetrap.bind('l', () => this.changePlaybackRate(1));
    Mousetrap.bind('left', () => seekRel(-1));
    Mousetrap.bind('right', () => seekRel(1));
    Mousetrap.bind('.', () => shortStep(1));
    Mousetrap.bind(',', () => shortStep(-1));
    Mousetrap.bind('c', () => this.capture());
    Mousetrap.bind('e', () => this.cutClick());
    Mousetrap.bind('i', () => this.setCutStart());
    Mousetrap.bind('o', () => this.setCutEnd());
    Mousetrap.bind('h', () => this.toggleHelp());

    electron.ipcRenderer.send('renderer-ready');
  }

  onPlay(playing) {
    this.setState({ playing });

    if (!playing) {
      getVideo().playbackRate = 1;
    }
  }

  onDurationChange(duration) {
    this.setState({ duration });
    if (!this.state.cutEndTime) this.setState({ cutEndTime: duration });
  }

  onCutProgress(cutProgress) {
    this.setState({ cutProgress });
  }

  setCutStart() {
    this.setState({ cutStartTime: this.state.currentTime });
  }

  setCutEnd() {
    this.setState({ cutEndTime: this.state.currentTime });
  }

  setOutputDir() {
    dialog.showOpenDialog({ properties: ['openDirectory'] }, (paths) => {
      this.setState({ customOutDir: (paths && paths.length === 1) ? paths[0] : undefined });
    });
  }

  getFileUri() {
    return (this.state.html5FriendlyPath || this.state.filePath || '').replace(/#/g, '%23');
  }

  getOutputDir() {
    if (this.state.customOutDir) return this.state.customOutDir;
    if (this.state.filePath) return path.dirname(this.state.filePath);
    return undefined;
  }

  getRotation() {
    return this.state.rotation;
  }

  getRotationStr() {
    return `${this.getRotation()}°`;
  }

  isRotationSet() {
    // 360 means we don't modify rotation
    return this.state.rotation !== 360;
  }

  areCutTimesSet() {
    return (this.state.cutStartTime !== undefined || this.state.cutEndTime !== undefined);
  }

  isCutRangeValid() {
    return this.areCutTimesSet() && this.state.cutStartTime < this.state.cutEndTime;
  }

  increaseRotation() {
    const rotation = (this.state.rotation + 90) % 450;
    this.setState({ rotation });
  }

  toggleCaptureFormat() {
    const isPng = this.state.captureFormat === 'png';
    this.setState({ captureFormat: isPng ? 'jpeg' : 'png' });
  }

  toggleIncludeAllStreams() {
    this.setState({ includeAllStreams: !this.state.includeAllStreams });
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
        alert('This video format or codec is not supported. Try to convert it to a friendly format/codec in the player from the "File" menu.');
      }
    });
  }

  async cutClick() {
    if (this.state.working) return alert('I\'m busy');

    const cutStartTime = this.state.cutStartTime;
    const cutEndTime = this.state.cutEndTime;
    const filePath = this.state.filePath;
    const outputDir = this.state.customOutDir;
    const fileFormat = this.state.fileFormat;
    const videoDuration = this.state.duration;
    const rotation = this.isRotationSet() ? this.getRotation() : undefined;
    const includeAllStreams = this.state.includeAllStreams;

    if (!this.areCutTimesSet()) {
      return alert('Please select both start and end time');
    }
    if (!this.isCutRangeValid()) {
      return alert('Start time must be before end time');
    }

    this.setState({ working: true });
    try {
      return await ffmpeg.cut({
        customOutDir: outputDir,
        filePath,
        format: fileFormat,
        cutFrom: cutStartTime,
        cutTo: cutEndTime,
        videoDuration,
        rotation,
        includeAllStreams,
        onProgress: progress => this.onCutProgress(progress),
      });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.code === 1 || err.code === 'ENOENT') {
        return alert('Whoops! ffmpeg was unable to cut this video. It may be of an unknown format or codec combination');
      }
      return ffmpeg.showFfmpegFail(err);
    } finally {
      this.setState({ working: false });
    }
  }

  capture() {
    const filePath = this.state.filePath;
    const outputDir = this.state.customOutDir;
    const currentTime = this.state.currentTime;
    const captureFormat = this.state.captureFormat;
    if (!filePath) return;
    captureFrame(outputDir, filePath, getVideo(), currentTime, captureFormat)
      .catch(err => alert(err));
  }

  toggleHelp() {
    this.setState({ helpVisible: !this.state.helpVisible });
  }

  renderCutTimeInput(type) {
    const cutTimeKey = type === 'start' ? 'cutStartTime' : 'cutEndTime';
    const cutTimeManualKey = type === 'start' ? 'cutStartTimeManual' : 'cutEndTimeManual';
    const cutTimeInputStyle = { width: '8em', textAlign: type === 'start' ? 'right' : 'left' };

    const isCutTimeManualSet = () => this.state[cutTimeManualKey] !== undefined;

    const handleCutTimeInput = (text) => {
      // Allow the user to erase
      if (text.length === 0) {
        this.setState({ [cutTimeManualKey]: undefined });
        return;
      }

      const time = util.parseDuration(text);
      if (time === undefined) {
        this.setState({ [cutTimeManualKey]: text });
        return;
      }

      this.setState({ [cutTimeManualKey]: undefined, [cutTimeKey]: time });
    };


    return (<input
      style={{ ...cutTimeInputStyle, color: isCutTimeManualSet() ? '#dc1d1d' : undefined }}
      type="text"
      onChange={e => handleCutTimeInput(e.target.value)}
      value={isCutTimeManualSet()
        ? this.state[cutTimeManualKey]
        : util.formatDuration(this.state[cutTimeKey])
      }
    />);
  }

  render() {
    const jumpCutButtonStyle = { position: 'absolute', color: 'black', bottom: 0, top: 0, padding: '2px 8px' };

    return (<div>
      {!this.state.filePath && <div id="drag-drop-field">DROP VIDEO</div>}
      {this.state.working && (
        <div style={{ color: 'white', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '.5em', margin: '1em', padding: '.2em .5em', position: 'absolute', zIndex: 1, top: 0, left: 0 }}>
          <i className="fa fa-cog fa-spin fa-3x fa-fw" style={{ verticalAlign: 'middle', width: '1em', height: '1em' }} />
          {this.state.cutProgress != null &&
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', paddingLeft: '.4em' }}>
              {Math.floor(this.state.cutProgress * 100)} %
            </span>
          }
        </div>
      )}

      <div id="player">
        <video
          src={this.getFileUri()}
          onRateChange={() => this.playbackRateChange()}
          onPlay={() => this.onPlay(true)}
          onPause={() => this.onPlay(false)}
          onDurationChange={e => this.onDurationChange(e.target.duration)}
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

            {this.isCutRangeValid() &&
              <div
                className="cut-start-time"
                style={{
                  left: `${((this.state.cutStartTime) / (this.state.duration || 1)) * 100}%`,
                  width: `${(((this.state.cutEndTime) - this.state.cutStartTime) / (this.state.duration || 1)) * 100}%`,
                }}
              />
            }

            <div id="current-time-display">{util.formatDuration(this.state.currentTime)}</div>
          </div>
        </Hammer>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <i
            className="button fa fa-step-backward"
            aria-hidden="true"
            title="Jump to start of video"
            onClick={() => seekAbs(0)}
          />

          <div style={{ position: 'relative' }}>
            {this.renderCutTimeInput('start')}
            <i
              style={{ ...jumpCutButtonStyle, left: 0 }}
              className="fa fa-step-backward"
              title="Jump to cut start"
              aria-hidden="true"
              onClick={withBlur(() => this.jumpCutStart())}
            />
          </div>

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

          <div style={{ position: 'relative' }}>
            {this.renderCutTimeInput('end')}
            <i
              style={{ ...jumpCutButtonStyle, right: 0 }}
              className="fa fa-step-forward"
              title="Jump to cut end"
              aria-hidden="true"
              onClick={withBlur(() => this.jumpCutEnd())}
            />
          </div>

          <i
            className="button fa fa-step-forward"
            aria-hidden="true"
            title="Jump to end of video"
            onClick={() => seekAbs(this.state.duration)}
          />
        </div>

        <div>
          <i
            title="Set cut start to current position"
            className="button fa fa-angle-left"
            aria-hidden="true"
            onClick={() => this.setCutStart()}
          />
          <i
            title="Cut"
            className="button fa fa-scissors"
            aria-hidden="true"
            onClick={() => this.cutClick()}
          />
          <i
            title="Set cut end to current position"
            className="button fa fa-angle-right"
            aria-hidden="true"
            onClick={() => this.setCutEnd()}
          />
        </div>
      </div>

      <div className="left-menu">
        <button title="Format of current file">
          {this.state.fileFormat || 'FMT'}
        </button>

        <button className="playback-rate" title="Playback rate">
          {_.round(this.state.playbackRate, 1) || 1}x
        </button>
      </div>

      <div className="right-menu">
        <button
          title={`Set output streams. Current: ${this.state.includeAllStreams ? 'include (and cut) all streams' : 'include only primary streams'}`}
          onClick={withBlur(() => this.toggleIncludeAllStreams())}
        >
          {this.state.includeAllStreams ? 'all' : 'ps'}
        </button>

        <button
          title={`Set output rotation. Current: ${this.isRotationSet() ? this.getRotationStr() : 'Don\'t modify'}`}
          onClick={withBlur(() => this.increaseRotation())}
        >
          {this.isRotationSet() ? this.getRotationStr() : '-°'}
        </button>

        <button
          title={`Custom output dir (cancel to restore default). Current: ${this.getOutputDir() || 'Not set (use input dir)'}`}
          onClick={withBlur(() => this.setOutputDir())}
        >
          {this.getOutputDir() ? `...${this.getOutputDir().substr(-10)}` : 'OUTDIR'}
        </button>

        <i
          title="Capture frame"
          style={{ margin: '-.4em -.2em' }}
          className="button fa fa-camera"
          aria-hidden="true"
          onClick={() => this.capture()}
        />

        <button
          title="Capture frame format"
          onClick={withBlur(() => this.toggleCaptureFormat())}
        >
          {this.state.captureFormat}
        </button>
      </div>

      {renderHelpSheet(this.state.helpVisible)}
    </div>);
  }
}

ReactDOM.render(<App />, document.getElementById('app'));

console.log('Version', electron.remote.app.getVersion());
