export const RECORD_ACTIONS = [
	{
		key: "get-leads",
		name: "Leads",
		type: "default",
	},
] as const;

export type RecordActionKey = (typeof RECORD_ACTIONS)[number]["key"] | string;

export const DEFAULT_FORMS = [
	{ formId: "leads", formTitle: "Leads", type: "default" },
] as const;
