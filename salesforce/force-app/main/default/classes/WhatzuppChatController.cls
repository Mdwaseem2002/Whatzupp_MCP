/**
 * WhatzuppChatController
 * ─────────────────────
 * Apex controller for the WhatZupp LWC Chat Panel.
 * Reads messages directly from WhatsApp_Message__c (Salesforce as source of truth).
 * Creates outbound message records via upsert on Message_Id__c (External ID) to prevent duplicates.
 */
public with sharing class WhatzuppChatController {

    /**
     * Retrieves WhatsApp messages for a given Lead, Contact, or Account record.
     * Queries by the record relationship field (Lead__c, Contact__c, Account__c)
     * rather than just phone number, to avoid cross-contamination between records.
     *
     * @param recordId       The Salesforce record ID (Lead, Contact, or Account)
     * @param objectApiName  The object API name ('Lead', 'Contact', 'Account')
     * @return               List of WhatsApp_Message__c records sorted by Timestamp__c ASC
     */
    /**
     * Retrieves WhatsApp messages for a given Lead, Contact, or Account record.
     * Searches by both relationship field (Lead__c, Contact__c, Account__c) and phone number
     * to ensure complete message history is returned even if relationship was not populated.
     *
     * @param recordId       The Salesforce record ID (Lead, Contact, or Account)
     * @param objectApiName  The object API name ('Lead', 'Contact', 'Account')
     * @return               List of WhatsApp_Message__c records sorted by Timestamp__c ASC
     */
    @AuraEnabled
    public static List<WhatsApp_Message__c> getMessages(Id recordId, String objectApiName) {
        if (recordId == null || String.isBlank(objectApiName)) {
            return new List<WhatsApp_Message__c>();
        }

        Set<String> phoneTerms = new Set<String>();
        List<String> last10Patterns = new List<String>();

        try {
            if (objectApiName == 'Lead') {
                List<Lead> leads = [SELECT Phone, MobilePhone FROM Lead WHERE Id = :recordId LIMIT 1];
                if (!leads.isEmpty()) {
                    if (String.isNotBlank(leads[0].Phone)) {
                        String clean = leads[0].Phone.replaceAll('[^0-9]', '');
                        phoneTerms.add(clean);
                        phoneTerms.add(leads[0].Phone);
                        if (clean.length() >= 10) last10Patterns.add('%' + clean.substring(clean.length() - 10));
                    }
                    if (String.isNotBlank(leads[0].MobilePhone)) {
                        String clean = leads[0].MobilePhone.replaceAll('[^0-9]', '');
                        phoneTerms.add(clean);
                        phoneTerms.add(leads[0].MobilePhone);
                        if (clean.length() >= 10) last10Patterns.add('%' + clean.substring(clean.length() - 10));
                    }
                }
            } else if (objectApiName == 'Contact') {
                List<Contact> contacts = [SELECT Phone, MobilePhone FROM Contact WHERE Id = :recordId LIMIT 1];
                if (!contacts.isEmpty()) {
                    if (String.isNotBlank(contacts[0].Phone)) {
                        String clean = contacts[0].Phone.replaceAll('[^0-9]', '');
                        phoneTerms.add(clean);
                        phoneTerms.add(contacts[0].Phone);
                        if (clean.length() >= 10) last10Patterns.add('%' + clean.substring(clean.length() - 10));
                    }
                    if (String.isNotBlank(contacts[0].MobilePhone)) {
                        String clean = contacts[0].MobilePhone.replaceAll('[^0-9]', '');
                        phoneTerms.add(clean);
                        phoneTerms.add(contacts[0].MobilePhone);
                        if (clean.length() >= 10) last10Patterns.add('%' + clean.substring(clean.length() - 10));
                    }
                }
            } else if (objectApiName == 'Account') {
                List<Account> accounts = [SELECT Phone FROM Account WHERE Id = :recordId LIMIT 1];
                if (!accounts.isEmpty() && String.isNotBlank(accounts[0].Phone)) {
                    String clean = accounts[0].Phone.replaceAll('[^0-9]', '');
                    phoneTerms.add(clean);
                    phoneTerms.add(accounts[0].Phone);
                    if (clean.length() >= 10) last10Patterns.add('%' + clean.substring(clean.length() - 10));
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, '[WhatzuppChatController] Error fetching record phone: ' + e.getMessage());
        }

        String relationshipField = 'Lead__c';
        if (objectApiName == 'Contact') relationshipField = 'Contact__c';
        if (objectApiName == 'Account') relationshipField = 'Account__c';

        String query = 'SELECT Id, Name, Message_Id__c, Phone__c, Content__c, Direction__c, ' +
                        'Status__c, Timestamp__c, Lead__c, Contact__c, Account__c, Opportunity__c ' +
                        'FROM WhatsApp_Message__c WHERE (' + relationshipField + ' = :recordId';

        if (!phoneTerms.isEmpty()) {
            query += ' OR Phone__c IN :phoneTerms';
        }

        if (!last10Patterns.isEmpty()) {
            for (Integer i = 0; i < last10Patterns.size(); i++) {
                query += ' OR Phone__c LIKE \'' + String.escapeSingleQuotes(last10Patterns[i]) + '\'';
            }
        }

        query += ') ORDER BY Timestamp__c ASC NULLS LAST LIMIT 200';

        return Database.query(query);
    }

    /**
     * Retrieves WhatsApp messages by phone number.
     * Fallback method when no record relationship exists yet.
     *
     * @param phone  The phone number to search for
     * @return       List of WhatsApp_Message__c records
     */
    @AuraEnabled
    public static List<WhatsApp_Message__c> getMessagesByPhone(String phone) {
        if (String.isBlank(phone)) {
            return new List<WhatsApp_Message__c>();
        }

        String cleanPhone = phone.replaceAll('[^0-9]', '');
        String last10 = cleanPhone.length() >= 10 ? '%' + cleanPhone.substring(cleanPhone.length() - 10) : '%' + cleanPhone;

        return [
            SELECT Id, Name, Message_Id__c, Phone__c, Content__c, Direction__c,
                   Status__c, Timestamp__c, Lead__c, Contact__c, Account__c
            FROM WhatsApp_Message__c
            WHERE Phone__c = :cleanPhone
               OR Phone__c = :phone
               OR Phone__c LIKE :last10
            ORDER BY Timestamp__c ASC NULLS LAST
            LIMIT 200
        ];
    }

    /**
     * Creates or updates an outbound WhatsApp message record.
     * Uses UPSERT on Message_Id__c (External ID) to prevent duplicate records
     * when both the LWC and the Vercel webhook try to create the same record.
     *
     * @param phone            Recipient phone number
     * @param content          Message text content
     * @param messageId        WhatsApp message ID (wamid) — used as External ID
     * @param recordId         The parent Lead/Contact/Account record ID
     * @param objectApiName    The parent object API name
     * @return                 The upserted WhatsApp_Message__c record ID
     */
    @AuraEnabled
    public static Id createOutboundMessage(String phone, String content, String messageId, 
                                            Id recordId, String objectApiName) {
        if (String.isBlank(phone) || String.isBlank(content)) {
            throw new AuraHandledException('Phone and content are required.');
        }

        // Clean phone
        String cleanPhone = phone.replaceAll('[^0-9]', '');

        WhatsApp_Message__c msg = new WhatsApp_Message__c();
        msg.Message_Id__c = String.isNotBlank(messageId) ? messageId : 'lwc-' + String.valueOf(Datetime.now().getTime());
        msg.Phone__c = cleanPhone;
        msg.Content__c = content;
        msg.Direction__c = 'OUTBOUND';
        msg.Status__c = 'SENT';
        msg.Timestamp__c = Datetime.now();

        // Link to parent record
        if (recordId != null && String.isNotBlank(objectApiName)) {
            if (objectApiName == 'Lead') {
                msg.Lead__c = recordId;
            } else if (objectApiName == 'Contact') {
                msg.Contact__c = recordId;
            } else if (objectApiName == 'Account') {
                msg.Account__c = recordId;
            }
        }

        // Upsert on External ID to prevent duplicates
        try {
            Schema.SObjectField externalIdField = WhatsApp_Message__c.Message_Id__c;
            Database.UpsertResult result = Database.upsert(msg, externalIdField, false);
            if (!result.isSuccess()) {
                String errors = '';
                for (Database.Error err : result.getErrors()) {
                    errors += err.getMessage() + '; ';
                }
                System.debug(LoggingLevel.ERROR, '[WhatzuppChat] Upsert failed: ' + errors);
                throw new AuraHandledException('Failed to save message: ' + errors);
            }
            return msg.Id;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, '[WhatzuppChat] createOutboundMessage error: ' + e.getMessage());
            throw new AuraHandledException('Error saving message: ' + e.getMessage());
        }
    }
}
