const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
let db = { assessments: [] };
if (fs.existsSync(dbPath)) {
  db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

const mockAssessments = [
  {
    "title": "Senior React Native Engineer Assessment",
    "role_targeted": "Mobile Engineers",
    "description": "Assess React Native and mobile development skills.",
    "total_time_limit_minutes": 90,
    "passing_score": 75,
    "categories": [],
    "category_overrides": [],
    "status": "published",
    "created_by": "System",
    "id": "asmnt_react_native",
    "created_at": new Date().toISOString()
  },
  {
    "title": "Full Stack Next.js Test",
    "role_targeted": "Full Stack Engineers",
    "description": "Test Next.js, Node.js, and DB skills.",
    "total_time_limit_minutes": 120,
    "passing_score": 80,
    "categories": [],
    "category_overrides": [],
    "status": "published",
    "created_by": "System",
    "id": "asmnt_nextjs",
    "created_at": new Date().toISOString()
  },
  {
    "title": "Digital Marketing Strategy Assessment",
    "role_targeted": "Marketing Managers",
    "description": "Evaluate SEO, PPC, and content strategy.",
    "total_time_limit_minutes": 45,
    "passing_score": 70,
    "categories": [],
    "category_overrides": [],
    "status": "published",
    "created_by": "System",
    "id": "asmnt_marketing",
    "created_at": new Date().toISOString()
  },
  {
    "title": "Senior Python Backend Test",
    "role_targeted": "Backend Engineers",
    "description": "Evaluate Django/Flask and system design.",
    "total_time_limit_minutes": 90,
    "passing_score": 75,
    "categories": [],
    "category_overrides": [],
    "status": "published",
    "created_by": "System",
    "id": "asmnt_python",
    "created_at": new Date().toISOString()
  },
  {
    "title": "UI/UX Design Portfolio Review",
    "role_targeted": "Product Designers",
    "description": "Review Figma and user research skills.",
    "total_time_limit_minutes": 60,
    "passing_score": 85,
    "categories": [],
    "category_overrides": [],
    "status": "published",
    "created_by": "System",
    "id": "asmnt_uiux",
    "created_at": new Date().toISOString()
  },
  {
    "title": "Financial Analysis & Modeling",
    "role_targeted": "Financial Analysts",
    "description": "Assess Excel, forecasting, and IFRS knowledge.",
    "total_time_limit_minutes": 120,
    "passing_score": 80,
    "categories": [],
    "category_overrides": [],
    "status": "published",
    "created_by": "System",
    "id": "asmnt_finance",
    "created_at": new Date().toISOString()
  }
];

if (!db.assessments) db.assessments = [];

const existingIds = new Set(db.assessments.map(a => a.id));
for (const a of mockAssessments) {
  if (!existingIds.has(a.id)) {
    db.assessments.push(a);
  }
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Mock assessments seeded successfully.');
