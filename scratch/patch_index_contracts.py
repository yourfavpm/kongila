import re

file_path = 'apps/kongila-web/pages/index.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# Replace handleExtendOffer
extend_offer_start = "  // Extend Job Offer (Generate Contract)"
extend_offer_end = "  const handleSignContract = async () => {"

new_extend_offer = """  // Extend Job Offer (Generate Contract)
  const handleExtendOffer = async (talent: TalentProfile) => {
    if (!selectedRequest || !currentUser) return;

    // Insert Contract into Supabase
    const { data: insertedContract, error: contractErr } = await supabase.from('contracts').insert({
      client_id: currentUser.id,
      talent_id: talent.id,
      role_title: selectedRequest.roleDescription || selectedRequest.title || 'Role',
      start_date: selectedRequest.startDate,
      engagement_type: 'Full-time',
      status: 'pending',
      client_monthly_fee_usd: selectedRequest.budget || 0
    }).select().single();

    if (contractErr || !insertedContract) {
      console.error('Failed to create contract', contractErr);
      triggerBanner('Failed to generate contract.', 'error');
      return;
    }

    // Update match status to offer extended
    const updatedMatches = matches.map(m => 
      (m.requestId === selectedRequest.id && m.talentId === talent.id) 
        ? { ...m, status: 'Offer Extended' as const } 
        : m
    );

    // Update request status to Onboarding
    const updatedRequests = requests.map(r => 
      r.id === selectedRequest.id ? { ...r, status: 'Candidates Ready' as const } : r
    );

    const ndaText = generateNDATemplate(talent.name, currentUser ? `${currentUser.name} (${currentUser.companyName || 'Unknown Company'})` : 'Guest Client');
    setActiveNDA(ndaText);
    setSigningContractId(insertedContract.id);

    const updatedDb = {
      talents,
      clientRequests: updatedRequests,
      matches: updatedMatches,
      tasks: [],
      contracts: contracts, // keeping local mock unchanged, handled directly by Supabase
      notifications: [],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: currentUser.name,
          action: 'Extend Job Offer',
          details: `Extended EOR contract for ${talent.name} ($${selectedRequest.budget}/mo)`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_${Date.now()}`,
          agentName: 'Compliance Agent',
          message: `Job offer generated for ${talent.name}. Contractor compliance package initiated.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'info'
        }
      ]
    };

    setMatches(updatedMatches);
    setRequests(updatedRequests);
    await saveToDb(updatedDb);
    setShowSignModal(true);
  };

"""

# Replace handleSignContract
sign_contract_start = "  // Sign NDA/Contract Simulator"
sign_contract_end = "  const generateNDATemplate = (talentName: string, clientName: string) => {"

new_sign_contract = """  // Sign NDA/Contract Simulator
  const handleSignContract = async () => {
    if (!signingContractId) return;

    // Update contract status in Supabase
    const { error: contractErr } = await supabase.from('contracts').update({
      status: 'active'
    }).eq('id', signingContractId);

    if (contractErr) {
      console.error('Failed to sign contract', contractErr);
      triggerBanner('Failed to sign contract.', 'error');
      return;
    }

    const currentContract = contracts.find(c => c.id === signingContractId); // Might not be found if it was just inserted, but we can look it up in Supabase instead or assume the talent is selectedTalent
    const talentIdToUpdate = selectedTalent?.id;
    const talentNameToUpdate = selectedTalent?.name || 'Talent';

    // Set talent deployed
    const updatedTalents = talents.map(t => 
      t.id === talentIdToUpdate ? { ...t, vettingStatus: 'Deployed' as const } : t
    );

    // Set request onboarding
    const updatedRequests = requests.map(r => 
      r.id === selectedRequest?.id ? { ...r, status: 'Onboarding' as const } : r
    );

    // Create general onboarding task in Remotan board
    const welcomeTask = {
      id: `task_onb_${Date.now()}`,
      projectId: 'project_general',
      projectName: 'General Onboarding',
      title: 'Complete Onboarding Welcome Videos & Systems Setup',
      description: 'Read the IT security handbook, complete portal onboarding details, and watch introducing media.',
      assigneeId: talentIdToUpdate,
      assigneeName: talentNameToUpdate,
      status: 'In Progress',
      priority: 'High',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    const updatedDb = {
      talents: updatedTalents,
      clientRequests: updatedRequests,
      matches,
      tasks: [welcomeTask],
      contracts: contracts,
      notifications: [],
      auditLogs: [
        {
          id: `audit_${Date.now()}`,
          actor: talentNameToUpdate,
          action: 'E-Sign NDA & Contract',
          details: `Contract ${signingContractId} securely signed. Deploying workspace setup.`,
          timestamp: new Date().toISOString()
        }
      ],
      agentLogs: [
        {
          id: `alog_${Date.now()}`,
          agentName: 'Compliance Agent',
          message: `E-Signature verified for ${talentNameToUpdate}. NDA locked and archived.`,
          timestamp: new Date().toLocaleTimeString(),
          type: 'success'
        }
      ]
    };

    setTalents(updatedTalents);
    setRequests(updatedRequests);
    await saveToDb(updatedDb);
    setShowSignModal(false);
    triggerBanner(`${talentNameToUpdate} has successfully signed their NDA. Onboarding initiated.`, 'success');
  };

"""

start_idx = content.find(extend_offer_start)
end_idx = content.find(extend_offer_end)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_extend_offer + content[end_idx:]
    
start_idx2 = content.find(sign_contract_start)
end_idx2 = content.find(sign_contract_end)
if start_idx2 != -1 and end_idx2 != -1:
    content = content[:start_idx2] + new_sign_contract + content[end_idx2:]

with open(file_path, 'w') as f:
    f.write(content)

print("index.tsx successfully patched for contracts!")
