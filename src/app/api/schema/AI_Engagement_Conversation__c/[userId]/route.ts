import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { FieldSchema } from "@/models/schema";
import { FormDefinition } from "@/models/form";
import type { MongoSchemaProperty, SchemaField } from "@/types/schema";
import { DEFAULT_SCHEMAS } from "@/lib/default-schemas";

// Helper function to clean properties
const cleanSchemaProperties = (
	properties: Map<string, MongoSchemaProperty>
) => {
	return Object.fromEntries(
		Array.from(properties.entries()).map(([key, value]) => {
			const cleanValue = value.toObject ? value.toObject() : value;

			// Remove empty enum arrays
			if (
				cleanValue.enum &&
				Array.isArray(cleanValue.enum) &&
				cleanValue.enum.length === 0
			) {
				delete cleanValue.enum;
			}

			return [key, cleanValue];
		})
	);
};

// Helper to create a new field
const createField = (field: {
	name: string;
	title: string;
	type: string;
	required?: boolean;
	enum?: string[];
	default?: string;
}): MongoSchemaProperty => {
	const schemaField: SchemaField = {
		type: field.type === "select" ? "string" : field.type,
		title: field.title,
		...(field.type === "email" && { format: "email" }),
		...(field.type === "phone" && { format: "phone" }),
		...(field.type === "currency" && { format: "currency" }),
		...(field.type === "date" && { format: "date" }),
		...(field.type === "select" &&
			field.enum &&
			field.enum.length > 0 && { enum: field.enum }),
		...(field.default && { default: field.default }),
	};

	return {
		...schemaField,
		toObject: () => ({
			type: schemaField.type,
			title: schemaField.title,
			...(schemaField.format && { format: schemaField.format }),
			...(schemaField.enum &&
				schemaField.enum.length > 0 && { enum: schemaField.enum }),
			...(schemaField.default && { default: schemaField.default }),
		}),
	};
};

export async function GET(
	request: Request,
	{ params }: { params: { userId: string } }
) {
	const { userId } = await Promise.resolve(params);

	await connectToDatabase();

	// First, verify the form exists
	const formDefinition = await FormDefinition.findOne({
		customerId: userId,
		formId: "AI_Engagement_Conversation__c",
	});

	if (!formDefinition) {
		return NextResponse.json(
			{ error: "AI Engagement Conversation form not found" },
			{ status: 404 }
		);
	}

	let schema = await FieldSchema.findOne({
		customerId: userId,
		recordType: "AI_Engagement_Conversation__c",
	});

	if (!schema) {
		// Use the default AI_Engagement_Conversation__c schema
		const defaultSchema = DEFAULT_SCHEMAS.AI_Engagement_Conversation__c;

		if (!defaultSchema) {
			console.warn("No default AI_Engagement_Conversation__c schema found");
			// Create a minimal default schema
			schema = await FieldSchema.create({
				customerId: userId,
				recordType: "AI_Engagement_Conversation__c",
				properties: new Map(
					Object.entries({
						Lead__c: { type: "string", title: "Lead" },
						Email__c: { type: "string", title: "Email", format: "email" },
					})
				),
				required: [],
			});
		} else {
			// Create schema with the default properties
			schema = await FieldSchema.create({
				customerId: userId,
				recordType: "AI_Engagement_Conversation__c",
				properties: new Map(Object.entries(defaultSchema.properties)),
				required: defaultSchema.required,
			});
		}
	}

	const cleanProperties = cleanSchemaProperties(schema.properties);

	return NextResponse.json({
		schema: {
			type: "object",
			properties: cleanProperties,
			required: schema.required,
		},
	});
}

export async function POST(
	request: Request,
	{ params }: { params: { userId: string } }
) {
	try {
		const { userId } = await Promise.resolve(params);
		const { field } = await request.json();

		if (!field || !field.name || !field.type || !field.title) {
			return NextResponse.json(
				{ error: "Invalid field data" },
				{ status: 400 }
			);
		}

		if (field.type === "select" && (!field.enum || !field.enum.length)) {
			return NextResponse.json(
				{ error: "Select fields must have options" },
				{ status: 400 }
			);
		}

		await connectToDatabase();

		// First, verify the form exists
		const formDefinition = await FormDefinition.findOne({
			customerId: userId,
			formId: "AI_Engagement_Conversation__c",
		});

		if (!formDefinition) {
			return NextResponse.json(
				{ error: "AI Engagement Conversation form not found" },
				{ status: 404 }
			);
		}

		let schema = await FieldSchema.findOne({
			customerId: userId,
			recordType: "AI_Engagement_Conversation__c",
		});

		if (!schema) {
			// Use the default AI_Engagement_Conversation__c schema
			const defaultSchema = DEFAULT_SCHEMAS.AI_Engagement_Conversation__c;
			const initialProperties = defaultSchema?.properties || {
				Lead__c: { type: "string", title: "Lead" },
				Email__c: { type: "string", title: "Email", format: "email" },
			};

			// Convert default properties to MongoSchemaProperty format
			const mongoProperties = new Map(
				Object.entries(initialProperties).map(([key, value]) => [
					key,
					createField({ name: key, ...value }),
				])
			);

			schema = await FieldSchema.create({
				customerId: userId,
				recordType: "AI_Engagement_Conversation__c",
				properties: mongoProperties,
				required: defaultSchema?.required || [],
			});
		}

		const newField = createField({
			name: field.name,
			title: field.title,
			type: field.type,
			enum: field.enum,
			required: field.required,
		});

		schema.properties.set(field.name, newField);

		if (field.required) {
			schema.required = [...new Set([...(schema.required || []), field.name])];
		}

		await schema.save();

		const cleanProperties = cleanSchemaProperties(schema.properties);

		return NextResponse.json({
			schema: {
				type: "object",
				properties: cleanProperties,
				required: schema.required,
			},
		});
	} catch (error) {
		console.error(
			"Error adding field to AI_Engagement_Conversation__c schema:",
			error
		);
		return NextResponse.json({ error: "Failed to add field" }, { status: 500 });
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: { userId: string } }
) {
	const { userId } = await Promise.resolve(params);
	const { fieldName } = await request.json();

	await connectToDatabase();

	// First, verify the form exists
	const formDefinition = await FormDefinition.findOne({
		customerId: userId,
		formId: "AI_Engagement_Conversation__c",
	});

	if (!formDefinition) {
		return NextResponse.json(
			{ error: "AI Engagement Conversation form not found" },
			{ status: 404 }
		);
	}

	let schema = await FieldSchema.findOne({
		customerId: userId,
		recordType: "AI_Engagement_Conversation__c",
	});

	if (!schema) {
		return NextResponse.json(
			{ error: "AI Engagement Conversation schema not found" },
			{ status: 404 }
		);
	}

	// Don't allow deletion of core fields from the default schema
	const defaultSchema = DEFAULT_SCHEMAS.AI_Engagement_Conversation__c;
	const coreFields = Object.keys(defaultSchema.properties);

	if (coreFields.includes(fieldName)) {
		return NextResponse.json(
			{
				error:
					"Cannot delete core field from AI Engagement Conversation schema",
			},
			{ status: 400 }
		);
	}

	schema.properties.delete(fieldName);
	schema.required = schema.required.filter(
		(name: string) => name !== fieldName
	);

	await schema.save();

	const cleanProperties = cleanSchemaProperties(schema.properties);

	return NextResponse.json({
		schema: {
			type: "object",
			properties: cleanProperties,
			required: schema.required,
		},
	});
}
