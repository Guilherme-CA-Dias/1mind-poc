export const DEFAULT_SCHEMAS = {
	contacts: {
		properties: {
			id: { type: "string", title: "ID" },
			name: { type: "string", title: "Name" },
			email: { type: "string", title: "Email", format: "email" },
			phone: { type: "string", title: "Phone Number", format: "phone" },
			status: {
				type: "string",
				title: "Status",
				enum: ["Active", "Inactive", "Pending"],
				default: "Active",
			},
		},
		required: ["id", "name", "email"],
	},
	companies: {
		properties: {
			id: { type: "string", title: "ID" },
			name: { type: "string", title: "Company Name" },
			website: { type: "string", title: "Website", format: "uri" },
			industry: {
				type: "string",
				title: "Industry",
				enum: [
					"Technology",
					"Healthcare",
					"Finance",
					"Manufacturing",
					"Retail",
					"Other",
				],
			},
			size: {
				type: "string",
				title: "Company Size",
				enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
			},
		},
		required: ["id", "name"],
	},
	tasks: {
		properties: {
			id: { type: "string", title: "ID" },
			name: { type: "string", title: "Name" },
			taskName: { type: "string", title: "Task Name" },
			description: { type: "string", title: "Description" },
			status: {
				type: "string",
				title: "Status",
				enum: ["Not Started", "In Progress", "Completed", "Deferred"],
			},
			priority: {
				type: "string",
				title: "Priority",
				enum: ["Low", "Medium", "High", "Urgent"],
			},
			dueDate: { type: "string", title: "Due Date", format: "date" },
			assignedTo: { type: "string", title: "Assigned To" },
		},
		required: ["id", "name", "taskName"],
	},
	leads: {
		properties: {
			Id: { type: "string", title: "ID" },
			FirstName: { type: "string", title: "First Name" },
			LastName: { type: "string", title: "Last Name" },
			Management_Level__c: { type: "string", title: "Management Level" },
			Email: { type: "string", title: "Email", format: "email" },
			AccountId: { type: "string", title: "Account ID" },
			Title: { type: "string", title: "Title" },
			Account_Corporate_Country__c: {
				type: "string",
				title: "Account Corporate Country",
			},
			State_Province_Marketo__c: {
				type: "string",
				title: "State Province Marketo",
			},
			Last_Touch_Offer__c: { type: "string", title: "Last Touch Offer" },
			Last_Touch_Solution__c: { type: "string", title: "Last Touch Solution" },
			Contact_Status__c: { type: "string", title: "Contact Status" },
			Contact_Owner_Name__c: { type: "string", title: "Contact Owner Name" },
			contactProfileFit6sense__c: {
				type: "string",
				title: "Contact Profile Fit 6sense",
			},
			account6QA6sense__c: { type: "string", title: "Account 6QA 6sense" },
			accountProfileFit6sense__c: {
				type: "string",
				title: "Account Profile Fit 6sense",
			},
			accountBuyingStage6sense__c: {
				type: "string",
				title: "Account Buying Stage 6sense",
			},
			lead6sense_Segments__c: { type: "string", title: "Lead 6sense Segments" },
			Marketo_Id__c: { type: "string", title: "Marketo ID" },
			X18_Digit_Id__c: { type: "string", title: "18 Digit ID" },
			Account_Owner_Full_Name__c: {
				type: "string",
				title: "Account Owner Full Name",
			},
			Pain_Point__c: { type: "string", title: "Pain Point" },
			Top_Priority__c: { type: "string", title: "Top Priority" },
			Purchase_Timeline__c: { type: "string", title: "Purchase Timeline" },
		},
		required: ["Id"],
	},
} as const;

export type DefaultFormType = keyof typeof DEFAULT_SCHEMAS;
