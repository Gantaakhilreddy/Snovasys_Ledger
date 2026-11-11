import fs from 'fs';
import path from 'path';

const [,, inputFile, outputFile] = process.argv;
if (!inputFile || !outputFile) {
  console.error('Usage: node save-stitch-screen.mjs <input.txt> <output.html>');
  process.exit(1);
}

const raw = fs.readFileSync(inputFile, 'utf8');
const data = JSON.parse(raw);
const html = data.html || '';

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');
console.log(`Saved ${outputFile} (${html.length} bytes)`);
