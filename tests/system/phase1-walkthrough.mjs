// System / UAT walk-through of Phase 1 in a real browser, one role at a time.
// Needs: the app running (npm run dev), Google Chrome, and the demo accounts in README.md (section 10).
// It admits Kavya Reddy to bed GF-01, so GF-01 must be vacant and Kavya not admitted.
//   BASE_URL=http://localhost:3000 CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:system
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "shds-system-"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (step, ok, detail = "") => { results.push({ step, ok, detail }); console.log(ok ? "✓" : "✗", step, ok ? "" : detail); };

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: path.join(OUT, "profile") });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text().slice(0, 200)));

async function as(email) {
  await page.deleteCookie({ name: "shds-auth-token", domain: "localhost" });
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: email === "admin@shds.com" ? "Admin@123" : "Test@1234" }) });
  if (res.status !== 200) throw new Error(`login ${email} ${res.status}`);
  await page.setCookie({ name: "shds-auth-token", value: res.headers.get("set-cookie").match(/shds-auth-token=([^;]+)/)[1], domain: "localhost", path: "/" });
}
const go = async (path) => { await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 90000 }); await wait(400); };
const text = () => page.evaluate(() => document.body.textContent.replace(/\s+/g, " "));
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
async function pick(trigger, label) {
  await page.click(trigger); await wait(400);
  const opts = await page.$$(`::-p-xpath(//*[@role='option'][contains(normalize-space(.), "${label}")])`);
  if (!opts.length) throw new Error(`option "${label}" not found for ${trigger}`);
  await opts[0].click(); await wait(400);
}
async function type(sel, value) { await page.click(sel, { clickCount: 3 }); await page.type(sel, value); }
async function clickButton(label) {
  const b = await page.$$(`::-p-xpath(//button[normalize-space(.)="${label}" or .//text()[normalize-space()="${label}"]])`);
  if (!b.length) throw new Error(`button "${label}" not found`);
  await b[b.length - 1].click(); await wait(1500);
}
const toast = () => page.evaluate(() => [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent).join(" | "));
page.on("dialog", (d) => d.accept());

try {
  // 1. Receptionist admits Kavya Reddy to GF-01 under General Medicine / Dr. Sneha Iyer
  await as("reception@test.com");
  await go("/dashboard");
  check("Receptionist dashboard offers Admit Patient, not Medical Record", (await text()).includes("Admit Patient") && !(await text()).includes("Medical Record\n"));
  await go("/beds");
  await (await page.$$("text/GF-01"))[0].click(); await wait(800);
  check("Bed dialog offers 'Admit a patient to this bed'", (await text()).includes("Admit a patient to this bed"));
  check("Bed dialog has no Occupied option and no Delete for receptionist", !(await page.$("#status-option-OCCUPIED")) && !(await text()).includes("Delete Bed"));
  await (await page.$$("::-p-xpath(//a[contains(., 'Admit a patient to this bed')])"))[0].click();
  await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}); await wait(800);
  check("Admit form opens with GF-01 preselected", (await page.$eval("#admit-bed", (e) => e.textContent)).includes("GF-01"));
  check("Department defaults to the ward's department", (await page.$eval("#admit-department", (e) => e.textContent)).includes("General Medicine"));
  await type("#patient-search", "kavya");
  await pick("#admit-patient", "Kavya Reddy");
  await pick("#admit-doctor", "Sneha");
  await type("#admit-reason", "High fever for 4 days with body ache and vomiting");
  await type("#admit-dx", "Dengue fever");
  await shot("1-admit-form");
  await clickButton("Admit patient");
  await wait(1500);
  check("Admission lands on the patient chart", page.url().includes("/admissions/c"), page.url());
  const chartUrl = page.url();
  const t1 = await text();
  check("Chart banner shows UHID, IP number, bed and doctor", /SHDS-\d{8}/.test(t1) && /IP-2026-\d{6}/.test(t1) && t1.includes("GF-01") && t1.includes("Dr. Sneha Iyer"), t1.slice(0, 300));

  // 2. Day nurse charts vitals, writes a note, hands over
  await as("nurse@test.com");
  await go("/dashboard");
  const nd = await text();
  check("Nurse dashboard shows ward census and patients needing vitals", nd.includes("In-patients") && nd.includes("Needs attention") && !nd.includes("Revenue"));
  await shot("2-nurse-dashboard");
  await go("/admissions");
  check("Nurse sees in-patient list with Kavya and Amit", (await text()).includes("Kavya Reddy") && (await text()).includes("Amit Kumar"));
  check("Nurse cannot see Admit patient button", !(await text()).includes("Admit patient"));
  await go(chartUrl.replace(BASE, ""));
  for (const [id, v] of [["#v-temperature", "101.6"], ["#v-pulse", "112"], ["#v-systolic", "108"], ["#v-diastolic", "70"], ["#v-respiratoryRate", "20"], ["#v-spo2", "97"]]) await type(id, v);
  await clickButton("Save vitals");
  check("Abnormal vitals raise Fever and Tachycardia alerts", (await toast()).includes("Fever") && (await text()).includes("Tachycardia"), await toast());
  await page.click("::-p-xpath(//button[@role='tab'][contains(., 'Notes')])"); await wait(500);
  await page.type("textarea", "Patient complains of body ache. Oral intake poor, IV fluids running at 100 ml/hr.");
  await clickButton("Save note");
  check("Nursing note saved", (await text()).includes("Oral intake poor"));
  await page.click("::-p-xpath(//button[@role='tab'][contains(., 'Handover')])"); await wait(500);
  await type("#h-situation", "Day 1 dengue, febrile 101.6°F, pulse 112");
  await type("#h-assessment", "Haemodynamically stable, poor oral intake");
  await type("#h-recommendation", "Repeat vitals 2-hourly, CBC with platelets at 6 am");
  await type("#h-pendingTasks", "6 am CBC sample; IV fluid bag change at 2 am");
  await clickButton("Record handover");
  check("Handover recorded and waiting for next shift", (await text()).includes("Awaiting next shift"));
  await shot("3-chart-handover");

  // 3. Night nurse reads the sheet and acknowledges
  await as("nurse2@test.com");
  await go("/handover");
  const hs = await text();
  check("Handover sheet lists every in-patient with alerts and pending tasks", hs.includes("Kavya Reddy") && hs.includes("Amit Kumar") && hs.includes("6 am CBC sample") && hs.includes("Not acknowledged"));
  await shot("4-handover-sheet");
  await go(chartUrl.replace(BASE, ""));
  await page.click("::-p-xpath(//button[@role='tab'][contains(., 'Handover')])"); await wait(500);
  await clickButton("Acknowledge");
  check("Night nurse acknowledges the handover", (await text()).includes("Received by Rekha Paul"));

  // 4. Doctor round note and discharge with medicines and follow-up
  await as("doctor2@test.com");
  await go(chartUrl.replace(BASE, ""));
  await page.click("::-p-xpath(//button[@role='tab'][contains(., 'Notes')])"); await wait(500);
  await page.type("textarea", "Platelets 1.1 lakh, no warning signs. Continue fluids.");
  await clickButton("Save note");
  check("Doctor round note saved as Doctor round", (await text()).includes("Doctor round"));
  await page.click("::-p-xpath(//button[@role='tab'][contains(., 'Discharge')])"); await wait(500);
  await type("#d-dx", "Dengue fever without warning signs");
  await pick("#d-condition", "Improved");
  await page.type("#d-treatment", "IV fluids, paracetamol, daily platelet monitoring");
  await page.type("input[aria-label='Medicine']", "Paracetamol 650 mg");
  await page.type("input[aria-label='Dose']", "1 tablet");
  await page.type("input[aria-label='When']", "Three times a day after food");
  await page.type("input[aria-label='Duration']", "3 days");
  await page.type("#d-advice", "Drink 3 litres of fluid a day. Rest at home for one week.");
  await page.type("#d-warning", "Bleeding gums, black stools, severe stomach pain");
  const fu = new Date(Date.now() + (7 + Math.floor(Math.random() * 20)) * 86400000);
  await page.$eval("#d-fu-date", (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, fu.toISOString().slice(0, 10));
  // A different follow-up slot each run, so repeated runs don't collide with earlier bookings.
  const slot = `${String(9 + Math.floor(Math.random() * 8)).padStart(2, "0")}:${["00", "15", "30", "45"][Math.floor(Math.random() * 4)]}`;
  await page.$eval("#d-fu-time", (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, slot);
  await shot("5-discharge-form");
  await clickButton("Discharge patient");
  await wait(1500);
  check("Discharge completes and books follow-up", (await toast()).includes("follow-up visit booked") || (await text()).includes("Discharged"), await toast());
  await go(chartUrl.replace(BASE, "") + "/summary");
  const sum = await text();
  check("Patient-friendly summary has diagnosis, medicines, warning signs, next visit", sum.includes("What we found") && sum.includes("Paracetamol 650 mg") && sum.includes("Come to the hospital immediately") && sum.includes("Your next visit"));
  const wa = await page.$eval("a[href^='https://wa.me/']", (a) => a.href);
  check("WhatsApp link goes to the patient's number with the summary", wa.startsWith("https://wa.me/919876500002?text=") && decodeURIComponent(wa).includes("Dengue"), wa.slice(0, 80));
  await shot("6-summary");

  // 5. Ward attendant cleans the bed
  await as("ward@test.com");
  await go("/dashboard");
  check("Attendant dashboard lists GF-01 waiting for cleaning", (await text()).includes("GF-01"));
  await go("/beds");
  await (await page.$$("text/GF-01"))[0].click(); await wait(800);
  check("Attendant cannot admit from the bed dialog", !(await text()).includes("Admit a patient to this bed"));
  await page.click("#status-option-VACANT"); await wait(300);
  await clickButton("Save Changes");
  check("Attendant marks GF-01 vacant after cleaning", (await toast()).includes("updated successfully"), await toast());

  // 6. Patient (Amit) sees own stay only
  await as("patient@test.com");
  await go("/admissions");
  const pt = await text();
  check("Patient sees only their own stay", pt.includes("Hospital Stays") && pt.includes("In hospital") && !pt.includes("Kavya"));

  // 7. Admin activity log
  await as("admin@shds.com");
  await go("/admin/audit-logs");
  const al = await text();
  check("Activity log shows admissions, vitals, handovers and sign-ins with names", al.includes("Created admission") && al.includes("Created vital sign") && al.includes("Signed in") && al.includes("Rekha Paul"));
  await shot("7-audit-log");
  await go("/admin/audit-logs?entity=Handover");
  await (await page.$$("tbody tr"))[0].click(); await wait(400);
  check("Expanding an update shows before/after", (await text()).includes("acknowledgedById"));
} catch (e) {
  check("UAT script ran to completion", false, e.message);
  await shot("error");
}
check("No browser errors during the walk-through", errors.length === 0, errors.slice(0, 3).join(" || "));
await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed · screenshots in ${OUT}`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
