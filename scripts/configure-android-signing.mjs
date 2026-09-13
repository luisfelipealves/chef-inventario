import fs from "node:fs";
import path from "node:path";

const androidDir = path.resolve("src-tauri/gen/android");
const gradlePath = path.join(androidDir, "app/build.gradle.kts");
const keystorePath = process.env.ANDROID_KEYSTORE_PATH;
const keyAlias = process.env.ANDROID_KEY_ALIAS;
const keyPassword = process.env.ANDROID_KEY_PASSWORD;
const storePassword = process.env.ANDROID_STORE_PASSWORD;

if (!keystorePath || !keyAlias || !keyPassword || !storePassword) {
  throw new Error(
    "Configure ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD e ANDROID_STORE_PASSWORD no GitHub Actions.",
  );
}

fs.writeFileSync(
  path.join(androidDir, "keystore.properties"),
  [
    `storePassword=${storePassword}`,
    `keyPassword=${keyPassword}`,
    `keyAlias=${keyAlias}`,
    `storeFile=${keystorePath}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);

let gradle = fs.readFileSync(gradlePath, "utf8");
if (!gradle.includes('signingConfigs {\n        create("release")')) {
  const imports = [
    "import java.io.FileInputStream",
    "import java.util.Properties",
  ].filter((statement) => !gradle.includes(statement));
  if (imports.length > 0) gradle = `${imports.join("\n")}\n${gradle}`;

  const signingConfig = `signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }

    `;
  const buildTypesIndex = gradle.indexOf("buildTypes {");
  if (buildTypesIndex < 0) throw new Error("Bloco buildTypes não encontrado");
  gradle = `${gradle.slice(0, buildTypesIndex)}${signingConfig}${gradle.slice(buildTypesIndex)}`;
}

const releaseBlock = /((?:getByName\("release"\)|release)\s*\{)/;
if (!releaseBlock.test(gradle)) throw new Error("Bloco release não encontrado");
if (!gradle.includes('signingConfig = signingConfigs.getByName("release")')) {
  gradle = gradle.replace(
    releaseBlock,
    '$1\n            signingConfig = signingConfigs.getByName("release")',
  );
}
fs.writeFileSync(gradlePath, gradle);

