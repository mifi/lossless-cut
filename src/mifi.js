import axios from 'axios';

// eslint-disable-next-line import/prefer-default-export
export async function loadMifiLink() {
  try {
    const resp = await axios.get('https://losslesscut.mifi.no/config.json');
    return resp.data;
  } catch (err) {
    return undefined;
  }
}
