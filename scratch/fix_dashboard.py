import re

file_path = 'apps/kongila-web/components/ClientDashboard.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Replace triggerBanner
content = content.replace("triggerBanner(\"Your replacement request has been received", "alert(\"Your replacement request has been received")
content = content.replace("', 'success');", "');")

# Find the end of renderContracts and start of renderBilling to inject handleSinglePayment
billing_marker = "  const renderBilling = () => {"
handle_single_payment = """  const handleSinglePayment = async (invId: string, amount: number) => {
    const updatedInvoices = invoices.map(inv => 
      inv.id === invId ? { ...inv, status: 'paid' as const } : inv
    );

    const newAuditLog = {
      id: `audit_${Date.now()}`,
      actor: currentUser?.name || 'Client Operator',
      action: 'Pay Invoice',
      details: `Succeeded in paying invoice INV-${invId.replace('inv_', '').substring(0, 6).toUpperCase()} of ${formatCurrency(amount)}.`,
      timestamp: new Date().toISOString()
    };
    
    // Quick local state update for demo
    setInvoices(updatedInvoices);
    alert('Payment successful!');
  };

"""

start_idx = content.find(billing_marker)
if start_idx != -1:
    content = content[:start_idx] + handle_single_payment + content[start_idx:]
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fix applied.")
else:
    print("Billing marker not found.")
