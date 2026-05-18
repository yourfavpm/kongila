export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A+': return '#00ffcc'; // neon cyan
    case 'A': return '#33ff57';  // neon green
    case 'B': return '#ffcc00';  // warm amber
    case 'Reject':
    case 'C': return '#ff3333';  // vibrant red
    default: return '#cccccc';
  }
}

export function getStatusBadgeStyles(status: string): { bg: string; color: string } {
  switch (status) {
    case 'Completed':
    case 'Signed':
    case 'Vetted':
    case 'Deployed':
    case 'Onboarding':
      return { bg: 'rgba(51, 255, 87, 0.1)', color: '#33ff57' };
    case 'In Progress':
    case 'Review':
    case 'Reviewing':
    case 'Sourcing Talent':
    case 'Candidates Ready':
    case 'Client Interview':
    case 'Offer Accepted':
    case 'Interview Scheduled':
    case 'Offer Extended':
      return { bg: 'rgba(255, 204, 0, 0.1)', color: '#ffcc00' };
    case 'Blocked':
    case 'At Risk':
    case 'Replacement':
      return { bg: 'rgba(255, 51, 51, 0.1)', color: '#ff3333' };
    case 'Applied':
    case 'Matched':
    case 'Not Started':
    default:
      return { bg: 'rgba(255, 255, 255, 0.05)', color: '#aaaaaa' };
  }
}

export function shortenText(text: string, limit = 100): string {
  if (text.length <= limit) return text;
  return text.substring(0, limit) + '...';
}
