export interface EDLEvent {
  eventNumber: string;
  reelNumber: string;
  trackType: string;
  transition: string;
  sourceIn: string;
  sourceOut: string;
  recordIn: string;
  recordOut: string;
}

export default function parseCmx3600(edlContent: string) {
  const [firstLine, ...lines] = edlContent.split('\n');
  const events: EDLEvent[] = [];

  // trim BOM from first line.
  for (const line of [...(firstLine ? [firstLine.trim()] : []), ...lines]) {
    if (/^\d+\s+/.test(line)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 8) {
        events.push({
          eventNumber: parts[0]!,
          reelNumber: parts[1]!,
          trackType: parts[2]!,
          transition: parts[3]!,
          sourceIn: parts[4]!,
          sourceOut: parts[5]!,
          recordIn: parts[6]!,
          recordOut: parts[7]!,
        });
      }
    }
  }

  return { events };
}
