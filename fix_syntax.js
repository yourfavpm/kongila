const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/kongila-web/components/TalentDashboard.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function removeComponentExact(sourceCode, startStr) {
  const startIdx = sourceCode.indexOf(startStr);
  if (startIdx === -1) return sourceCode;

  // Search forward for the opening brace of the component
  let braceCount = 0;
  let started = false;
  let endIdx = -1;

  for (let i = startIdx; i < sourceCode.length; i++) {
    if (sourceCode[i] === '{') {
      braceCount++;
      started = true;
    } else if (sourceCode[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx !== -1) {
    let trimEnd = endIdx + 1;
    while(trimEnd < sourceCode.length && (sourceCode[trimEnd] === ';' || sourceCode[trimEnd] === ' ' || sourceCode[trimEnd] === '\n')) {
      trimEnd++;
    }
    return sourceCode.substring(0, startIdx) + sourceCode.substring(trimEnd);
  }
  return sourceCode;
}

// Just match the start of the declaration precisely
source = removeComponentExact(source, 'const SettingsSection = ({ profile, onUpdateProfile }');
source = removeComponentExact(source, 'const SupportSection = ({ profile, onUpdateProfile }');

fs.writeFileSync(filePath, source);
console.log('Fixed syntax and stripped sections.');
