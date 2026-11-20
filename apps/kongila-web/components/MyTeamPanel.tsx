import React from 'react';
import EngagementWorkspace from './EngagementWorkspace';

export default function MyTeamPanel({ currentUser, requests = [], onAddRequest }: any) {
  return <EngagementWorkspace mode="client" currentUser={currentUser} requests={requests} onAddRequest={onAddRequest} />;
}
