// The homepage content. Rendered to static HTML at build time (no client-side JavaScript, except a small script for the feature icon
// animation in index.astro).
import type { CSSProperties, ReactNode } from 'react';
import type { IconNode } from 'lucide';
import { Combine, Film, Layers, ListOrdered, RefreshCw, ScanSearch, Scissors, SquarePen, Terminal } from 'lucide';
import type { IconNode as ReactIconNode } from 'lucide-react';
import { CodeXml, Icon, Languages, Monitor, Pause, Play, Star } from 'lucide-react';

import macAppStoreBadge from '../../../mac-app-store-badge.svg?url';
import msStoreBadge from '../../../ms-store-badge.svg?url';
import snapStoreBadge from '../../../snap-store-black.svg?url';
import logo from '../../../src/renderer/src/icon.svg?url';
import background1 from '../assets/home/background.jpg?url';
import background2 from '../assets/home/background2.jpg?url';
import mainScreenshot from '../assets/home/main-screenshot.jpg?url';
import original from '../assets/home/original.jpg?url';
import reencoded from '../assets/home/reencoded.jpg?url';
import tracksScreenshot from '../assets/home/tracks-screenshot.jpg?url';

import { authorUrl, donateUrl, githubUrl, socialLinks, storeUrls, supportEmail } from '../links.ts';
import socialIconPaths from './socialIcons.ts';

// An optional short, silent screen recording for the hero (src/assets/home/hero.mp4, 1024×640, looping), shown in a window
// frame instead of the screenshot, with a still of its first frame as the poster (src/assets/home/hero-poster.jpg)
const heroVideo = Object.values(import.meta.glob<string>('../assets/home/hero.mp4', { eager: true, query: '?url', import: 'default' }))[0];
const heroPoster = Object.values(import.meta.glob<string>('../assets/home/hero-poster.jpg', { eager: true, query: '?url', import: 'default' }))[0] ?? mainScreenshot;

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

// A screenshot over a full-width background image.
function ScreenshotSection({ background, screenshot, alt, width, borderRadius, subtitle }: { background: string, screenshot: string, alt: string, width: number, borderRadius: number, subtitle: string }) {
  return (
    <div className="background" style={{ backgroundImage: `url(${background})` }}>
      <div className="padded">
        <img loading="lazy" src={screenshot} alt={alt} className="screenshot" style={{ width, borderRadius }} />
      </div>
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
export default function Home({ stars }: { stars: number }) {
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
            {heroVideo != null ? (
              <div className="hero-video">
                <div className="hero-video-title">
                  <span className="hero-video-dots" aria-hidden="true"><i /><i /><i /></span>
                  LosslessCut
                  {/* a looping video must be pausable (WCAG 2.2.2). Shown by the script in index.astro */}
                  <button type="button" className="hero-video-pause" aria-label="Pause the video" hidden>
                    <Pause className="pause" aria-hidden size={14} />
                    <Play className="play" aria-hidden size={14} />
                  </button>
                </div>
                {/* with prefers-reduced-motion, the poster is shown instead (home.css), and the script stops the video */}
                <video src={heroVideo} poster={heroPoster} autoPlay muted loop playsInline preload="metadata" width={1024} height={640} aria-label="LosslessCut cutting a video into segments" />
                <img className="hero-video-poster" src={heroPoster} alt="LosslessCut with a video cut into segments" width={1024} height={640} />
              </div>
            ) : (
              <img src={mainScreenshot} alt="LosslessCut main window" width={1000} height={624} fetchPriority="high" />
            )}
          </div>
        </div>
      </header>

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
          <img loading="lazy" src={reencoded} alt="Generational compression artifacts from re-encoding" className="comparison-image" />

          <p>
            Any operation in a <b className="key-point">normal video editor</b><br />
            requires you to <b className="key-point">re-encode</b> the whole file<br />
            which can <b className="key-point">take hours</b> and you will<br />
            gradually <a href="https://en.wikipedia.org/wiki/Generation_loss"><b className="key-point">lose quality</b></a> every time a file is processed.<br />
          </p>
        </div>

        <div className="comparison" style={{ maxWidth: '800px' }}>
          <h2 style={{ marginTop: '40px', marginBottom: '20px' }}><a style={{ color: 'inherit', textDecoration: 'none' }} href="/">LosslessCut<span style={{ opacity: '0.6' }}>.app</span></a></h2>
          <img loading="lazy" alt="The original, without generational compression artifacts" src={original} className="comparison-image" />
          <p>
            LosslessCut will do the same <b className="key-point">in seconds</b> without losing quality
          </p>

          <p>LosslessCut simply cuts the data stream and directly copies it over. </p>
        </div>
      </WhiteSection>

      <ScreenshotSection
        background={background2}
        screenshot={tracksScreenshot}
        alt="Screenshot showing the tracks screen"
        width={400}
        borderRadius={5}
        subtitle="Built in track info and selection"
      />

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

      <div className="padded" style={{ padding: '110px 30px 80px 30px' }}>
        <iframe style={{ width: '480px', height: '450px', maxWidth: '100%', border: '0' }} src="https://www.youtube-nocookie.com/embed/GPHMN9Vp4CQ?disablekb=1&amp;playsinline=1&amp;rel=0&amp;playlist=GPHMN9Vp4CQ&amp;loop=1&amp;version=3" allowFullScreen title="LosslessCut demo video" />

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

          <p className="official-sources">
            ⚠️ Beware of unofficial websites and app distributors. The only official sources of LosslessCut are this website, <a href={githubUrl}>GitHub</a> and the app stores above.
          </p>
        </div>
      </div>

      <div className="faq">
        <h2>FAQ</h2>
        <p style={{ marginBottom: '0' }}>
          Why is it not free on the App Stores but free on GitHub?
        </p>
        <p className="faq-answer">
          I initially only released LosslessCut as a direct download from GitHub, as an unsigned/untrusted exe/binary file download. People were complaining that it&apos;s hard to download/install the unsigned exe file, as they need to go through these dialogs saying that this file is a threat to your computer, and anti-virus complaining about executables downloaded from the internet. Some wanted a way to automatically update the app when new versions are out. This can both be achieved by downloading through the MS and Apple App Store. Microsoft charges money for signing binaries and a yearly fee for publishing to the Microsoft Store. Therefore I decided I can sell it in the MS Store for those who want to support my continued work and want to have the benefits it gives, while at the same time providing more experimental unsigned downloads as usual. Of course anyone is also free to build LosslessCut from source code.
        </p>

        <a className="more-faq" href="/docs#faq">More FAQ...</a>
      </div>

      <div style={{ minHeight: '200px' }}>
        <div className="footer">
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
        </div>
      </div>
    </div>
  );
}
