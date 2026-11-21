// Music for the social media versions of the demos, downloaded when first used. Posts with it must credit the track (see AGENTS.md "Feature media").
// Upbeat from the start, since the videos are short
const incompetech = (title: string) => ({ url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(title)}.mp3`, credit: `Music: "${title}" by Kevin MacLeod (incompetech.com), CC BY 4.0` });

const musicTracks: Record<string, { url: string, credit: string }> = {
  // Upbeat electronic
  werq: incompetech('Werq'),
  // Energetic and percussive
  pamgaea: incompetech('Pamgaea'),
  // Calmer electronic
  wallpaper: incompetech('Wallpaper'),
};

export const defaultMusic = 'werq';

export default musicTracks;
