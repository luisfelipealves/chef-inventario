import fs from "node:fs";

const rawVersion = process.argv[2];
const version = rawVersion?.replace(/^v/, "");

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Versão inválida: ${rawVersion ?? "(ausente)"}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
packageJson.version = version;
fs.writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

const tauriPath = "src-tauri/tauri.conf.json";
const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
tauriConfig.version = version;
fs.writeFileSync(tauriPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

for (const path of ["src-tauri/Cargo.toml", "src-tauri/Cargo.lock"]) {
  const contents = fs.readFileSync(path, "utf8");
  const pattern = path.endsWith("Cargo.toml")
    ? /(^version = ")[^"]+(")/m
    : /(^name = "chef-gestao"\nversion = ")[^"]+(")/m;
  const updated = contents.replace(pattern, `$1${version}$2`);
  if (!pattern.test(contents)) {
    throw new Error(`Pacote chef-gestao não encontrado em ${path}`);
  }
  fs.writeFileSync(path, updated);
}

console.log(`Versão sincronizada: ${version}`);
