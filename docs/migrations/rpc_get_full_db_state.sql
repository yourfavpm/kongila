CREATE OR REPLACE FUNCTION get_full_db_state()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'users', (SELECT COALESCE(json_agg(row_to_json(users)), '[]') FROM users),
    'organizations', (SELECT COALESCE(json_agg(row_to_json(organizations)), '[]') FROM organizations),
    'client_profiles', (SELECT COALESCE(json_agg(row_to_json(client_profiles)), '[]') FROM client_profiles),
    'talent_profiles', (SELECT COALESCE(json_agg(row_to_json(talent_profiles)), '[]') FROM talent_profiles),
    'skills', (SELECT COALESCE(json_agg(row_to_json(skills)), '[]') FROM skills),
    'talent_skills', (SELECT COALESCE(json_agg(row_to_json(talent_skills)), '[]') FROM talent_skills),
    'documents', (SELECT COALESCE(json_agg(row_to_json(documents)), '[]') FROM documents),
    'service_requests', (SELECT COALESCE(json_agg(row_to_json(service_requests)), '[]') FROM service_requests),
    'matches', (SELECT COALESCE(json_agg(row_to_json(matches)), '[]') FROM matches),
    'projects', (SELECT COALESCE(json_agg(row_to_json(projects)), '[]') FROM projects),
    'tasks', (SELECT COALESCE(json_agg(row_to_json(tasks)), '[]') FROM tasks),
    'contracts', (SELECT COALESCE(json_agg(row_to_json(contracts)), '[]') FROM contracts),
    'assignments', (SELECT COALESCE(json_agg(row_to_json(assignments)), '[]') FROM assignments),
    'invoices', (SELECT COALESCE(json_agg(row_to_json(invoices)), '[]') FROM invoices),
    'payments', (SELECT COALESCE(json_agg(row_to_json(payments)), '[]') FROM payments),
    'talent_payouts', (SELECT COALESCE(json_agg(row_to_json(talent_payouts)), '[]') FROM talent_payouts),
    'messages', (SELECT COALESCE(json_agg(row_to_json(messages)), '[]') FROM messages),
    'notifications', (SELECT COALESCE(json_agg(row_to_json(notifications)), '[]') FROM notifications),
    'audit_logs', (SELECT COALESCE(json_agg(row_to_json(audit_logs)), '[]') FROM audit_logs),
    'agent_logs', (SELECT COALESCE(json_agg(row_to_json(agent_logs)), '[]') FROM agent_logs),
    'support_tickets', (SELECT COALESCE(json_agg(row_to_json(support_tickets)), '[]') FROM support_tickets),
    'support_messages', (SELECT COALESCE(json_agg(row_to_json(support_messages)), '[]') FROM support_messages),
    'interviews', (SELECT COALESCE(json_agg(row_to_json(interviews)), '[]') FROM interviews),
    'request_activity_logs', (SELECT COALESCE(json_agg(row_to_json(request_activity_logs)), '[]') FROM request_activity_logs),
    'conversations', (SELECT COALESCE(json_agg(row_to_json(conversations)), '[]') FROM conversations),
    'assessments', (SELECT COALESCE(json_agg(row_to_json(assessments)), '[]') FROM assessments),
    'assessment_categories', (SELECT COALESCE(json_agg(row_to_json(assessment_categories)), '[]') FROM assessment_categories),
    'assessment_questions', (SELECT COALESCE(json_agg(row_to_json(assessment_questions)), '[]') FROM assessment_questions),
    'assessment_assignments', (SELECT COALESCE(json_agg(row_to_json(assessment_assignments)), '[]') FROM assessment_assignments),
    'skill_assessment_results', (SELECT COALESCE(json_agg(row_to_json(skill_assessment_results)), '[]') FROM skill_assessment_results),
    'talent_skill_assessments', (SELECT COALESCE(json_agg(row_to_json(talent_skill_assessments)), '[]') FROM talent_skill_assessments)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
