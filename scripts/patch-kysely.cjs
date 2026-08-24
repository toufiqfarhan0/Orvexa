/**
 * Patch Kysely FileMigrationProvider for Windows ESM loader compatibility.
 * On Windows, dynamic import() requires file:// URLs for absolute paths.
 */
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../node_modules/kysely/dist/migration/file-migration-provider.js');

if (fs.existsSync(targetPath)) {
  let content = fs.readFileSync(targetPath, 'utf8');
  if (!content.includes('fileUrl')) {
    const unpatched = `            const filePath = this.#props.path.join(this.#props.migrationFolder, fileName);
            const migration = this.#props.import
                ? await this.#props.import(filePath)
                : await import(/* webpackIgnore: true */ filePath);`;

    const patched = `            const filePath = this.#props.path.join(this.#props.migrationFolder, fileName);
            const fileUrl = filePath.startsWith('file:') ? filePath : \`file:///\${filePath.replace(/\\\\/g, '/')}\`;
            const migration = this.#props.import
                ? await this.#props.import(filePath)
                : await import(/* webpackIgnore: true */ fileUrl);`;

    if (content.includes(unpatched)) {
      content = content.replace(unpatched, patched);
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log('[Orvexa] Patched Kysely FileMigrationProvider for Windows ESM URL compatibility.');
    }
  }
}

// Patch TrueForge Daytona Sandbox Provider for Daytona Cloud standard snapshots
const sandboxImageFile = path.resolve(__dirname, '../node_modules/@truefoundry/trueforge-core/dist/core/sandbox/sandboxImage.js');
if (fs.existsSync(sandboxImageFile)) {
  let imgContent = fs.readFileSync(sandboxImageFile, 'utf8');
  if (imgContent.includes('tfy.jfrog.io/tfy-images/trueforge-sandbox')) {
    imgContent = imgContent.replace(/tfy\.jfrog\.io\/tfy-images\/trueforge-sandbox:[a-f0-9]+/g, 'daytonaio/sandbox:0.9.0');
    fs.writeFileSync(sandboxImageFile, imgContent, 'utf8');
    console.log('[Orvexa] Patched TrueForge Daytona default sandbox image to standard snapshot.');
  }
}

const daytonaProviderFile = path.resolve(__dirname, '../node_modules/@truefoundry/trueforge-core/dist/core/sandbox/provider/DaytonaProvider.js');
if (fs.existsSync(daytonaProviderFile)) {
  let provContent = fs.readFileSync(daytonaProviderFile, 'utf8');
  const targetLine = 'this.buildRef = options.buildRef ?? deriveImageBuildName(imageDigest(options.sandboxImage));';
  const replacementLine = 'this.buildRef = options.buildRef ?? (options.sandboxImage && options.sandboxImage.startsWith("daytona") ? options.sandboxImage : deriveImageBuildName(imageDigest(options.sandboxImage)));';
  if (provContent.includes(targetLine)) {
    provContent = provContent.replace(targetLine, replacementLine);
    fs.writeFileSync(daytonaProviderFile, provContent, 'utf8');
    console.log('[Orvexa] Patched TrueForge DaytonaProvider buildRef resolution.');
  }
}
