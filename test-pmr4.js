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
           'Accept': 'application/json',
           'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      const text = await response.text();
      console.log(response.status);
      console.log(text.substring(0, 100));
}
test();
