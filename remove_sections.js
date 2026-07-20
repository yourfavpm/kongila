const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/kongila-web/components/TalentDashboard.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function removeComponent(sourceCode, startStr) {
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

source = removeComponent(source, 'const SettingsSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (p: any) => void }) => {');
source = removeComponent(source, 'const SupportSection = ({ profile, onUpdateProfile }: { profile: any; onUpdateProfile?: (updatedProfile: any) => void }) => {');

source = source.replace(
  "import TalentMessagesPanel from './TalentMessagesPanel';\nimport TalentNotificationsPanel from './TalentNotificationsPanel';",
  "import TalentMessagesPanel from './TalentMessagesPanel';\nimport TalentNotificationsPanel from './TalentNotificationsPanel';\nimport TalentSettingsPanel from './TalentSettingsPanel';\nimport TalentSupportPanel from './TalentSupportPanel';"
);

source = source.replace(
  "case 'settings':         return <SettingsSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;\n      case 'support':          return <SupportSection profile={talentProfile} onUpdateProfile={onUpdateProfile} />;",
  "case 'settings':         return <TalentSettingsPanel profile={talentProfile} onUpdateProfile={onUpdateProfile} />;\n      case 'support':          return <TalentSupportPanel currentUser={currentUser} profile={talentProfile} supportTickets={talentProfile?.supportTickets || []} setSupportTickets={(val) => { if(onUpdateProfile) onUpdateProfile({...talentProfile, supportTickets: typeof val === 'function' ? val(talentProfile?.supportTickets || []) : val}) }} />;"
);

fs.writeFileSync(filePath, source);
console.log('Processed.');
