import { TalentProfile, ServiceRequest, Match, Contract } from '@kongila/shared-types';

export interface PlatformMetrics {
  totalRevenue: number;
  activeTalentCount: number;
  utilizationRate: number; // % of vetted developers actively deployed
  conversionRate: number; // % of client requests that result in a hire
  activeClientsCount: number;
  averageMatchingScore: number;
}

export function computePlatformMetrics(
  talents: TalentProfile[],
  requests: ServiceRequest[],
  matches: Match[],
  contracts: Contract[]
): PlatformMetrics {
  // 1. Total Revenue (sum of all signed contract salaries * 1.2 platform commission markup)
  const activeContracts = contracts.filter(c => c.status === 'Signed');
  const monthlyVolume = activeContracts.reduce((sum, c) => sum + c.salary, 0);
  const totalRevenue = Math.round(monthlyVolume * 1.25); // 25% administrative markup

  // 2. Active Talent Count (those with 'Deployed' vetting status)
  const activeTalentCount = talents.filter(t => t.vettingStatus === 'Deployed').length;

  // 3. Utilization Rate
  // total vetted or deployed talent
  const deployableCount = talents.filter(t => t.vettingStatus === 'Vetted' || t.vettingStatus === 'Matched' || t.vettingStatus === 'Deployed').length;
  const utilizationRate = deployableCount > 0 
    ? Math.round((activeTalentCount / deployableCount) * 100) 
    : 0;

  // 4. Conversion Rate (signed contracts vs total requests)
  const conversionRate = requests.length > 0
    ? Math.round((activeContracts.length / requests.length) * 100)
    : 0;

  // 5. Active Clients Count (unique clientIds in signed contracts)
  const activeClients = new Set(activeContracts.map(c => c.clientId));
  const activeClientsCount = activeClients.size;

  // 6. Average Match Score
  const averageMatchingScore = matches.length > 0
    ? Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length)
    : 0;

  return {
    totalRevenue,
    activeTalentCount,
    utilizationRate,
    conversionRate,
    activeClientsCount,
    averageMatchingScore
  };
}

export function computeTalentProductivity(
  scores: { technical: number; workSimulation: number; behavioral: number; communication: number }
): {
  efficiency: number;
  quality: number;
  reliability: number;
  communication: number;
  overall: number;
} {
  return {
    efficiency: scores.workSimulation,
    quality: Math.round(scores.technical * 0.9 + scores.workSimulation * 0.1),
    reliability: Math.round(scores.behavioral * 0.8 + scores.workSimulation * 0.2),
    communication: scores.communication,
    overall: Math.round((scores.technical + scores.workSimulation + scores.behavioral + scores.communication) / 4)
  };
}
