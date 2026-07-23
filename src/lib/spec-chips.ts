import type { Product } from "@/lib/products";

/**
 * Generate 2-3 factual specification chips from trusted product fields.
 * Chips are derived from specs, not manually hardcoded.
 * Maximum three chips, neutral grey, one may use accent-soft for an important differentiator.
 */

type Chip = { label: string; accent?: boolean };

const resolutionPattern = /\b(\d)\s*MP\b/i;
const irRangePattern = /(\d+)\s*m\b/i;
const channelPattern = /(\d+)\s*channel/i;
const portPattern = /(\d+)\s*port/i;
const poePattern = /PoE/i;
const ip67Pattern = /IP67/i;
const wdrPattern = /120\s*dB/i;
const wifiPattern = /Wi-Fi/i;
const fingerprintPattern = /fingerprint/i;
const facePattern = /face/i;
const rfidPattern = /RFID/i;
const accessControlPattern = /access.control/i;
const micPattern = /Built-in\s*Mic/i;
const gigabitPattern = /Gigabit/i;
const managedPattern = /Managed/i;
const unmanagedPattern = /Unmanaged/i;
const k4Pattern = /4K/i;
const storagePattern = /(\d+)\s*TB/i;
const userCapacityPattern = /(\d[\d,]*)\s*user/i;
const fullColorPattern = /Full.colour|full.color|dual.light|warm.light/i;

function extractChipsFromSpecs(specs: Record<string, string>): Chip[] {
  const chips: Chip[] = [];
  const allSpecText = Object.entries(specs)
    .map(([key, val]) => `${key} ${val}`)
    .join(" ");

  /* Resolution — e.g. "4 MP" */
  const resMatch = allSpecText.match(resolutionPattern);
  if (resMatch) {
    chips.push({ label: `${resMatch[1]} MP`, accent: true });
  }

  /* IR range — e.g. "30 m" */
  const irMatch = allSpecText.match(irRangePattern);
  if (irMatch && Number(irMatch[1]) >= 20) {
    chips.push({ label: `${irMatch[1]} m IR` });
  }

  /* Full colour / dual light */
  if (fullColorPattern.test(allSpecText)) {
    chips.push({ label: "Full colour" });
  }

  /* NVR channels */
  const chanMatch = allSpecText.match(channelPattern);
  if (chanMatch) {
    chips.push({ label: `${chanMatch[1]} channel` });
  }

  /* 4K */
  if (k4Pattern.test(allSpecText) && !chips.some((c) => c.label.includes("MP"))) {
    chips.push({ label: "4K" });
  }

  /* Storage */
  const storMatch = allSpecText.match(storagePattern);
  if (storMatch) {
    chips.push({ label: `${storMatch[1]} TB` });
  }

  /* PoE */
  if (poePattern.test(allSpecText)) {
    chips.push({ label: "PoE" });
  }

  /* IP67 */
  if (ip67Pattern.test(allSpecText)) {
    chips.push({ label: "IP67" });
  }

  /* Built-in mic */
  if (micPattern.test(allSpecText)) {
    chips.push({ label: "Built-in mic" });
  }

  /* Switch ports */
  const portMatch = allSpecText.match(portPattern);
  if (portMatch) {
    chips.push({ label: `${portMatch[1]}-port PoE`, accent: true });
  }

  /* Gigabit */
  if (gigabitPattern.test(allSpecText)) {
    chips.push({ label: "Gigabit" });
  }

  /* Managed / Unmanaged */
  if (managedPattern.test(allSpecText)) {
    chips.push({ label: "Managed" });
  } else if (unmanagedPattern.test(allSpecText)) {
    chips.push({ label: "Unmanaged" });
  }

  /* Biometric: fingerprint */
  if (fingerprintPattern.test(allSpecText)) {
    chips.push({ label: "Fingerprint" });
  }

  /* Biometric: face */
  if (facePattern.test(allSpecText)) {
    chips.push({ label: "Face", accent: true });
  }

  /* Wi-Fi */
  if (wifiPattern.test(allSpecText)) {
    chips.push({ label: "Wi-Fi" });
  }

  /* RFID */
  if (rfidPattern.test(allSpecText)) {
    chips.push({ label: "RFID" });
  }

  /* Access control */
  if (accessControlPattern.test(allSpecText)) {
    chips.push({ label: "Access control" });
  }

  /* User capacity */
  const userMatch = allSpecText.match(userCapacityPattern);
  if (userMatch) {
    const num = userMatch[1].replace(",", "");
    if (Number(num) >= 500) {
      chips.push({ label: `${userMatch[1]} users` });
    }
  }

  /* WDR 120dB */
  if (wdrPattern.test(allSpecText)) {
    chips.push({ label: "120 dB WDR" });
  }

  /* Deduplicate and take first 3 */
  const seen = new Set<string>();
  const unique = chips.filter((c) => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });

  /* Ensure accent chip is first if present */
  const accentChips = unique.filter((c) => c.accent);
  const otherChips = unique.filter((c) => !c.accent);
  const ordered = [...accentChips, ...otherChips].slice(0, 3);

  /* If no accent was set, mark the first as accent if it's a key differentiator */
  if (ordered.length > 0 && !ordered.some((c) => c.accent)) {
    ordered[0].accent = true;
  }

  return ordered;
}

export function getSpecChips(product: Product): Chip[] {
  return extractChipsFromSpecs(product.specs);
}
