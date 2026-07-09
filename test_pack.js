const t = {
  id: 'talent_123',
  tags: ['A', 'B'],
  vettingScores: { technical: 90 },
  bio: 'Hello world',
  vettingPipeline: [{ stageIndex: 0, status: 'passed' }]
};

const telemetry = {
  phone: '123',
  vettingPipeline: t.vettingPipeline
};

const packedBio = `Tags: ${(t.tags || []).join(', ')}\n\nScores: ${JSON.stringify(t.vettingScores || {})}\n\nTelemetry: ${JSON.stringify(telemetry)}\n\nBio: ${t.bio || ''}`;

console.log("PACKED:", packedBio);

// UNPACK
let unpackedTelemetry = {};
const lines = packedBio.split('\n\n');
if (lines[2] && lines[2].startsWith('Telemetry:')) {
  unpackedTelemetry = JSON.parse(lines[2].replace('Telemetry:', '').trim());
}

console.log("UNPACKED:", unpackedTelemetry);
