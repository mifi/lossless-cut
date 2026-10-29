// The homepage content. Rendered to static HTML at build time (no client-side JavaScript, except a small script in index.astro for
// the hero video's pause button and the feature icon animation).
import type { CSSProperties, ReactNode } from 'react';
import { Fragment } from 'react';
import type { IconNode } from 'lucide';
import { Combine, Film, Layers, ListOrdered, RefreshCw, ScanSearch, Scissors, SquarePen, Terminal } from 'lucide';
import type { IconNode as ReactIconNode } from 'lucide-react';
import { CodeXml, Icon, Languages, Monitor, Pause, Play, Star } from 'lucide-react';

import macAppStoreBadge from '../../../mac-app-store-badge.svg?url';
import msStoreBadge from '../../../ms-store-badge.svg?url';
import snapStoreBadge from '../../../snap-store-black.svg?url';
import logo from '../../../src/renderer/src/icon.svg?url';

import type { Video } from '../images.ts';
import { background1, background2, generationLossOriginal, generationLossReencoded, heroVideo, sceneChangesVideo, tracksVideo } from '../images.ts';
import type { Release } from '../latestRelease.ts';
import { authorUrl, donateUrl, githubUrl, socialLinks, storeUrls, supportEmail } from '../links.ts';
import socialIconPaths from './socialIcons.ts';

const quotes = [
  'I\'ve been looking a long time for a program like LosslessCut',
  'You just saved my butt and kept me from missing a pretty important deadline over a stupid mistake. THANK YOU.',
  'Before using this I had just spent 45 minutes exporting 1.5 seconds of video using my usual video editor, this did the whole thing in less than a second.',
  'I use your program LosslessCut frequently and am amazed by how fast and simple it works, especially that everything really works without loss.',
  'Thanks for your work on LosslessCut. I have years of personal video to cut through, and this is going to be a huge timesaver.',
  'Great work! LosslessCut saves me a lot of time due to usability and good performance.',
  'LosslessCut saved my day from endless FFmpeg trim commands, thank you and keep up the good work!',
  'In Chinese, the word "Lossless" (pronounced like "Lao-Si-Le-Si") sounds incredibly similar to the luxury car brand "Rolls-Royce" ("Lao-Si-Lai-Si"). I think this is a beautiful coincidence because this software truly is the Rolls-Royce of the video-cutting world — smooth, premium, pure, and absolutely perfect.',
];

// Highlights only, the full list is docs/features.md (https://losslesscut.app/docs/features). Keep in sync with the README's.
const features: { text: string, icon: IconNode }[] = [
  { text: 'Cut and trim video and audio losslessly, in seconds', icon: Scissors },
  { text: 'Merge cut segments, or whole files with identical codecs, losslessly', icon: Combine },
  { text: 'Add, remove, replace or extract tracks: audio, subtitles and more', icon: Layers },
  { text: 'Change the format (remux), for example from MKV to MP4, without re-encoding', icon: RefreshCw },
  { text: 'Segments, markers and tags, with import/export of chapters, CSV, EDL and more', icon: ListOrdered },
  { text: 'Detect scenes, black frames and silence, and split by them', icon: ScanSearch },
  { text: 'Edit metadata and rotation, and create chapters', icon: SquarePen },
  { text: "Opens almost any format, even ones your player can't play", icon: Film },
  { text: 'Snapshots and frame export, keyboard shortcuts, a CLI and an HTTP API', icon: Terminal },
];

// Each line with pathLength 1, so the CSS can draw every line of the icon in the same time (see .feature-icon in home.css).
// The icons are from lucide (the same icons as lucide-react, as data) for that.
const drawableIcon = (icon: IconNode): ReactIconNode => icon.map(([tag, attrs], i) => [tag, { ...attrs, pathLength: 1, key: i }]);

// a few common ones, the full list is in docs/features.md
const usageScenarios = [
  'Cut out commercials from a recorded TV show (and change it from TS to MP4)',
  'Extract the music track from a video and cut it to your needs',
  'Add music to a video, or replace its audio track',
  'Join clips from the same camera or phone into one file',
  'Cut a file by its MP4/MKV chapters',
];

// as in docs/requirements.md
const supportedOs = 'Windows 10 and 11, macOS 12 or newer, Linux';

// A few from docs/faq.md, shortened
const faqs: { question: string, answer: ReactNode }[] = [
  {
    question: 'Why is it not free on the App Stores but free on GitHub?',
    answer: 'I initially only released LosslessCut as a direct download from GitHub, as an unsigned/untrusted exe/binary file download. People were complaining that it\'s hard to download/install the unsigned exe file, as they need to go through these dialogs saying that this file is a threat to your computer, and anti-virus complaining about executables downloaded from the internet. Some wanted a way to automatically update the app when new versions are out. This can both be achieved by downloading through the MS and Apple App Store. Microsoft charges money for signing binaries and a yearly fee for publishing to the Microsoft Store. Therefore I decided I can sell it in the MS Store for those who want to support my continued work and want to have the benefits it gives, while at the same time providing more experimental unsigned downloads as usual. Of course anyone is also free to build LosslessCut from source code.',
  },
  {
    question: 'Is LosslessCut safe?',
    answer: <>Yes, if you get it from this website, GitHub or the app stores. It&apos;s open source, and it has no ads or tracking (see the <a href="/privacy-policy">privacy policy</a>).</>,
  },
  {
    question: 'Which operating systems does it run on?',
    answer: <>{supportedOs}. See <a href="/docs/requirements">supported OS versions</a>.</>,
  },
];

const storeBadges = [
  { href: storeUrls.mac, image: macAppStoreBadge, alt: 'LosslessCut on the Mac App Store', rounded: false },
  { href: storeUrls.microsoft, image: msStoreBadge, alt: 'LosslessCut on the Microsoft Store', rounded: true },
  { href: storeUrls.snap, image: snapStoreBadge, alt: 'LosslessCut on Snapcraft', rounded: true },
];

const footerLinks = [
  { label: 'How to use', href: '/docs' },
  { label: 'Troubleshooting', href: '/docs/troubleshooting' },
  { label: 'Contact me', href: `mailto:${supportEmail}` },
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Source code', href: githubUrl },
  { label: 'More apps by mifi ❤️', href: authorUrl },
];

// A video (or screenshot) over a full-width background image.
function MediaSection({ background, subtitle, children }: { background: string, subtitle: string, children: ReactNode }) {
  return (
    <div className="background" style={{ backgroundImage: `url(${background})` }}>
      <div className="padded">{children}</div>
      <div className="image-subtitle">{subtitle}</div>
    </div>
  );
}

function WhiteSection({ children }: { children: ReactNode }) {
  return <section className="white-section">{children}</section>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

// On phones, shows only the first collapsedHeight px of children (a single element), fading out, until the "label" button is
// clicked (it then says "Show less"). CSS only (a <details> and :has(), see .collapsible in home.css): wider screens and browsers
// without :has() show everything.
function Collapsible({ label, collapsedHeight, children }: { label: string, collapsedHeight: number, children: ReactNode }) {
  return (
    <div className="collapsible" style={{ '--collapsed-height': `${collapsedHeight}px` } as CSSProperties}>
      {children}
      <details className="collapsible-more">
        <summary className="button"><span className="collapsible-show">{label}</span><span className="collapsible-hide">Show less</span></summary>
      </details>
    </div>
  );
}

// A silent, looping screen recording (see images.ts) in a plain window frame (not macOS-like, since the app also runs on Windows
// and Linux), or without the title bar for a crop of a panel. The script in index.astro shows its pause button (a looping video
// must be pausable, WCAG 2.2.2), and plays it while it's on screen. With prefers-reduced-motion, only its poster is shown (home.css).
function FramedVideo({ video, label, posterAlt, priority, titleBar = true }: { video: Video, label: string, posterAlt: string, priority?: boolean, titleBar?: boolean }) {
  const pauseButton = (
    <button type="button" className="framed-video-pause" aria-label="Pause the video" hidden>
      <Pause className="pause" aria-hidden size={14} />
      <Play className="play" aria-hidden size={14} />
    </button>
  );
  return (
    <div className={titleBar ? 'framed-video' : 'framed-video no-title-bar'} style={{ '--aspect-ratio': `${video.width} / ${video.height}` } as CSSProperties}>
      {titleBar ? (
        <div className="framed-video-title">
          <span className="framed-video-dots" aria-hidden="true"><i /><i /><i /></span>
          LosslessCut
          {pauseButton}
        </div>
      ) : pauseButton}
      {/* priority (the hero): starts playing right away, otherwise only when scrolled to */}
      <video poster={video.poster} autoPlay={priority} muted loop playsInline preload={priority ? 'metadata' : 'none'} width={video.width} height={video.height} aria-label={label}>
        {/* with reduced motion, neither matches, so nothing is downloaded. Browsers that ignore media (before Chrome/Firefox
        120) take the first one, and the script removes them with reduced motion */}
        <source src={video.src} type="video/mp4" media="(min-width: 701px) and (prefers-reduced-motion: no-preference)" />
        <source src={video.smallSrc} type="video/mp4" media="(prefers-reduced-motion: no-preference)" />
      </video>
      <img className="framed-video-poster" src={video.poster} alt={posterAlt} width={video.width} height={video.height} fetchPriority={priority ? 'high' : undefined} loading={priority ? undefined : 'lazy'} />
    </div>
  );
}

function FooterLink({ href, children }: { href: string, children: ReactNode }) {
  return <><a className="footer-link" href={href}>{children}</a>{' '}</>;
}

function StoreBadges({ height }: { height: number }) {
  return (
    <div className="store-badges">
      {storeBadges.map(({ href, image, alt, rounded }) => (
        // the Microsoft and Snap badges are square images, rounded here like Apple's (whose corners are about 24% of its height)
        <a key={href} className={rounded ? 'app-store rounded' : 'app-store'} style={{ borderRadius: rounded ? `${Math.round(height * 0.24)}px` : undefined }} href={href}><img src={image} alt={alt} height={height} /></a>
      ))}
    </div>
  );
}

const formatStars = (stars: number) => (stars >= 1000 ? `${Math.floor(stars / 1000)}k+` : String(stars));

// stars: the GitHub star count, fetched at build time by index.astro (see githubStars.ts)
export default function Home({ stars, release }: { stars: number, release: Release | undefined }) {
  return (
    <div className="page">
      <header className="hero" style={{ backgroundImage: `linear-gradient(160deg, rgba(11, 52, 56, 0.93), rgba(40, 40, 40, 0.96) 65%), url(${background1})` }}>
        <nav className="top-nav">
          <a href="/docs">Docs</a>
          <a href={githubUrl}>GitHub</a>
        </nav>

        <div className="hero-content">
          <div className="hero-text">
            <h1>LosslessCut</h1>
            <div className="tagline">The Swiss Army Knife of Lossless Video/Audio Editing</div>
            <div className="hero-subtitle">Shave gigabytes off video and audio files in seconds without loss of quality</div>
            <div className="hero-buttons">
              <a className="button" href="#download">Download</a>
              <a className="button secondary" href="/docs">Documentation</a>
            </div>
            <StoreBadges height={40} />
            <ul className="proof">
              <li><Star aria-hidden size={16} className="star" /> {formatStars(stars)} stars on <a href={githubUrl}>GitHub</a></li>
              <li><CodeXml aria-hidden size={16} /> Free and open source</li>
              <li><Monitor aria-hidden size={16} /> Windows, macOS, Linux</li>
              {/* the number of langNames in src/common/i18n.ts, also in docs/features.md */}
              <li><Languages aria-hidden size={16} /> 26 languages</li>
            </ul>
            <div className="hero-author">Official app by <a href={authorUrl}>Mikael Finstad</a></div>
          </div>

          <div className="hero-media">
            <FramedVideo video={heroVideo} label="LosslessCut cutting a video into three segments" posterAlt="LosslessCut with a video opened" priority />
          </div>
        </div>
      </header>

      <main>
        <section className="quotes">
          <h2>Thousands of happy users</h2>
          <Collapsible label="Show all reviews" collapsedHeight={480}>
            <div className="quote-grid">
              {quotes.map((quote) => <blockquote key={quote} className="quote-card">{quote}</blockquote>)}
            </div>
          </Collapsible>
        </section>

        <WhiteSection>
          <div className="comparison" style={{ maxWidth: '700px' }}>
            <h2 style={{ margin: '20px 0' }}>Traditional video editors</h2>
            <img loading="lazy" src={generationLossReencoded.src} srcSet={generationLossReencoded.srcSet} alt="Generational compression artifacts from re-encoding" className="comparison-image" />

            <p>
              Any operation in a <b className="key-point">normal video editor</b><br />
              requires you to <b className="key-point">re-encode</b> the whole file<br />
              which can <b className="key-point">take hours</b> and you will<br />
              gradually <a href="https://en.wikipedia.org/wiki/Generation_loss"><b className="key-point">lose quality</b></a> every time a file is processed.<br />
            </p>
          </div>

          <div className="comparison" style={{ maxWidth: '800px' }}>
            <h2 style={{ marginTop: '40px', marginBottom: '20px' }}><a style={{ color: 'inherit', textDecoration: 'none' }} href="/">LosslessCut<span style={{ opacity: '0.6' }}>.app</span></a></h2>
            <img loading="lazy" alt="The original, without generational compression artifacts" src={generationLossOriginal.src} srcSet={generationLossOriginal.srcSet} className="comparison-image" />
            <p>
              LosslessCut will do the same <b className="key-point">in seconds</b> without losing quality
            </p>

            <p>LosslessCut simply cuts the data stream and directly copies it over. </p>
          </div>
        </WhiteSection>

        <MediaSection background={background2} subtitle="Built in track info and selection">
          <div className="tracks-video">
            <FramedVideo video={tracksVideo} titleBar={false} label="LosslessCut's Tracks panel, switching off tracks one by one" posterAlt="LosslessCut's Tracks panel: choose which video, audio and subtitle tracks to keep when exporting" />
            <p className="demo-video-credit">
              Tears of Steel (CC) Blender Foundation | <a href="https://mango.blender.org/">mango.blender.org</a>
            </p>
          </div>
        </MediaSection>
        <WhiteSection>
          <h2 style={{ margin: '20px 0' }}>Features</h2>

          <div className="feature-grid">
            {features.map(({ text, icon }) => (
              <div key={text} className="feature-card">
                <span className="feature-icon"><Icon iconNode={drawableIcon(icon)} aria-hidden size={24} strokeWidth={1.9} /></span>
                <div>{text}</div>
              </div>
            ))}
          </div>

          <h2 style={{ margin: '20px 0' }}>Example use cases</h2>

          <div className="list">
            <List items={usageScenarios} />

            <p className="note">
              Which functions are available depends on the file and its format and codecs. Lossless cuts can only start at a keyframe, so a cut starts at the keyframe before your cut point, a fraction of a second up to several seconds earlier depending on the encoding.
            </p>
          </div>

          <a className="button" href="/docs/features">See all features and use cases</a>
        </WhiteSection>

        <div className="padded demo-video">
          <FramedVideo video={sceneChangesVideo} label="LosslessCut detecting the scene changes of a movie and creating a segment for each scene" posterAlt="A movie in LosslessCut, with a segment for each scene" />
          <p className="demo-video-credit">
            Tears of Steel (CC) Blender Foundation | <a href="https://mango.blender.org/">mango.blender.org</a>
          </p>

          <h2 style={{ textAlign: 'center', marginTop: '40px', fontWeight: '200' }}>Lightning Fast! It&apos;s like Magic</h2>
        </div>

        <div id="download" className="download">
          <div className="download-inner">
            <img src={logo} alt="LosslessCut logo" style={{ width: '100px', marginBottom: '10px' }} />
            <p style={{ textAlign: 'left', margin: '30px 30px' }}>
              I believe software should be <b>available to everyone</b>, and LosslessCut will <a href={githubUrl}>always be free</a> for anyone to use and look at the code.<br /><br />
              If LosslessCut brings you value, please consider supporting my continued work by purchasing it from your favorite store, or <a href={donateUrl}>support me by donating.</a>
            </p>

            <StoreBadges height={50} />

            <ul className="download-facts">
              {release && <li>Latest version {release.version} ({release.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })})</li>}
              <li><a href="/docs/requirements">{supportedOs}</a></li>
              <li><a href="/docs/faq#is-losslesscut-safe">Is it safe?</a></li>
            </ul>

            <p className="official-sources">
              ⚠️ Beware of unofficial websites and app distributors. The only official sources of LosslessCut are this website, <a href={githubUrl}>GitHub</a> and the app stores above.
            </p>
          </div>
        </div>

        <div className="faq">
          <h2>FAQ</h2>
          {faqs.map(({ question, answer }) => (
            <Fragment key={question}>
              <p className="faq-question">{question}</p>
              <p className="faq-answer">{answer}</p>
            </Fragment>
          ))}

          <a className="more-faq" href="/docs/faq">More FAQ...</a>
        </div>
      </main>

      <div style={{ minHeight: '200px' }}>
        <footer className="footer">
          <div>
            {footerLinks.map(({ label, href }) => <FooterLink key={label} href={href}>{label}</FooterLink>)}
          </div>

          <div className="social-links">
            {socialLinks.map(({ label, href, icon }) => (
              // rel=me: see links.ts
              // eslint-disable-next-line react/no-invalid-html-attribute
              <a key={label} href={href} rel={label === 'Mastodon' ? 'me' : undefined} title={label} aria-label={label}>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="currentColor">
                  {socialIconPaths[icon].map((d) => <path key={d} d={d} />)}
                </svg>
              </a>
            ))}
          </div>

          <div className="footer-secondary" style={{ marginTop: '20px' }}>{new Date().getFullYear()} © Mikael Finstad</div>
        </footer>
      </div>
    </div>
  );
}
