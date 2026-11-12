-- New talent profiles begin in vetting, not as already vetted with grade A.
-- The account provisioning route also writes these values explicitly; these
-- defaults protect any other server-side insert that omits them.

-- Earlier provisioning omitted the vetting fields and inherited the old
-- Vetted/A defaults. Repair only those rows that still lack a complete set
-- of measured scores. A candidate with any completed stage or score remains
-- in Review; untouched records return to Applied.
do $repair$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'talent_profiles'
       and column_name = 'vetting_pipeline'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'talent_profiles'
       and column_name = 'vetting_scores'
  ) then
    raise exception 'Apply the talent vetting columns migration before this migration';
  end if;

  alter table public.talent_profiles
    alter column vetting_stage set default 'Application Screening',
    alter column vetting_status set default 'Applied',
    alter column grade set default 'Ungraded';

  execute $sql$
    update public.talent_profiles as talent
       set vetting_stage = case
             when exists (
               select 1
                 from jsonb_array_elements(
                   case
                     when jsonb_typeof(talent.vetting_pipeline) = 'array'
                     then talent.vetting_pipeline
                     else '[]'::jsonb
                   end
                 ) as stage
                where stage ->> 'status' in ('passed', 'failed', 'rejected')
             ) or (
               talent.vetting_scores ?| array[
                 'technical', 'behavioral', 'personality',
                 'remoteReadiness', 'workSimulation'
               ]
             )
             then talent.vetting_stage
             else 'Application Screening'
           end,
           vetting_status = case
             when exists (
               select 1
                 from jsonb_array_elements(
                   case
                     when jsonb_typeof(talent.vetting_pipeline) = 'array'
                     then talent.vetting_pipeline
                     else '[]'::jsonb
                   end
                 ) as stage
                where stage ->> 'status' in ('passed', 'failed', 'rejected')
             ) or (
               talent.vetting_scores ?| array[
                 'technical', 'behavioral', 'personality',
                 'remoteReadiness', 'workSimulation'
               ]
             )
             then 'Review'
             else 'Applied'
           end,
           grade = 'Ungraded'
     where talent.vetting_status = 'Vetted'
       and talent.grade = 'A'
       and not (
         talent.vetting_scores ?& array[
           'technical', 'behavioral', 'personality',
           'remoteReadiness', 'workSimulation'
         ]
       )
  $sql$;
end
$repair$;
