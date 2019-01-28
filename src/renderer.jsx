const electron = require('electron'); // eslint-disable-line
const $ = require('jquery');
const Mousetrap = require('mousetrap');
const round = require('lodash/round');
const clamp = require('lodash/clamp');
const throttle = require('lodash/throttle');
const Hammer = require('react-hammerjs').default;
const path = require('path');
const trash = require('trash');

const React = require('react');
const ReactDOM = require('react-dom');
const classnames = require('classnames');

const HelpSheet = require('./HelpSheet');
const { showMergeDialog } = require('./merge/merge');

const captureFrame = require('./capture-frame');
const ffmpeg = require('./ffmpeg');


const {
  getOutPath, parseDuration, formatDuration, toast, errorToast, showFfmpegFail, setFileNameTitle,
  promptTimeOffset,
} = require('./util');

const { dialog } = electron.remote;

function getVideo() {
  return $('#player video')[0];
}

function seekAbs(val) {
  const video = getVideo();
  if (val == null || Number.isNaN(val)) return;

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

function withBlur(cb) {
  return (e) => {
    e.target.blur();
    cb();
  };
}


const localState = {
  working: false,
  filePath: '', // Setting video src="" prevents memory leak in chromium
  html5FriendlyPath: undefined,
  playing: false,
  currentTime: undefined,
  duration: undefined,
  cutStartTime: undefined,
  cutStartTimeManual: undefined,
  cutEndTime: undefined,
  cutEndTimeManual: undefined,
  fileFormat: undefined,
  rotation: 360,
  cutProgress: undefined,
  startTimeOffset: 0,
};

const globalState = {
  stripAudio: false,
  includeAllStreams: true,
  captureFormat: 'jpeg',
  customOutDir: undefined,
  keyframeCut: true,
};

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      ...localState,
      ...globalState,
    };

    const load = async (filePath, html5FriendlyPath) => {
      const { working } = this.state;

      console.log('Load', { filePath, html5FriendlyPath });
      if (working) {
        errorToast('I\'m busy');
        return;
      }

      this.resetState();

      this.setState({ working: true });

      try {
        const fileFormat = await ffmpeg.getFormat(filePath);
        if (!fileFormat) {
          errorToast('Unsupported file');
          return;
        }
        setFileNameTitle(filePath);
        this.setState({ filePath, html5FriendlyPath, fileFormat });
      } catch (err) {
        if (err.code === 1 || err.code === 'ENOENT') {
          errorToast('Unsupported file');
          return;
        }
        showFfmpegFail(err);
      } finally {
        this.setState({ working: false });
      }
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
        const html5ifiedPath = getOutPath(customOutDir, filePath, 'html5ified.mp4');
        await ffmpeg.html5ify(filePath, html5ifiedPath, encodeVideo);
        this.setState({ working: false });
        load(filePath, html5ifiedPath);
      } catch (err) {
        errorToast('Failed to html5ify file');
        console.error('Failed to html5ify file', err);
        this.setState({ working: false });
      }
    });

    electron.ipcRenderer.on('show-merge-dialog', () => showMergeDialog({
      dialog,
      defaultPath: this.getOutputDir(),
      onMergeClick: async (paths) => {
        try {
          this.setState({ working: true });

          // TODO customOutDir ?
          // console.log('merge', paths);
          await ffmpeg.mergeFiles(paths);
        } catch (err) {
          errorToast('Failed to merge files. Make sure they are all of the exact same format and codecs');
          console.error('Failed to merge files', err);
        } finally {
          this.setState({ working: false });
        }
      },
    }));

    electron.ipcRenderer.on('set-start-offset', async () => {
      const { startTimeOffset: startTimeOffsetOld } = this.state;
      const startTimeOffset = await promptTimeOffset(
        startTimeOffsetOld !== undefined ? formatDuration(startTimeOffsetOld) : undefined,
      );

      if (startTimeOffset === undefined) return;

      this.setState({ startTimeOffset });
    });

    electron.ipcRenderer.on('extract-all-streams', async () => {
      const { filePath } = this.state;
      if (!filePath) return;

      try {
        this.setState({ working: true });
        // TODO customOutDir ?
        await ffmpeg.extractAllStreams(filePath);
        this.setState({ working: false });
      } catch (err) {
        errorToast('Failed to extract all streams');
        console.error('Failed to extract all streams', err);
        this.setState({ working: false });
      }
    });

    document.ondragover = ev => ev.preventDefault();
    document.ondragend = document.ondragover;

    document.body.ondrop = (ev) => {
      ev.preventDefault();
      if (ev.dataTransfer.files.length !== 1) {
        errorToast('Please drop only one file');
        return;
      }
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
  }

  onCutProgress = (cutProgress) => {
    this.setState({ cutProgress });
  }

  setCutStart = () => {
    this.setState(({ currentTime }) => ({ cutStartTime: currentTime }));
  }

  setCutEnd = () => {
    this.setState(({ currentTime }) => ({ cutEndTime: currentTime }));
  }

  setOutputDir = () => {
    dialog.showOpenDialog({ properties: ['openDirectory'] }, (paths) => {
      this.setState({ customOutDir: (paths && paths.length === 1) ? paths[0] : undefined });
    });
  }

  getFileUri() {
    const { html5FriendlyPath, filePath } = this.state;
    return (html5FriendlyPath || filePath || '').replace(/#/g, '%23');
  }

  getOutputDir() {
    const { customOutDir, filePath } = this.state;
    if (customOutDir) return customOutDir;
    if (filePath) return path.dirname(filePath);
    return undefined;
  }

  getRotation() {
    return this.state.rotation;
  }

  getRotationStr() {
    return `${this.getRotation()}°`;
  }

  getApparentCutStartTime() {
    if (this.state.cutStartTime !== undefined) return this.state.cutStartTime;
    return 0;
  }

  getApparentCutEndTime() {
    if (this.state.cutEndTime !== undefined) return this.state.cutEndTime;
    if (this.state.duration !== undefined) return this.state.duration;
    return 0; // Haven't gotten duration yet
  }

  getOffsetCurrentTime() {
    return (this.state.currentTime || 0) + this.state.startTimeOffset;
  }

  increaseRotation = () => {
    this.setState(({ rotation }) => ({ rotation: (rotation + 90) % 450 }));
  }

  toggleCaptureFormat = () => {
    const isPng = this.state.captureFormat === 'png';
    this.setState({ captureFormat: isPng ? 'jpeg' : 'png' });
  }

  toggleIncludeAllStreams = () => {
    this.setState(({ includeAllStreams }) => ({ includeAllStreams: !includeAllStreams }));
  }

  toggleStripAudio = () => this.setState(({ stripAudio }) => ({ stripAudio: !stripAudio }));

  toggleKeyframeCut = () => this.setState(({ keyframeCut }) => ({ keyframeCut: !keyframeCut }));

  jumpCutStart = () => {
    seekAbs(this.getApparentCutStartTime());
  }

  jumpCutEnd = () => {
    seekAbs(this.getApparentCutEndTime());
  }

  /* eslint-disable react/sort-comp */
  handleTap = throttle((e) => {
    const $target = $('.timeline-wrapper');
    const parentOffset = $target.offset();
    const relX = e.srcEvent.pageX - parentOffset.left;
    setCursor((relX / $target[0].offsetWidth) * (this.state.duration || 0));
  }, 200);
  /* eslint-enable react/sort-comp */

  playbackRateChange = () => {
    this.state.playbackRate = getVideo().playbackRate;
  }

  playCommand = () => {
    const video = getVideo();
    if (this.state.playing) return video.pause();

    return video.play().catch((err) => {
      console.log(err);
      if (err.name === 'NotSupportedError') {
        toast.fire({ type: 'error', title: 'This format/codec is not supported. Try to convert it to a friendly format/codec in the player from the "File" menu. Note that this will only create a temporary, low quality encoded file used for previewing your cuts, and will not affect the final cut. The final cut will still be lossless. Audio is also removed to make it faster, but only in the preview.', timer: 10000 });
      }
    });
  }

  deleteSourceClick = async () => {
    // eslint-disable-next-line no-alert
    if (this.state.working || !window.confirm('Are you sure you want to move the source file to trash?')) return;
    const { filePath } = this.state;

    this.setState({ working: true });
    await trash(filePath);
    this.resetState();
  }

  cutClick = async () => {
    if (this.state.working) {
      errorToast('I\'m busy');
      return;
    }

    const {
      cutEndTime, cutStartTime, filePath, customOutDir, fileFormat, duration, includeAllStreams,
      stripAudio, keyframeCut,
    } = this.state;

    const rotation = this.isRotationSet() ? this.getRotation() : undefined;

    if (!(this.isCutRangeValid() || cutEndTime === undefined || cutStartTime === undefined)) {
      errorToast('Start time must be before end time');
      return;
    }

    this.setState({ working: true });
    try {
      await ffmpeg.cut({
        customOutDir,
        filePath,
        format: fileFormat,
        cutFrom: this.getApparentCutStartTime(),
        cutTo: cutEndTime,
        cutToApparent: this.getApparentCutEndTime(),
        videoDuration: duration,
        rotation,
        includeAllStreams,
        stripAudio,
        keyframeCut,
        onProgress: this.onCutProgress,
      });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.code === 1 || err.code === 'ENOENT') {
        errorToast('Whoops! ffmpeg was unable to cut this video. It may be of an unknown format or codec combination');
        return;
      }
      showFfmpegFail(err);
    } finally {
      this.setState({ working: false });
    }
  }

  capture = async () => {
    const {
      filePath, customOutDir: outputDir, currentTime, captureFormat,
    } = this.state;
    if (!filePath) return;
    try {
      await captureFrame(outputDir, filePath, getVideo(), currentTime, captureFormat);
    } catch (err) {
      console.error(err);
      errorToast('Failed to capture frame');
    }
  }

  changePlaybackRate(dir) {
    const video = getVideo();
    if (!this.state.playing) {
      video.playbackRate = 0.5; // dir * 0.5;
      video.play();
    } else {
      const newRate = video.playbackRate + (dir * 0.15);
      video.playbackRate = clamp(newRate, 0.05, 16);
    }
  }

  resetState() {
    const video = getVideo();
    video.currentTime = 0;
    video.playbackRate = 1;
    this.setState(localState);
    setFileNameTitle();
  }

  isRotationSet() {
    // 360 means we don't modify rotation
    return this.state.rotation !== 360;
  }

  isCutRangeValid() {
    return this.getApparentCutStartTime() < this.getApparentCutEndTime();
  }

  toggleHelp() {
    this.setState(({ helpVisible }) => ({ helpVisible: !helpVisible }));
  }

  renderCutTimeInput(type) {
    const cutTimeManualKey = type === 'start' ? 'cutStartTimeManual' : 'cutEndTimeManual';
    const cutTimeInputStyle = { width: '8em', textAlign: type === 'start' ? 'right' : 'left' };

    const isCutTimeManualSet = () => this.state[cutTimeManualKey] !== undefined;

    const handleCutTimeInput = (text) => {
      // Allow the user to erase
      if (text.length === 0) {
        this.setState({ [cutTimeManualKey]: undefined });
        return;
      }

      const time = parseDuration(text);
      if (time === undefined) {
        this.setState({ [cutTimeManualKey]: text });
        return;
      }

      const cutTimeKey = type === 'start' ? 'cutStartTime' : 'cutEndTime';
      this.setState(state => ({
        [cutTimeManualKey]: undefined,
        [cutTimeKey]: time - state.startTimeOffset,
      }));
    };

    const cutTime = type === 'start' ? this.getApparentCutStartTime() : this.getApparentCutEndTime();

    return (
      <input
        style={{ ...cutTimeInputStyle, color: isCutTimeManualSet() ? '#dc1d1d' : undefined }}
        type="text"
        onChange={e => handleCutTimeInput(e.target.value)}
        value={isCutTimeManualSet()
          ? this.state[cutTimeManualKey]
          : formatDuration(cutTime + this.state.startTimeOffset)
        }
      />
    );
  }

  render() {
    const jumpCutButtonStyle = {
      position: 'absolute', color: 'black', bottom: 0, top: 0, padding: '2px 8px',
    };
    const infoSpanStyle = {
      background: 'rgba(255, 255, 255, 0.4)', padding: '.1em .4em', margin: '0 3px', fontSize: 13, borderRadius: '.3em',
    };

    const {
      working, filePath, duration: durationRaw, cutProgress, currentTime, playing,
      fileFormat, playbackRate, keyframeCut, includeAllStreams, stripAudio, captureFormat,
      helpVisible, cutStartTime, cutEndTime,
    } = this.state;

    const markerWidth = 4;
    const apparentCutStart = this.getApparentCutStartTime();
    const apprentCutEnd = this.getApparentCutEndTime();
    const duration = durationRaw || 1;
    const currentTimePos = currentTime !== undefined && `${(currentTime / duration) * 100}%`;
    const cutSectionWidth = `calc(${((apprentCutEnd - apparentCutStart) / duration) * 100}% - ${markerWidth * 2}px)`;

    const isCutRangeValid = this.isCutRangeValid();

    const startTimePos = `${(apparentCutStart / duration) * 100}%`;
    const endTimePos = `${(apprentCutEnd / duration) * 100}%`;
    const markerBorder = '2px solid rgb(0, 255, 149)';
    const markerBorderRadius = 5;

    const startMarkerStyle = {
      width: markerWidth,
      left: startTimePos,
      borderLeft: markerBorder,
      borderTopLeftRadius: markerBorderRadius,
      borderBottomLeftRadius: markerBorderRadius,
    };
    const endMarkerStyle = {
      width: markerWidth,
      marginLeft: -markerWidth,
      left: endTimePos,
      borderRight: markerBorder,
      borderTopRightRadius: markerBorderRadius,
      borderBottomRightRadius: markerBorderRadius,
    };

    return (
      <div>
        {!filePath && (
          <div id="drag-drop-field">
            <div style={{ fontSize: '9vw' }}>DROP VIDEO</div>
            <div>PRESS H FOR HELP</div>
          </div>
        )}
        {working && (
        <div style={{
          color: 'white', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '.5em', margin: '1em', padding: '.2em .5em', position: 'absolute', zIndex: 1, top: 0, left: 0,
        }}
        >
          <i className="fa fa-cog fa-spin fa-3x fa-fw" style={{ verticalAlign: 'middle', width: '1em', height: '1em' }} />
          {cutProgress != null && (
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', paddingLeft: '.4em' }}>
              {`${Math.floor(cutProgress * 100)} %`}
            </span>
          )}
        </div>
        )}

        {/* eslint-disable jsx-a11y/media-has-caption */}
        <div id="player">
          <video
            src={this.getFileUri()}
            onRateChange={this.playbackRateChange}
            onPlay={() => this.onPlay(true)}
            onPause={() => this.onPlay(false)}
            onDurationChange={e => this.onDurationChange(e.target.duration)}
            onTimeUpdate={e => this.setState({ currentTime: e.target.currentTime })}
          />
        </div>
        {/* eslint-enable jsx-a11y/media-has-caption */}

        <div className="controls-wrapper">
          <Hammer
            onTap={this.handleTap}
            onPan={this.handleTap}
            options={{ recognizers: {} }}
          >
            <div className="timeline-wrapper">
              {currentTimePos !== undefined && <div className="current-time" style={{ left: currentTimePos }} />}

              {cutStartTime !== undefined && <div style={startMarkerStyle} className="cut-time-marker" />}
              {isCutRangeValid && (cutStartTime !== undefined || cutEndTime !== undefined) && (
                <div
                  className="cut-section"
                  style={{
                    marginLeft: markerWidth,
                    left: startTimePos,
                    width: cutSectionWidth,
                  }}
                />
              )}
              {cutEndTime !== undefined && <div style={endMarkerStyle} className="cut-time-marker" />}

              <div id="current-time-display">{formatDuration(this.getOffsetCurrentTime())}</div>
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
                onClick={withBlur(this.jumpCutStart)}
              />
            </div>

            <i
              className="button fa fa-caret-left"
              aria-hidden="true"
              onClick={() => shortStep(-1)}
            />
            <i
              className={classnames({
                button: true, fa: true, 'fa-pause': playing, 'fa-play': !playing,
              })}
              aria-hidden="true"
              onClick={this.playCommand}
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
                onClick={withBlur(this.jumpCutEnd)}
              />
            </div>

            <i
              className="button fa fa-step-forward"
              aria-hidden="true"
              title="Jump to end of video"
              onClick={() => seekAbs(duration)}
            />
          </div>

          <div>
            <i
              title="Set cut start to current position"
              className="button fa fa-angle-left"
              aria-hidden="true"
              onClick={this.setCutStart}
            />
            <i
              title="Cut"
              className="button fa fa-scissors"
              aria-hidden="true"
              onClick={this.cutClick}
            />
            <i
              title="Delete source file"
              className="button fa fa-trash"
              aria-hidden="true"
              onClick={this.deleteSourceClick}
            />
            <i
              title="Set cut end to current position"
              className="button fa fa-angle-right"
              aria-hidden="true"
              onClick={this.setCutEnd}
            />
          </div>
        </div>

        <div className="left-menu">
          <span style={infoSpanStyle} title="Format of current file">
            {fileFormat || 'FMT'}
          </span>

          <span style={infoSpanStyle} title="Playback rate">
            {round(playbackRate, 1) || 1}
          </span>
        </div>

        <div className="right-menu">
          <button
            type="button"
            title={`Cut mode ${keyframeCut ? 'nearest keyframe cut' : 'normal cut'}`}
            onClick={withBlur(this.toggleKeyframeCut)}
          >
            {keyframeCut ? 'kc' : 'nc'}
          </button>

          <button
            type="button"
            title={`Set output streams. Current: ${includeAllStreams ? 'include (and cut) all streams' : 'include only primary streams'}`}
            onClick={withBlur(this.toggleIncludeAllStreams)}
          >
            {includeAllStreams ? 'all' : 'ps'}
          </button>

          <button
            type="button"
            title={`Delete audio? Current: ${stripAudio ? 'delete audio tracks' : 'keep audio tracks'}`}
            onClick={withBlur(this.toggleStripAudio)}
          >
            {stripAudio ? 'da' : 'ka'}
          </button>

          <button
            type="button"
            title={`Set output rotation. Current: ${this.isRotationSet() ? this.getRotationStr() : 'Don\'t modify'}`}
            onClick={withBlur(this.increaseRotation)}
          >
            {this.isRotationSet() ? this.getRotationStr() : '-°'}
          </button>

          <button
            type="button"
            title={`Custom output dir (cancel to restore default). Current: ${this.getOutputDir() || 'Not set (use input dir)'}`}
            onClick={withBlur(this.setOutputDir)}
          >
            {this.getOutputDir() ? 'cd' : 'id'}
          </button>

          <i
            title="Capture frame"
            style={{ margin: '-.4em -.2em' }}
            className="button fa fa-camera"
            aria-hidden="true"
            onClick={this.capture}
          />

          <button
            type="button"
            title="Capture frame format"
            onClick={withBlur(this.toggleCaptureFormat)}
          >
            {captureFormat}
          </button>
        </div>

        <HelpSheet visible={!!helpVisible} />
      </div>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('app'));

console.log('Version', electron.remote.app.getVersion());
