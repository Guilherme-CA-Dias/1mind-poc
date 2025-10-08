export const RECORD_ACTIONS = [
	{
		key: "get-leads",
		name: "Leads",
		type: "default",
	},
	{
		key: "get-AI_Engagement_Conversation__c",
		name: "AI Engagement Conversation",
		type: "default",
	},
] as const;

export type RecordActionKey = (typeof RECORD_ACTIONS)[number]["key"] | string;

export const DEFAULT_FORMS = [
	{ formId: "leads", formTitle: "Leads", type: "default" },
	{
		formId: "AI_Engagement_Conversation__c",
		formTitle: "AI Engagement Conversation",
		type: "default",
	},
] as const;
