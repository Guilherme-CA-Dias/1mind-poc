import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Record } from "@/models/record";
import { RecordActionKey } from "@/lib/constants";

interface WebhookPayload {
	customerId: string;
	recordType: RecordActionKey;
	integrationKey?: string;
	data: {
		id: string | number;
		name?: string;
		fields?: {
			[key: string]: any;
		};
		createdTime?: string;
		updatedTime?: string;
		// Any other fields that might come
		[key: string]: any;
	};
}

export async function POST(request: NextRequest) {
	try {
		const payload = (await request.json()) as WebhookPayload;
		console.log("Received webhook payload:", {
			customerId: payload.customerId,
			recordId: payload.data.id,
			recordType: payload.recordType,
			integrationKey: payload.integrationKey,
		});

		// Log the full payload to understand its structure
		console.log("Full webhook payload:", JSON.stringify(payload, null, 2));

		// Try to determine integration key from payload if not provided
		let integrationKey = payload.integrationKey;
		if (!integrationKey) {
			// Check if payload has connection information
			if ((payload as any).connection?.integration?.key) {
				integrationKey = (payload as any).connection.integration.key;
				console.log(
					"Determined integration key from connection:",
					integrationKey
				);
			} else if ((payload as any).integrationKey) {
				integrationKey = (payload as any).integrationKey;
				console.log("Found integration key in payload:", integrationKey);
			} else {
				console.log("No integration key found in payload");
			}
		}

		await connectToDatabase();

		// Ensure we have the required fields
		if (!payload.customerId || !payload.data.id || !payload.recordType) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Check for existing record
		const existingRecord = await Record.findOne({
			id: payload.data.id.toString(),
			customerId: payload.customerId,
		});

		// Compare records to check if update is needed
		if (existingRecord) {
			// Convert both records to comparable objects
			const existingData = {
				...existingRecord.toObject(),
				_id: undefined, // Exclude MongoDB _id from comparison
				__v: undefined, // Exclude version from comparison
				updatedTime: undefined, // Exclude updatedTime from comparison
			};

			const newData = {
				...payload.data,
				id: payload.data.id.toString(),
				customerId: payload.customerId,
				recordType: payload.recordType,
				integrationKey: integrationKey,
				_id: undefined,
				__v: undefined,
				updatedTime: undefined,
			};

			// Only update if data has changed
			if (JSON.stringify(existingData) === JSON.stringify(newData)) {
				console.log("Record unchanged, skipping update:", payload.data.id);
				return NextResponse.json({
					success: true,
					recordId: payload.data.id,
					_id: existingRecord._id,
					customerId: payload.customerId,
					recordType: payload.recordType,
					status: "unchanged",
				});
			}
		}

		// Update or insert the record
		const result = await Record.findOneAndUpdate(
			{
				id: payload.data.id.toString(),
				customerId: payload.customerId,
			},
			{
				$set: {
					...payload.data,
					id: payload.data.id.toString(),
					customerId: payload.customerId,
					recordType: payload.recordType,
					integrationKey: integrationKey,
					updatedTime: new Date().toISOString(),
				},
			},
			{
				upsert: true,
				new: true, // Return the updated/inserted document
			}
		);

		console.log("Record updated:", {
			id: payload.data.id,
			_id: result._id,
			customerId: payload.customerId,
			recordType: payload.recordType,
			integrationKey: integrationKey,
			status: existingRecord ? "updated" : "created",
		});

		return NextResponse.json({
			success: true,
			recordId: payload.data.id,
			_id: result._id,
			customerId: payload.customerId,
			recordType: payload.recordType,
			integrationKey: integrationKey,
			status: existingRecord ? "updated" : "created",
		});
	} catch (error) {
		console.error("Error processing webhook:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
