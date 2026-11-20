import geohash from 'ngeohash';

const routePoints = [
  { lat: 48.8566, lng: 2.3522 },
  { lat: 48.8567, lng: 2.3523 }
];

function simplifyRoute(coords, maxPoints = 50) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const result = [];
  for (let i = 0; i < coords.length; i += step) {
    result.push(coords[i]);
  }
  if (result[result.length - 1] !== coords[coords.length - 1]) {
    result.push(coords[coords.length - 1]);
  }
  return result;
}

const simplified = simplifyRoute(routePoints, 40);
const aroundQueries = simplified.map(c => `way(around:15, ${c.lat}, ${c.lng})[highway];`).join('');

const overpassQuery = `
  [out:json][timeout:10];
  (
    ${aroundQueries}
  );
  out tags qt;
`;

console.log("Query:", overpassQuery);

async function test() {
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      const data = await response.json();
      console.log("Result elements:", data.elements?.length);
    } catch (e) {
      console.error(e);
    }
}
test();
