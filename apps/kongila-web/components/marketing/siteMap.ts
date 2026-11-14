/**
 * One source of truth for the public site's structure.
 *
 * The header, the footer, the solution pages and the recap blocks all need
 * the same four models with the same names, colours and links. Written out
 * four times they drift, and a visitor meets "Project Management" in the nav
 * and "Project Execution" on the page it leads to.
 *
 * The names here are the ones in the approved website copy. The portal's
 * stored ServiceType values are older and different, so each model carries
 * the value the intake form actually accepts. Renaming the stored values
 * would mean migrating live requests, which is not worth doing for a label.
 */

export interface SolutionModel {
  slug: string;
  /** The name used everywhere a visitor can see. */
  name: string;
  /** One line, for cards and nav. */
  summary: string;
  /** The longer promise, for the page itself. */
  lede: string;
  /** What Kongila does, and what the client keeps. */
  split: { kongila: string; you: string };
  /** The stages shown as a strip on the page. */
  stages: string[];
  /** The colour indicator for this model. */
  colour: string;
  /** The value /api/requests accepts for serviceType. */
  serviceType: string;
}

export const SOLUTIONS: SolutionModel[] = [
  {
    slug: 'direct-hire',
    name: 'Direct Hire',
    summary: 'Find and hire someone for your own team.',
    lede: 'Hire someone directly onto your own payroll. Kongila finds and screens the candidates. You interview and make the final call.',
    split: {
      kongila: 'Searches the network, screens against your requirements, hands you a shortlist.',
      you: 'Run the interviews. The person joins as your employee.'
    },
    stages: ['Define role', 'Source', 'Shortlist', 'Interview', 'Hire'],
    colour: '#0047CC',
    serviceType: 'Hire Talent'
  },
  {
    slug: 'talent-outsourcing',
    name: 'Talent Outsourcing',
    summary: 'Get a team working for you, employed by Kongila.',
    lede: 'Get a team working for you without taking on the employment relationship. Kongila hires and manages the team. You direct the work.',
    split: {
      kongila: 'Handles payroll, compliance and employment.',
      you: 'Direct the work. The team reports to you day to day.'
    },
    stages: ['Define team', 'Assemble', 'Employ', 'Operate'],
    colour: '#3D7FFF',
    serviceType: 'Outsource Talent'
  },
  {
    slug: 'project-management',
    name: 'Project Management',
    summary: 'Get a defined project delivered from start to finish.',
    lede: 'Get a defined project delivered. Kongila builds the team and manages it through to completion.',
    split: {
      kongila: 'Assembles the team, manages the work, delivers the result.',
      you: 'Set the scope and the timeline.'
    },
    stages: ['Scope', 'Team', 'Deliver', 'Handover'],
    colour: '#0ABFBC',
    serviceType: 'Project Execution'
  },
  {
    slug: 'managed-service',
    name: 'Managed Service',
    summary: 'Hand over a function completely.',
    lede: 'Hand over a function completely. Kongila runs it, ongoing, and reports on results.',
    split: {
      kongila: 'Runs the function and reports on results.',
      you: 'Receive the outcome. No people or projects to manage.'
    },
    stages: ['Handover', 'Run', 'Report'],
    colour: '#6E5BE8',
    serviceType: 'Managed Workforce'
  }
];

export interface PlatformPage {
  slug: string;
  /** Nav and footer label. */
  name: string;
  /** One line, for cards and menus. */
  summary: string;
  /** The page's own headline. */
  heading: string;
  /** The approved body copy. */
  lede: string;
  /** The stages or checkpoints shown as a strip. */
  stages: string[];
  colour: string;
  /**
   * Shown as a plain note on the page when the approved copy says a claim
   * needs the client's sign-off first. Better an honest gap than a
   * certification nobody has earned.
   */
  pending?: string;
}

export const PLATFORM_PAGES: PlatformPage[] = [
  {
    slug: 'talent-matching',
    name: 'Talent Matching',
    summary: 'Matching that starts with the requirement, not the job title.',
    heading: 'Finding the right person for the role you have',
    lede: 'Matching starts with your actual requirements, not a job title. Kongila checks skills, experience and availability against what you need, then shortlists.',
    stages: ['Talent network', 'Filtered by requirements', 'Shortlist'],
    colour: '#0047CC'
  },
  {
    slug: 'compliance',
    name: 'Compliance',
    summary: 'Local employment requirements tracked in every market you operate.',
    heading: 'Compliance, managed in every market you operate',
    lede: "Employment law changes from country to country. Kongila tracks local requirements so your business isn't managing compliance risk separately in every market.",
    stages: ['Contracts', 'Local regulations', 'Documentation'],
    colour: '#1B5EE0',
    pending: 'Specific jurisdictions and certifications are not named here until they are confirmed.'
  },
  {
    slug: 'payroll',
    name: 'Payroll',
    summary: 'Paid correctly and on time, across currencies and tax rules.',
    heading: 'Payroll, handled in every market',
    lede: 'Paying people across several countries means different currencies, tax rules and timelines. Kongila manages this for you, so your team gets paid correctly and on time.',
    stages: ['Data in', 'Processing', 'Payment', 'Reporting'],
    colour: '#0ABFBC'
  },
  {
    slug: 'workforce-operations',
    name: 'Workforce Operations',
    summary: 'The day-to-day administration of keeping a team running.',
    heading: 'Running your workforce, day to day',
    lede: 'Hiring is only the start. Kongila manages the ongoing administration involved in keeping a workforce running, so issues get handled before they reach you.',
    stages: ['Onboarding', 'Performance', 'Issues', 'Reporting'],
    colour: '#1FB97A'
  },
  {
    slug: 'workforce-platform',
    name: 'Workforce Platform',
    summary: 'Talent, compliance, payroll and operations in one place.',
    heading: 'The infrastructure behind your workforce',
    lede: "Talent, compliance, payroll and operations, connected in one place, so information doesn't get lost between separate systems or vendors.",
    stages: ['Talent', 'Compliance', 'Payroll', 'Operations'],
    colour: '#6E5BE8'
  },
  {
    slug: 'security',
    name: 'Security',
    summary: 'Safeguards over the data employers and professionals share.',
    heading: 'Security you can rely on',
    lede: 'Handling workforce data across markets means taking security seriously. Kongila applies safeguards to protect the information shared by employers and professionals.',
    stages: ['Access control', 'Encryption in transit', 'Audit trail'],
    colour: '#33415C',
    pending: 'No certification is claimed on this page. Any standard Kongila holds will be named here once it is confirmed.'
  }
];

/**
 * Legal pages.
 *
 * Only the three with approved drafts are listed. Terms of Use and the
 * Acceptable Use Policy have not been written, and a legal page with invented
 * wording on it is worse than one that does not exist yet, so they are
 * absent from the footer rather than linked to a placeholder.
 */
export const LEGAL_PAGES = [
  { slug: 'privacy', name: 'Privacy Policy' },
  { slug: 'data-protection', name: 'Data Protection' },
  { slug: 'cookies', name: 'Cookies Policy' }
];

/** Where a visitor goes to start a request for a given model. */
export function startRequestHref(slug?: string): string {
  const model = slug ? `&model=${encodeURIComponent(slug)}` : '';
  return `/?intake=1${model}`;
}

export const JOIN_TALENT_HREF = '/?view=signup&role=talent';
export const SIGN_IN_HREF = '/login';
