import { useEffect, useState } from 'react';
import { MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Marker } from '@adamscybot/react-leaflet-component-marker';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt } from 'react-icons/fa';

import { extractSrtGpsTrack } from '../ffmpeg';
import { handleError } from '../util';
import { parseDjiGps1, parseDjiGps2 } from '../edlFormats';
import * as Dialog from './Dialog';


// https://www.openstreetmap.org/copyright

async function getGpsTrack({ filePath, streamIndex }: { filePath: string, streamIndex: number }) {
  const subtitles = await extractSrtGpsTrack(filePath, streamIndex);
  return subtitles.flatMap((subtitle) => {
    const { index } = subtitle;
    if (index == null) return [];

    const parsed = parseDjiGps1(subtitle.lines) ?? parseDjiGps2(subtitle.lines);
    if (parsed == null) return [];

    return [{
      ...parsed,
      index,
      raw: subtitle.lines,
    }];
  });
}

export default function GpsMap({ filePath, streamIndex }: {
  filePath: string,
  streamIndex: number,
}) {
  const [points, setPoints] = useState<Awaited<ReturnType<typeof getGpsTrack>>>();

  useEffect(() => {
    (async () => {
      try {
        const allGpsPoints = await getGpsTrack({ filePath, streamIndex });

        // limit number of points, or else severe map slowdown
        const maxPointsToShow = 500;
        let gpsPoints = allGpsPoints;
        if (allGpsPoints.length > maxPointsToShow) {
          gpsPoints = Array.from({ length: maxPointsToShow }).flatMap((_, i) => {
            const p = allGpsPoints[Math.floor(i * (allGpsPoints.length / maxPointsToShow))];
            return p != null ? [p] : [];
          });
        }

        if (gpsPoints.length === 0) {
          throw new Error('No GPS points found');
        }

        setPoints(gpsPoints);
      } catch (err) {
        handleError(err);
      }
    })();
  }, [filePath, streamIndex]);

  const firstPoint = points?.[0];

  if (points == null || firstPoint == null) {
    return null;
  }

  return (
    <div style={{ width: '80vw', height: '60vh' }}>
      <MapContainer center={[firstPoint.lat, firstPoint.lng]} zoom={16} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((point, i) => (
          <Marker key={point.index} position={[point.lat, point.lng]} icon={<FaMapMarkerAlt color="#af0e0e" size={20} />}>
            <Popup>
              <div>Point {i + 1} / {points.length}</div>
              {point.raw}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <Dialog.CloseButton />
    </div>
  );
}
