const fs = require('fs');
const file = '/Users/oluwadammilola/benita/kongila/apps/kongila-web/components/TalentDashboard.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('const renderPdfView = () => {'));
let endIdx = lines.findIndex(l => l.includes('<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}'));

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  // We want to delete from startIdx down to endIdx - 1
  lines.splice(startIdx, endIdx - startIdx, '      return (');
  fs.writeFileSync(file, lines.join('\n'));
  console.log("Fixed top of file.");
} else {
  console.log("Could not find bounds to fix top of file.");
}
