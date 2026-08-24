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
