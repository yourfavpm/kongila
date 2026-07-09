const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/admin-panel/pages/index.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix talent-pipeline
const tpBlockStart = content.indexOf(`case 'talent-pipeline':`);
const cpBlockStart = content.indexOf(`case 'client-pipeline':`);
let tpBlock = content.slice(tpBlockStart, cpBlockStart);
tpBlock = tpBlock.replace(/<\/div>\n\s*<\/div>\n\s*\)\;/g, '</div>\n      );');
content = content.substring(0, tpBlockStart) + tpBlock + content.substring(cpBlockStart);

// 2. Fix client-pipeline
const newCpBlockStart = content.indexOf(`case 'client-pipeline':`);
const hrBlockStart = content.indexOf(`case 'hiring-requests':`);
let cpBlock = content.slice(newCpBlockStart, hrBlockStart);
cpBlock = cpBlock.replace(/<\/div>\n\s*<\/div>\n\s*\)\;/g, '</div>\n      );');
content = content.substring(0, newCpBlockStart) + cpBlock + content.substring(hrBlockStart);

fs.writeFileSync(filePath, content);
console.log('Successfully fixed syntax errors');
