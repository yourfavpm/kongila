export interface DispatchResult {
  success: boolean;
  channel: 'Email' | 'SMS' | 'WhatsApp';
  dispatchedAt: string;
}

export function sendEmailNotification(to: string, subject: string, body: string): DispatchResult {
  console.log(`[SMTP Mail Dispatcher] Sending to ${to} | Subject: ${subject}`);
  return {
    success: true,
    channel: 'Email',
    dispatchedAt: new Date().toISOString()
  };
}

export function sendWhatsAppNotification(phone: string, templateName: string, params: Record<string, string>): DispatchResult {
  console.log(`[WhatsApp API Webhook] Dispatching ${templateName} template to ${phone} with params:`, params);
  return {
    success: true,
    channel: 'WhatsApp',
    dispatchedAt: new Date().toISOString()
  };
}

export function sendSMSNotification(phone: string, message: string): DispatchResult {
  console.log(`[SMS Gateway] Dispatched text: "${message}" to ${phone}`);
  return {
    success: true,
    channel: 'SMS',
    dispatchedAt: new Date().toISOString()
  };
}

export function dispatchOnboardingAlert(talentName: string, email: string): void {
  sendEmailNotification(
    email,
    'Welcome to Kongila!',
    `Hi ${talentName},\nYour profile has been vetted and matched with active workspace requests! Please log in to complete your onboarding details.`
  );
}

export function dispatchInterviewAlert(clientEmail: string, talentName: string, time: string): void {
  sendEmailNotification(
    clientEmail,
    'Interview Confirmed - Kongila Match',
    `An interview session with candidate ${talentName} is scheduled for: ${time}. Zoom link generated automatically.`
  );
}
