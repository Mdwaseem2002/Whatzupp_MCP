trigger WhatzuppLeadConvertTrigger on Lead (after update) {
    WhatzuppLeadConvertHandler.handleAfterUpdate(Trigger.new, Trigger.oldMap);
}
