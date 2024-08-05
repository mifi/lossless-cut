import { MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Marker } from '@adamscybot/react-leaflet-component-marker';
import { Trans } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import { FaMapMarkerAlt } from 'react-icons/fa';

import { extractSrtGpsTrack } from './ffmpeg';
import { ReactSwal } from './swal';
import { handleError } from './util';


export default async function tryShowGpsMap(filePath: string, streamIndex: number) {
  try {
    const subtitles = await extractSrtGpsTrack(filePath, streamIndex);
    const gpsPoints = subtitles.flatMap((subtitle) => {
      const firstLine = subtitle.lines[0];
      // example:
      // "F/2.8, SS 776.89, ISO 100, EV -1.0, GPS (15.0732, 67.9771, 19), D 67.78m, H 20.30m, H.S 1.03m/s, V.S 0.00m/s"
      const gpsMatch = firstLine?.match(/^\s*([^,]+),\s*SS\s+([^,]+),\s*ISO\s+([^,]+),\s*EV\s+([^,]+),\s*GPS\s+\(([^,]+),\s*([^,]+),\s*([^,]+)\),\s*D\s+([^m]+)m,\s*H\s+([^m]+)m,\s*H\.S\s+([^m]+)m\/s,\s*V\.S\s+([^m]+)m\/s\s*$/);
      if (!gpsMatch || firstLine == null) return [];
      return [{
        index: subtitle.index,
        raw: firstLine,
        f: gpsMatch[1]!,
        ss: parseFloat(gpsMatch![2]!),
        iso: parseInt(gpsMatch![3]!, 10),
        ev: parseFloat(gpsMatch![4]!),
        lat: parseFloat(gpsMatch![5]!),
        lng: parseFloat(gpsMatch![6]!),
        alt: parseFloat(gpsMatch![7]!),
        distance: parseFloat(gpsMatch![8]!),
        height: parseFloat(gpsMatch![9]!),
        horizontalSpeed: parseFloat(gpsMatch![10]!),
        verticalSpeed: parseFloat(gpsMatch![11]!),
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
