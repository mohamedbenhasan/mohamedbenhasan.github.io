const overpassQuery = `
[out:json][timeout:10];
(
  way(around:15, 48.8566, 2.3522)[highway];
);
out tags qt;
`;
async function test() {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
           'User-Agent': 'vru-guard-pmr/1.0',
        },
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      console.log(response.status);
}
test();
