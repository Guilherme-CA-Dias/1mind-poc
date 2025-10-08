import { RECORD_ACTIONS } from "@/lib/constants";

interface WebhookPayloadData {
	id: string;
	name?: string;
	websiteUrl?: string;
	phones?: Array<{
		value: string;
		type: string;
	}>;
	primaryPhone?: string;
	description?: string;
	currency?: string;
	industry?: string;
	ownerId?: string;
	primaryAddress?: {
		type?: string;
		full?: string;
		street?: string;
		city?: string;
		state?: string;
		country?: string;
		zip?: string;
	};
	addresses?: Array<{
		type?: string;
		full?: string;
		street?: string;
		city?: string;
		state?: string;
		country?: string;
		zip?: string;
	}>;
	numberOfEmployees?: number;
	createdTime?: string;
	createdBy?: string;
	updatedTime?: string;
	updatedBy?: string;
	lastActivityTime?: string;
}

interface WebhookPayload {
	type: "created" | "updated" | "deleted";
	data: WebhookPayloadData;
	customerId: string;
	internalContactId?: string;
	externalContactId?: string;
}

// Define webhook URLs for default record types
const WEBHOOK_URLS = {
	leads:
		"https://api.integration.app/webhooks/app-events/1bb1bf4e-93d1-4079-b3bb-8d4ff6359501",
	companies:
		"https://api.integration.app/webhooks/app-events/0502c111-b765-47fd-94cc-450b93bd9e5c",
	// Default URL for custom objects
	custom:
		"https://api.integration.app/webhooks/app-events/edd3514f-9d77-4ecf-bf3e-376fd8b10b14",
};

// Get default form types from RECORD_ACTIONS
const defaultFormTypes = RECORD_ACTIONS.filter(
	(action) => action.type === "default"
).map((action) => action.key);

export async function sendToWebhook(payload: any) {
	try {
		// Determine if this is a default or custom record type
		const recordType = payload.instanceKey || "";
		const isDefaultType = defaultFormTypes.includes(recordType);

		console.log("recordType", recordType);
		console.log("isDefaultType", isDefaultType);

		// Select the appropriate webhook URL
		let webhookUrl = WEBHOOK_URLS.custom;
		if (isDefaultType) {
			const webhookKey = recordType.replace(
				"get-",
				""
			) as keyof typeof WEBHOOK_URLS;
			if (webhookKey in WEBHOOK_URLS) {
				webhookUrl = WEBHOOK_URLS[webhookKey];
			}
		}
		console.log("webhookUrl", webhookUrl);
		// For custom objects, add instanceKey to the payload
		let finalPayload = { ...payload };
		if (!isDefaultType) {
			finalPayload = {
				...finalPayload,
				instanceKey: recordType,
			};
		}
		console.log("finalPayload", finalPayload);
		// Send the webhook
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(finalPayload),
		});

		if (!response.ok) {
			throw new Error(`Webhook failed: ${response.statusText}`);
		}

		return await response.json();
	} catch (error) {
		console.error("Error sending webhook:", error);
		throw error;
	}
}
