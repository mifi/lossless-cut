import { MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Marker } from '@adamscybot/react-leaflet-component-marker';
import { Trans } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt } from 'react-icons/fa';

import { extractSrtGpsTrack } from './ffmpeg';
import { ReactSwal } from './swal';
import { handleError } from './util';
import { parseGpsLine } from './edlFormats';


export default async function tryShowGpsMap(filePath: string, streamIndex: number) {
  try {
    const subtitles = await extractSrtGpsTrack(filePath, streamIndex);
    const gpsPoints = subtitles.flatMap((subtitle) => {
      const firstLine = subtitle.lines[0];
      const { index } = subtitle;
      if (firstLine == null || index == null) return [];

      const parsed = parseGpsLine(firstLine);
      if (parsed == null) return [];

      return [{
        ...parsed,
        index,
        raw: firstLine,
      }];
    });
    // console.log(gpsPoints)

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
