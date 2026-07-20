const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/kongila-web/components/TalentDashboard.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function removeComponentExact(sourceCode, startStr) {
  const startIdx = sourceCode.indexOf(startStr);
  if (startIdx === -1) return sourceCode;

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

source = removeComponentExact(source, 'const MessagesSection = ({ messages, setMessages, profile }: { messages: any[]; setMessages: (m: any) => void; profile: any }) => {');
source = removeComponentExact(source, 'const NotificationsSection = ({ profile, notifications, setNotifications }: { profile: any; notifications: any[]; setNotifications: (n: any) => void }) => {');

fs.writeFileSync(filePath, source);
console.log('Stripped old messages and notifications panels.');
