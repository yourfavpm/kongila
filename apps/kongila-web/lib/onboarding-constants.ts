export const COUNTRIES_AND_CODES = [
  { name: 'United States', code: '+1' },
  { name: 'Canada', code: '+1' },
  { name: 'United Kingdom', code: '+44' },
  { name: 'Australia', code: '+61' },
  { name: 'Nigeria', code: '+234' },
  { name: 'India', code: '+91' },
  { name: 'Germany', code: '+49' },
  { name: 'France', code: '+33' },
  { name: 'Brazil', code: '+55' },
  { name: 'South Africa', code: '+27' },
  { name: 'Mexico', code: '+52' },
  { name: 'Spain', code: '+34' },
  { name: 'Italy', code: '+39' },
  { name: 'Netherlands', code: '+31' },
  { name: 'Sweden', code: '+46' },
  { name: 'Switzerland', code: '+41' },
  { name: 'United Arab Emirates', code: '+971' },
  { name: 'Singapore', code: '+65' },
  { name: 'Japan', code: '+81' },
  { name: 'South Korea', code: '+82' },
  { name: 'China', code: '+86' },
  { name: 'Kenya', code: '+254' },
  { name: 'Ghana', code: '+233' },
  { name: 'Egypt', code: '+20' },
  { name: 'Argentina', code: '+54' },
  { name: 'Austria', code: '+43' },
  { name: 'Belgium', code: '+32' },
  { name: 'Chile', code: '+56' },
  { name: 'Colombia', code: '+57' },
  { name: 'Denmark', code: '+45' },
  { name: 'Finland', code: '+358' },
  { name: 'Greece', code: '+30' },
  { name: 'Hong Kong', code: '+852' },
  { name: 'Indonesia', code: '+62' },
  { name: 'Ireland', code: '+353' },
  { name: 'Israel', code: '+972' },
  { name: 'Malaysia', code: '+60' },
  { name: 'New Zealand', code: '+64' },
  { name: 'Norway', code: '+47' },
  { name: 'Philippines', code: '+63' },
  { name: 'Poland', code: '+48' },
  { name: 'Portugal', code: '+351' },
  { name: 'Russia', code: '+7' },
  { name: 'Saudi Arabia', code: '+966' },
  { name: 'Thailand', code: '+66' },
  { name: 'Turkey', code: '+90' },
  { name: 'Vietnam', code: '+84' },
  { name: 'Zambia', code: '+260' },
  { name: 'Zimbabwe', code: '+263' },
  { name: 'Uganda', code: '+256' },
  { name: 'Rwanda', code: '+250' },
  { name: 'Morocco', code: '+212' },
  { name: 'Tanzania', code: '+255' },
  { name: 'Senegal', code: '+221' },
  { name: 'Ivory Coast', code: '+225' },
  { name: 'Cameroon', code: '+237' },
  { name: 'Angola', code: '+244' }
].sort((a, b) => a.name.localeCompare(b.name));

export const SUGGESTED_SKILLS = [
  // Tech & Engineering
  'React', 'Node.js', 'Python', 'Java', 'C++', 'Go', 'Ruby on Rails', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Machine Learning', 'Data Science', 'Data Engineering', 'Cybersecurity', 'Blockchain', 'SQL', 'NoSQL', 'GraphQL', 'Next.js', 'Vue.js', 'Angular', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'SASS/SCSS', 'Tailwind CSS', 'Redux', 'Zustand', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ', 'Terraform', 'Ansible', 'Jenkins', 'Git', 'GitHub Actions', 'GitLab CI', 'Linux/Unix', 'Bash Scripting', 'C#', '.NET', 'PHP', 'Laravel', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Microservices', 'System Architecture', 'API Design', 'RESTful APIs', 'gRPC', 'WebSockets', 'WebRTC', 'Solidity', 'Smart Contracts', 'Web3.js', 'Ethers.js', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Pandas', 'NumPy', 'Data Visualization', 'Tableau', 'Power BI', 'Snowflake', 'BigQuery', 'Data Warehousing', 'ETL/ELT', 'Penetration Testing', 'Ethical Hacking', 'Network Security', 'Cryptography',

  // Marketing & Sales
  'SEO', 'Content Marketing', 'Digital Marketing', 'Lead Generation', 'Email Marketing', 'Social Media Management', 'Performance Marketing', 'PPC Advertising', 'Copywriting', 'Brand Strategy', 'Public Relations', 'B2B Sales', 'B2C Sales', 'CRM Management', 'Salesforce', 'HubSpot', 'Account Management', 'Customer Success', 'Market Research', 'Growth Hacking', 'Affiliate Marketing', 'Influencer Marketing', 'Event Management', 'Google Ads', 'Facebook Ads', 'LinkedIn Ads', 'Conversion Rate Optimization (CRO)', 'A/B Testing', 'Marketing Automation', 'Mailchimp', 'Klaviyo', 'Sales Funnels', 'Cold Calling', 'Cold Emailing', 'Sales Negotiation', 'Channel Sales', 'Partnerships', 'Community Management', 'Community Building', 'Video Marketing', 'Podcast Production', 'Blogging',

  // Operations & Management
  'Project Management', 'Agile/Scrum', 'Operations Management', 'Supply Chain Management', 'Logistics', 'Process Optimization', 'Risk Management', 'Quality Assurance', 'Business Analysis', 'Strategic Planning', 'Change Management', 'Vendor Management', 'Data Entry', 'Administrative Support', 'Executive Assistance', 'Virtual Assistance', 'Jira', 'Asana', 'Trello', 'Monday.com', 'Notion', 'Slack', 'Microsoft Office', 'Google Workspace', 'Inventory Management', 'Procurement', 'Lean Six Sigma', 'Business Process Modeling', 'Resource Allocation', 'Capacity Planning', 'Business Intelligence',

  // Finance & Accounting
  'Financial Analysis', 'Financial Modeling', 'Accounting', 'Bookkeeping', 'Tax Preparation', 'Auditing', 'Payroll Management', 'Corporate Finance', 'Investment Banking', 'Wealth Management', 'Cryptocurrency', 'QuickBooks', 'Xero', 'Financial Reporting', 'Budgeting', 'Forecasting', 'Cost Accounting', 'Managerial Accounting', 'Accounts Payable (AP)', 'Accounts Receivable (AR)', 'Reconciliation', 'IFRS', 'GAAP', 'Financial Planning', 'Venture Capital', 'Private Equity', 'Mergers & Acquisitions (M&A)', 'Risk Analysis', 'Treasury Management',

  // Legal & HR
  'Contract Law', 'Corporate Law', 'Intellectual Property', 'Compliance', 'Employment Law', 'Legal Drafting', 'Recruitment', 'Talent Acquisition', 'Employee Relations', 'HR Management', 'Compensation & Benefits', 'Onboarding/Offboarding', 'Training & Development', 'Performance Management', 'Diversity & Inclusion', 'Legal Research', 'Paralegal Skills', 'Corporate Governance', 'Data Privacy (GDPR/CCPA)', 'Immigration Law', 'Dispute Resolution', 'Mediation', 'HRIS', 'Workday', 'BambooHR', 'Applicant Tracking Systems (ATS)', 'Greenhouse', 'Lever',

  // Design & Creative
  'UI/UX Design', 'Graphic Design', 'Product Design', 'Figma', 'Adobe Creative Suite', 'Video Editing', 'Motion Graphics', 'Animation', 'Illustration', '3D Modeling', 'Photography', 'Art Direction', 'Web Design', 'Interior Design', 'Wireframing', 'Prototyping', 'User Research', 'Usability Testing', 'Interaction Design', 'Visual Design', 'Branding', 'Typography', 'Color Theory', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe Premiere Pro', 'Adobe After Effects', 'Blender', 'Cinema 4D', 'Maya', 'AutoCAD', 'SketchUp', 'Storyboarding', 'Sound Design', 'Audio Editing', 'Music Production',

  // Other Professional Services
  'Translation', 'Transcription', 'Voice Acting', 'Technical Writing', 'Ghostwriting', 'Grant Writing', 'Resume Writing', 'Proofreading', 'Editing', 'Tutoring', 'Customer Service', 'Technical Support', 'Help Desk', 'Data Labeling', 'Data Annotation', 'Research', 'Real Estate Management', 'Property Management'
].sort();

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'ZAR', 'NGN', 'KES', 'GHS', 'EGP', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'MXN', 'RUB', 'AED', 'SAR', 'TRY', 'THB', 'IDR', 'MYR', 'PHP', 'VND', 'ARS', 'CLP', 'COP', 'PEN', 'UAH', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RSD', 'ALL', 'BAM', 'MKD', 'AFN', 'ALL', 'DZD', 'AOA', 'XCD', 'AMD', 'AWG', 'AZN', 'BSD', 'BHD', 'BDT', 'BBD', 'BYN', 'BZD', 'XOF', 'BMD', 'BTN', 'BOB', 'BWP', 'BND', 'BIF', 'KHR', 'XAF', 'CVE', 'KYD', 'KMF', 'CDF', 'CRC', 'CUP', 'DJF', 'DOP', 'XPF', 'ERN', 'SZL', 'ETB', 'FJD', 'GMD', 'GEL', 'GTQ', 'GNF', 'GYD', 'HTG', 'HNL', 'ISK', 'IQD', 'JMD', 'JOD', 'KZT', 'KPW', 'KRW', 'KWD', 'KGS', 'LAK', 'LBP', 'LSL', 'LRD', 'LYD', 'MOP', 'MGA', 'MWK', 'MVR', 'MRU', 'MUR', 'MDL', 'MNT', 'MAD', 'MZN', 'MMK', 'NAD', 'NPR', 'NIO', 'OMR', 'PKR', 'PAB', 'PGK', 'PYG', 'QAR', 'RWF', 'WST', 'STN', 'SCR', 'SLL', 'SBD', 'SOS', 'LKR', 'SDG', 'SRD', 'SYP', 'TWD', 'TJS', 'TZS', 'TOP', 'TTD', 'TND', 'TMT', 'UGX', 'UYU', 'UZS', 'VUV', 'VES', 'YER', 'ZMW', 'ZWL'
].sort();
