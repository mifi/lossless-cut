const electron = require('electron'); // eslint-disable-line
const $ = require('jquery');
const keyboardJs = require('keyboardjs');
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
  document.title = `${appName} - ${path.basename(filePath)}`;
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
        <li><kbd>E</kbd> Export selection (in the same dir as the video)</li>
        <li><kbd>C</kbd> Capture snapshot (in the same dir as the video)</li>
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
      cutting: false,
      filePath: '', // Setting video src="" prevents memory leak in chromium
      playing: false,
      currentTime: undefined,
      duration: undefined,
      currentCutPoint: 0,
      cutPoints: [
        {cutStartTime: 0, cutEndTime: undefined},
      ],
      fileFormat: undefined,
      captureFormat: 'jpeg',
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
          setFileNameTitle(filePath);
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

  onDurationChange(duration) {
    this.setState({ duration });
    var cutPoints = this.state.cutPoints;
    if (!cutPoints[0].cutEndTime) {
      cutPoints[0].cutEndTime = duration;
      this.setState({ cutPoints });
    }
  }

  previousCut() {
    if (this.state.currentCutPoint > 0) {
      this.setState({ currentCutPoint: this.state.currentCutPoint - 1 });
    }
  }

  nextCut() {
    if (this.state.currentCutPoint < this.state.cutPoints.length-1) {
      this.setState({ currentCutPoint: this.state.currentCutPoint + 1 });
    }
  }

  addCutPoint() {
    const currentCutPoint = this.state.currentCutPoint;
    const futureCutPoint = this.state.cutPoints.length;
    const duration = this.state.duration;
    var cutPoints = this.state.cutPoints;
    
    var cutStartTime = this.state.currentTime;
    var cutEndTime = undefined;
    const lastCutPointDuration = cutPoints[currentCutPoint].cutEndTime - cutPoints[currentCutPoint].cutStartTime;
    if (lastCutPointDuration + cutStartTime < duration) cutEndTime = lastCutPointDuration + cutStartTime;
    cutPoints.push({cutStartTime: cutStartTime, cutEndTime: cutEndTime});
    this.setState({ currentCutPoint: futureCutPoint, cutPoints });
  }

  removeCutPoint() {
    const currentCutPoint = this.state.currentCutPoint;
    var cutPoints = this.state.cutPoints;
    if (currentCutPoint > 0 || cutPoints.length > 1) {
      cutPoints.splice(currentCutPoint, 1);
      if (currentCutPoint === 0) {
        this.setState({ currentCutPoint: currentCutPoint, cutPoints });
      } else {
        this.setState({ currentCutPoint: currentCutPoint - 1, cutPoints });
      }
    }
  }

  getDurationOfCurrentCut() {
    const cutStartTime = this.getCurrentCutStartTime();
    const cutEndTime = this.getCurrentCutEndTime();
    if (cutStartTime !== undefined && cutEndTime !== undefined){
      return util.formatDuration(cutEndTime - cutStartTime);
    } else {
      return util.formatDuration(0);
    }
  }

  getCurrentCutStartTime() {
    return this.state.cutPoints[this.state.currentCutPoint].cutStartTime;
  }
  
  getCurrentCutEndTime() {
    return this.state.cutPoints[this.state.currentCutPoint].cutEndTime;
  }

  onCutProgress(cutProgress) {
    this.setState({ cutProgress });
  }

  setCutStart() {
    var cutPoints = this.state.cutPoints;
    cutPoints[this.state.currentCutPoint].cutStartTime = this.state.currentTime;
    this.setState({ cutPoints });
  }

  setCutEnd() {
    var cutPoints = this.state.cutPoints;
    cutPoints[this.state.currentCutPoint].cutEndTime = this.state.currentTime;
    this.setState({ cutPoints });
  }

  setOutputDir() {
    dialog.showOpenDialog({ properties: ['openDirectory'] }, (paths) => {
      this.setState({ customOutDir: (paths && paths.length === 1) ? paths[0] : undefined });
    });
  }

  getFileUri() {
    return (this.state.filePath || '').replace(/#/g, '%23');
  }

  getOutputDir() {
    if (this.state.customOutDir) return this.state.customOutDir;
    if (this.state.filePath) return path.dirname(this.state.filePath);
    return undefined;
  }

  toggleCaptureFormat() {
    const isPng = this.state.captureFormat === 'png';
    this.setState({ captureFormat: isPng ? 'jpeg' : 'png' });
  }

  jumpCutStart() {
    seekAbs(this.getCurrentCutStartTime());
  }

  jumpCutEnd() {
    seekAbs(this.getCurrentCutEndTime());
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

  cutProofClips() {
    const cutPoints = this.state.cutPoints;
    for (var i=0; i < cutPoints.length; i++) {
      if (cutPoints[i].cutStartTime === undefined || cutPoints[i].cutEndTime === undefined) {
        return alert(`Please select both start and end time of cut ${i+1}`);
      }
      if (cutPoints[i].cutStartTime >= cutPoints[i].cutEndTime) {
        return alert(`Start time must be before end time of cut ${i+1}`);
      }
    }
  }

  async cutClick() {
    if (this.state.working) return alert('I\'m busy');

    this.cutProofClips();

    const cutPoints = this.state.cutPoints;
    const filePath = this.state.filePath;
    const outputDir = this.state.customOutDir;
    const fileFormat = this.state.fileFormat;
    this.setState({ working: true, cutting: true });
    
    for (var i=0; i < cutPoints.length; i++) {
      await this.cutClickClip(i, cutPoints[i].cutStartTime, cutPoints[i].cutEndTime, filePath, outputDir, fileFormat);
    }

    this.setState({ working: false, cutting: false });
  }

  async cutClickClip(cutPointNr, cutStartTime, cutEndTime , filePath, outputDir, fileFormat) {
    try {
      this.setState({ currentCutPoint: cutPointNr });
      return await ffmpeg.cut(
      outputDir,
      filePath,
      fileFormat,
      cutStartTime,
      cutEndTime,
      progress => this.onCutProgress(progress),
      );
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.code === 1 || err.code === 'ENOENT') {
        return alert('Whoops! ffmpeg was unable to cut this video. It may be of an unknown format or codec combination');
      }
      return ffmpeg.showFfmpegFail(err);
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

  render() {
    return (<div>
      {!this.state.filePath && <div id="drag-drop-field">DROP VIDEO</div>}
      {this.state.working && (
        <div id="working">
          <i className="fa fa-cog fa-spin fa-3x fa-fw" style={{ verticalAlign: 'middle' }} />
          <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {Math.floor((this.state.cutProgress || 0) * 100)} % 
          </span>
          {this.state.cutting && this.state.cutPoints.length > 1 && <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            ({this.state.currentCutPoint+1} of {this.state.cutPoints.length})
          </span>}
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
            {this.state.cutPoints.map((cutPoint,i) => 
              <div
                key={i}
                className={`cut-start-time${this.state.currentCutPoint === i ? (' active'):('')}`}
                style={{
                  left: `${((cutPoint.cutStartTime || 0) / (this.state.duration || 1)) * 100}%`,
                  width: `${(((cutPoint.cutEndTime || 0) - (cutPoint.cutStartTime || 0)) / (this.state.duration || 1)) * 100}%`,
                }}
              />
            )}

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
            onClick={withBlur(() => this.jumpCutStart())}
          >{util.formatDuration(this.getCurrentCutStartTime() || 0)}</button>
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
            onClick={withBlur(() => this.jumpCutEnd())}
          >{util.formatDuration(this.getCurrentCutEndTime() || 0)}</button>
        </div>
      </div>

      <div className="left-top-menu">
        <button 
          title="Add new cutting point"
          onClick={() => this.addCutPoint()}
        > +
        </button>
        <i
          title="Go to previous cutting point"
          className="button fa fa-angle-left"
          aria-hidden="true"
          onClick={() => this.previousCut()}
        />
        <button title="Current cut point">
          {this.state.currentCutPoint + 1} / {this.state.cutPoints.length}
        </button>
        <i
          title="Go to next cutting point"
          className="button fa fa-angle-right"
          aria-hidden="true"
          onClick={() => this.nextCut()}
        />
        <button 
          title="Remove current cutting point"
          onClick={() => this.removeCutPoint()}
        > -
        </button>
        <button title="Duration of current cut">
          {this.getDurationOfCurrentCut()}
        </button>
      </div>

{/*       <div className="right-top-menu">
      </div> */}

      <div className="left-menu">
        <button title="Format">
          {this.state.fileFormat || 'FMT'}
        </button>

        <button className="playback-rate" title="Playback rate">
          {_.round(this.state.playbackRate, 1) || 1}x
        </button>
      </div>

      <div className="right-menu">
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
