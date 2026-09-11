import fs from 'fs';
const lines = fs.readFileSync('C:/Users/abdul/.gemini/antigravity/brain/9a89323d-e816-4fb7-817b-d956ad2c89b1/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n').filter(Boolean);
const message = lines.map(l => JSON.parse(l)).find(l => l.type === 'USER_INPUT' && l.content.includes('Milestone 3'));
fs.writeFileSync('ALL_MILESTONES.md', message.content);
console.log("Done");
