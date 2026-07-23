CREATE OR REPLACE FUNCTION get_full_db_state()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'users', (SELECT COALESCE(json_agg(row_to_json(users)), '[]'::json) FROM users),
    'organizations', (SELECT COALESCE(json_agg(row_to_json(organizations)), '[]'::json) FROM organizations),
    'client_profiles', (SELECT COALESCE(json_agg(row_to_json(client_profiles)), '[]'::json) FROM client_profiles),
    'talent_profiles', (SELECT COALESCE(json_agg(row_to_json(talent_profiles)), '[]'::json) FROM talent_profiles),
    'skills', (SELECT COALESCE(json_agg(row_to_json(skills)), '[]'::json) FROM skills),
    'talent_skills', (SELECT COALESCE(json_agg(row_to_json(talent_skills)), '[]'::json) FROM talent_skills),
    'documents', (SELECT COALESCE(json_agg(row_to_json(documents)), '[]'::json) FROM documents),
    'service_requests', (SELECT COALESCE(json_agg(row_to_json(service_requests)), '[]'::json) FROM service_requests),
    'matches', (SELECT COALESCE(json_agg(row_to_json(matches)), '[]'::json) FROM matches),
    'projects', (SELECT COALESCE(json_agg(row_to_json(projects)), '[]'::json) FROM projects),
    'tasks', (SELECT COALESCE(json_agg(row_to_json(tasks)), '[]'::json) FROM tasks),
    'contracts', (SELECT COALESCE(json_agg(row_to_json(contracts)), '[]'::json) FROM contracts),
    'assignments', (SELECT COALESCE(json_agg(row_to_json(assignments)), '[]'::json) FROM assignments),
    'invoices', (SELECT COALESCE(json_agg(row_to_json(invoices)), '[]'::json) FROM invoices),
    'payments', (SELECT COALESCE(json_agg(row_to_json(payments)), '[]'::json) FROM payments),
    'talent_payouts', (SELECT COALESCE(json_agg(row_to_json(talent_payouts)), '[]'::json) FROM talent_payouts),
    'messages', (SELECT COALESCE(json_agg(row_to_json(messages)), '[]'::json) FROM messages),
    'notifications', (SELECT COALESCE(json_agg(row_to_json(notifications)), '[]'::json) FROM notifications),
    'audit_logs', (SELECT COALESCE(json_agg(row_to_json(audit_logs)), '[]'::json) FROM audit_logs),
    'agent_logs', (SELECT COALESCE(json_agg(row_to_json(agent_logs)), '[]'::json) FROM agent_logs),
    'support_tickets', (SELECT COALESCE(json_agg(row_to_json(support_tickets)), '[]'::json) FROM support_tickets),
    'support_messages', (SELECT COALESCE(json_agg(row_to_json(support_messages)), '[]'::json) FROM support_messages),
    'interviews', (SELECT COALESCE(json_agg(row_to_json(interviews)), '[]'::json) FROM interviews),
    'request_activity_logs', (SELECT COALESCE(json_agg(row_to_json(request_activity_logs)), '[]'::json) FROM request_activity_logs),
    'conversations', (SELECT COALESCE(json_agg(row_to_json(conversations)), '[]'::json) FROM conversations),
    'assessments', (SELECT COALESCE(json_agg(row_to_json(assessments)), '[]'::json) FROM assessments),
    'assessment_categories', (SELECT COALESCE(json_agg(row_to_json(assessment_categories)), '[]'::json) FROM assessment_categories),
    'assessment_questions', (SELECT COALESCE(json_agg(row_to_json(assessment_questions)), '[]'::json) FROM assessment_questions),
    'assessment_assignments', (SELECT COALESCE(json_agg(row_to_json(assessment_assignments)), '[]'::json) FROM assessment_assignments),
    'skill_assessment_results', (SELECT COALESCE(json_agg(row_to_json(skill_assessment_results)), '[]'::json) FROM skill_assessment_results),
    'talent_skill_assessments', (SELECT COALESCE(json_agg(row_to_json(talent_skill_assessments)), '[]'::json) FROM talent_skill_assessments)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
