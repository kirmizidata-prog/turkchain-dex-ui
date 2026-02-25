import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function fail(msg) {
  console.error("ERROR:", msg);
  process.exit(1);
}

function readJson(p) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) fail("missing file: " + p);
  const s = fs.readFileSync(full, "utf8");
  try {
    return JSON.parse(s);
  } catch (e) {
    fail("invalid json: " + p + " " + (e && e.message ? e.message : ""));
  }
}

function isObj(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function addrOk(a) {
  return typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);
}

function tokenOk(t) {
  if (!isObj(t)) return "token not object";
  if (Number(t.chainId) !== 1919) return "chainId must be 1919";
  if (!addrOk(t.address)) return "invalid address";
  if (typeof t.symbol !== "string" || t.symbol.trim().length < 1 || t.symbol.trim().length > 16) return "invalid symbol";
  if (!Number.isInteger(t.decimals) || t.decimals < 0 || t.decimals > 255) return "invalid decimals";
  if (typeof t.name !== "string" || t.name.trim().length < 1 || t.name.trim().length > 64) return "invalid name";
  return null;
}

function logoPathFor(address) {
  return `tokenlists/logos/1919/${address}/logo.png`;
}

function checkList(file, requireLogo) {
  const j = readJson(file);
  if (!isObj(j)) fail(file + " root must be object");
  if (!Array.isArray(j.tokens)) fail(file + " tokens must be array");

  const seen = new Set();
  for (let i = 0; i < j.tokens.length; i++) {
    const t = j.tokens[i];
    const err = tokenOk(t);
    if (err) fail(file + " token[" + i + "]: " + err);

    const k = String(t.address).toLowerCase();
    if (seen.has(k)) fail(file + " duplicate address: " + t.address);
    seen.add(k);

    if (requireLogo) {
      const lp = logoPathFor(t.address);
      const full = path.join(ROOT, lp);
      if (!fs.existsSync(full)) fail(file + " missing logo: " + lp);
    }
  }

  console.log("OK:", file, "tokens:", j.tokens.length);
}

checkList("tokenlists/lists/official.tokenlist.json", true);
checkList("tokenlists/lists/community.tokenlist.json", true);

console.log("ALL OK");
