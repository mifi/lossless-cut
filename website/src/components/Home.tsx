// The homepage content. Rendered to static HTML at build time (no client-side JavaScript).
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AudioWaveform, Camera, Clock, CodeXml, Combine, Layers, ListOrdered, Monitor, PackageOpen, RefreshCw, RotateCw, Save, Scissors, Star, Tag, Terminal, ZoomIn } from 'lucide-react';

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

// An optional short, silent screen recording for the hero (src/assets/home/demo.mp4 and/or demo.webm), shown instead of the screenshot
const demoClips = import.meta.glob<string>('../assets/home/demo.{webm,mp4}', { eager: true, query: '?url', import: 'default' });
const demoSources = Object.entries(demoClips).toSorted(([a], [b]) => (a.endsWith('.webm') ? -1 : 1) - (b.endsWith('.webm') ? -1 : 1))
  .map(([path, url]) => ({ url, type: path.endsWith('.webm') ? 'video/webm' : 'video/mp4' }));

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

const features: { text: string, Icon: LucideIcon }[] = [
  { text: 'Losslessly trim or cut out parts of video/audio', Icon: Scissors },
  { text: 'Lossless merge/concatenation of arbitrary files (identical codec parameters)', Icon: Combine },
  { text: 'Lossless stream editing: Combine arbitrary tracks from multiple files', Icon: Layers },
  { text: 'Losslessly extract all tracks from a file', Icon: PackageOpen },
  { text: 'Remux into any compatible output format', Icon: RefreshCw },
  { text: 'Take full-resolution snapshots from videos in JPEG/PNG format', Icon: Camera },
  { text: 'Apply a per-file timecode offset in the preview', Icon: Clock },
  { text: 'Change rotation/orientation metadata in videos', Icon: RotateCw },
  { text: 'Powerful timeline with zoom and frame/keyframe jumping', Icon: ZoomIn },
  { text: 'Auto-saves per project cut segments to file', Icon: Save },
  { text: 'View ffmpeg last command log so you can modify and re-run recent commands on the command line', Icon: Terminal },
  { text: 'Give labels to cut segments', Icon: Tag },
  { text: 'Segment panel showing segments with details, export/import cut segments as CSV', Icon: ListOrdered },
  { text: 'Video thumbnails and audio waveform', Icon: AudioWaveform },
];

const usageScenarios = [
  'Cut out commercials from a recorded TV show',
  'Remove audio or video track from a file',
  'Add music to a video (or replace existing audio track)',
  'Include a subtitle into a video',
  'Extract music, video or subtitle track from a video and cut it to your needs',
  'Change format of a H264 TV recording from TS to MP4',
  'Fix rotation of a video that has the wrong orientation flag set, e.g. phone recording',
  'Quickly change a H264 MKV video to MOV or MP4 for playback on iPhone',
  'Import a list of cut times from other tool as a EDL (edit decision list, CSV) and run these cuts with LosslessCut',
  'Export a list of cut times as a CSV EDL and run these in another tool',
  'Loop a video / audio clip X times quickly without re-encoding',
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
            </ul>
            <div className="hero-author">Official app by <a href={authorUrl}>Mikael Finstad</a></div>
          </div>

          <div className="hero-media">
            {demoSources.length > 0 ? (
              // controls: a looping video must be pausable (WCAG 2.2.2), and the page has no JavaScript for a custom button
              <video autoPlay muted loop playsInline controls width={1000} height={624} poster={mainScreenshot} aria-label="LosslessCut cutting a video">
                {demoSources.map(({ url, type }) => <source key={url} src={url} type={type} />)}
              </video>
            ) : (
              <img src={mainScreenshot} alt="LosslessCut main window" width={1000} height={624} fetchPriority="high" />
            )}
          </div>
        </div>
      </header>

      <section className="quotes">
        <h2>Thousands of happy users</h2>
        <div className="quote-grid">
          {quotes.map((quote) => <blockquote key={quote} className="quote-card">{quote}</blockquote>)}
        </div>
      </section>

      <WhiteSection>
        <div className="comparison" style={{ maxWidth: '700px' }}>
          <h2 style={{ margin: '20px 0' }}>Traditional video editors</h2>
          <img loading="lazy" src={reencoded} alt="Generational compression artifacts from re-encoding" className="comparison-image" />

          <p>
            Any operation in a <b className="key-point">normal video editor</b><br />
            requires you to <b className="key-point">re-encode</b> the whole file<br />
            which can <b className="key-point">take hours</b> and you will<br />
            gradually <b className="key-point">lose quality</b> every time a file is processed.<br />
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
          {features.map(({ text, Icon }) => (
            <div key={text} className="feature-card">
              <Icon aria-hidden size={28} strokeWidth={1.75} className="feature-icon" />
              <div>{text}</div>
            </div>
          ))}
        </div>

        <h2 style={{ margin: '20px 0' }}>Other usage scenarios</h2>

        <div className="list">
          <List items={usageScenarios} />

          <div style={{ marginLeft: '40px' }}>
            * Which function is available depends on the file in question and which format/codec this file has<br />
            * This app is not for exact cutting. Start cut time will be &quot;rounded&quot; to the nearest previous keyframe, which may be a fraction of a second before your desired cut point, or up to several seconds, depending on the encoding.
          </div>
        </div>
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

      <div style={{ padding: '10px 30px' }}>
        ⚠️ Beware of unofficial websites and app distributors. The only official sources of LosslessCut are this website, <a target="_blank" rel="noreferrer" href={githubUrl} style={{ color: 'white' }}>GitHub</a> and the app stores above.
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
