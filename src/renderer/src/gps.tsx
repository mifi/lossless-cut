import { MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Marker } from '@adamscybot/react-leaflet-component-marker';
import { Trans } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt } from 'react-icons/fa';

import { extractSrtGpsTrack } from './ffmpeg';
import { ReactSwal } from './swal';
import { handleError } from './util';
import { parseDjiGps1, parseDjiGps2 } from './edlFormats';


export default async function tryShowGpsMap(filePath: string, streamIndex: number) {
  try {
    const subtitles = await extractSrtGpsTrack(filePath, streamIndex);
    const allGpsPoints = subtitles.flatMap((subtitle) => {
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
    // console.log(allGpsPoints)

    // limit number of points, or else severe map slowdown
    const maxPointsToShow = 500;
    let gpsPoints = allGpsPoints;
    if (allGpsPoints.length > maxPointsToShow) {
      gpsPoints = Array.from({ length: maxPointsToShow }).flatMap((_, i) => {
        const p = allGpsPoints[Math.floor(i * (allGpsPoints.length / maxPointsToShow))];
        return p != null ? [p] : [];
      });
    }

    const firstPoint = gpsPoints[0];

    if (firstPoint == null) {
      throw new Error('No GPS points found');
    }

    // https://www.openstreetmap.org/copyright
    ReactSwal.fire({
      width: '100%',
      html: (
        <>
          <div style={{ marginBottom: '1em' }}><Trans>GPS track</Trans></div>

          <MapContainer center={[firstPoint.lng, firstPoint.lat]} zoom={16} style={{ height: 500 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {gpsPoints.map((point, i) => (
              <Marker key={point.index} position={[point.lng, point.lat]} icon={<FaMapMarkerAlt color="#af0e0e" size={20} />}>
                <Popup>
                  <div>Point {i + 1} / {gpsPoints.length}</div>
                  {point.raw}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </>
      ),
      showCloseButton: true,
      showConfirmButton: false,
    });
  } catch (err) {
    handleError(err);
  }
}
