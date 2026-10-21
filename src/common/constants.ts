import { githubUrl } from './links.ts';
import { getAppLinkUrl, websiteUrl } from './websiteUrls.ts';

export { githubUrl, supportEmail } from './links.ts';

export const homepageUrl = `${websiteUrl}/`;
export const getReleaseUrl = (version: string) => `${githubUrl}/releases/tag/v${version}`;
export const compareReleasesUrl = (fromVersion: string, toVersion: string) => `${githubUrl}/compare/v${fromVersion}...v${toVersion}`;
export const licensesUrl = getAppLinkUrl('licenses');
export const thanksUrl = getAppLinkUrl('thanks');
export const discussionsUrl = getAppLinkUrl('discussions');
export const discordUrl = getAppLinkUrl('discord');
// Link to losslesscut.app pages (and anything that may move) only through websiteUrls.ts, see the rules there.
export const usageUrl = getAppLinkUrl('usage');
export const faqUrl = getAppLinkUrl('faq');
export const featureRequestUrl = getAppLinkUrl('feature-request');
export const publicBugReportUrl = getAppLinkUrl('bug-report');
export const troubleshootingUrl = getAppLinkUrl('troubleshooting');
export const exportedFileNameTemplateHelpUrl = getAppLinkUrl('file-name-template');
export const selectSegmentByExpressionHelpUrl = getAppLinkUrl('select-segments-by-expression');
export const editSegmentByExpressionHelpUrl = getAppLinkUrl('edit-segments-by-expression');
export const changeEnabledStreamsExpressionHelpUrl = getAppLinkUrl('select-tracks-by-expression');
