public with sharing class WhatzuppLeadConvertHandler {

    @future(callout=true)
    public static void asyncSendLeadConvertedWebhook(String leadId, String contactId, String opportunityId, String accountId) {
        try {
            Http http = new Http();
            HttpRequest request = new HttpRequest();
            // Named Credential callout to WhatZupp API endpoint
            request.setEndpoint('callout:WhatZupp_API/api/workspaces/salescloud/webhook/lead-converted');
            request.setMethod('POST');
            request.setHeader('Content-Type', 'application/json');
            request.setHeader('X-Workspace-Key', 'salescloud-ws-key-secret');
            
            Map<String, String> payload = new Map<String, String>();
            payload.put('leadId', leadId);
            payload.put('contactId', contactId);
            if (opportunityId != null) payload.put('opportunityId', opportunityId);
            if (accountId != null) payload.put('accountId', accountId);
            
            request.setBody(JSON.serialize(payload));
            
            HttpResponse response = http.send(request);
            System.debug('[WhatZupp] Lead converted webhook response status: ' + response.getStatusCode() + ' body: ' + response.getBody());
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, '[WhatZupp] Error sending lead converted webhook: ' + e.getMessage());
        }
    }

    public static void handleAfterUpdate(List<Lead> newLeads, Map<Id, Lead> oldMap) {
        for (Lead l : newLeads) {
            Lead oldLead = oldMap.get(l.Id);
            if (l.IsConverted && !oldLead.IsConverted && l.ConvertedContactId != null) {
                asyncSendLeadConvertedWebhook(
                    l.Id,
                    l.ConvertedContactId,
                    l.ConvertedOpportunityId,
                    l.ConvertedAccountId
                );
            }
        }
    }
}
