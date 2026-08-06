const fs = require("node:fs");
const path = require("node:path");

function loadLocalEnvironment(rootDirectory) {
  const environmentPath = path.join(rootDirectory, ".env");

  if (!fs.existsSync(environmentPath)) {
    return;
  }

  const environment = fs.readFileSync(environmentPath, "utf8");

  environment.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex < 1) {
      return;
    }

    const name = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(name in process.env)) {
      process.env[name] = value;
    }
  });
}

module.exports = { loadLocalEnvironment };
