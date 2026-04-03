const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error("PAGE ERROR LOG:", msg.text());
    }
  });
  page.on("pageerror", (error) => {
    console.error("PAGE ERROR EXCEPTION:", error.message);
  });
  await page.goto("http://localhost:5555", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2000));
  await browser.close();
})();
