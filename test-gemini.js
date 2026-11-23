async function test() {
    try {
        const response = await fetch("http://localhost:3000/api/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Hello, world!" })
        });
        const data = await response.json();
        console.log(data);
    } catch(e) {
        console.error(e);
    }
}
test();
