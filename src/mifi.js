import axios from 'axios';

// eslint-disable-next-line import/prefer-default-export
export async function loadMifiLink() {
  try {
    // In old versions: https://mifi.no/losslesscut/config.json
    const resp = await axios.get('https://losslesscut.mifi.no/config.json');
    // const resp = await axios.get('http://localhost:8080/losslesscut/config-dev.json');
    return resp.data;
  } catch (err) {
    return undefined;
  }
}
